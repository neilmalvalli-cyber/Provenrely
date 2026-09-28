import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { ENVIRONMENT_BASE, TIERS, type QualityTier } from "./config";
import { createFoliage, type CanopyTarget, type FoliageLayer } from "./foliage";
import { createBlur, FinishShader } from "./passes";
import { createStoneUniforms, stoneMaterial } from "./stone-material";

/** scene.json, written by environment/blender/build_scene.py next to the GLB. */
interface SceneMeta {
  camera: { position: number[]; target: number[]; fovDeg: number };
  sun: { direction: number[]; intensity: number; color: number[]; angleDeg: number };
  lightmaps: Record<"architecture" | "floor", { file: string; intensity: number }>;
  panorama: string;
}

export type ToneMappingName = "agx" | "neutral" | "aces";
const TONE_MAPPING: Record<ToneMappingName, THREE.ToneMapping> = {
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
};

export interface EnvironmentSettings {
  exposure: number;
  toneMapping: ToneMappingName;
  /** Degrees added to the baked sun direction (live light only; baked shadows stay put). */
  sunAzimuth: number;
  sunElevation: number;
  wind: number;
  /** Multipliers on the baked sun and ambient (art direction; 1 = physically consistent with the bake). */
  sun: number;
  ambient: number;
  /** Lab only: show the leaf mask instead of the scene. */
  view: "scene" | "mask";
}

export const DEFAULT_SETTINGS: EnvironmentSettings = {
  exposure: 1.0,
  toneMapping: "agx",
  sunAzimuth: 0,
  sunElevation: 0,
  wind: 1,
  sun: 1,
  ambient: 1,
  view: "scene",
};

export interface EnvironmentOptions {
  tier: Exclude<QualityTier, "poster">;
  reducedMotion: boolean;
  settings?: Partial<EnvironmentSettings>;
  /** Start the foliage clock here, so a still (reduced motion, poster capture) is always the same frame. */
  startTime?: number;
  /** Don't lower the tier from measured frame times (lab, screenshots). */
  lockTier?: boolean;
  onFirstFrame?: () => void;
  /** The device can't hold even the medium tier, or the GL context was lost: show the poster instead. */
  onFallback?: (reason: string) => void;
}

export interface EnvironmentHandle {
  dispose(): void;
  update(settings: Partial<EnvironmentSettings>): void;
  setTier(tier: Exclude<QualityTier, "poster">): void;
  setReducedMotion(reduced: boolean): void;
  /** Jump the foliage clock and draw one frame (lab, screenshots, poster capture). */
  seek(seconds: number): void;
  info(): { tier: string; fps: number; time: number; memory: { geometries: number; textures: number }; programs: number; leaves: number };
}

// World-space layout of the canopy, in three.js coordinates (x right, y up, z towards the camera). Each entry says
// where a cluster's shadow should land (a receiver point) and which way its bough comes from, in light space.
const CANOPY: { at: [number, number, number]; from: [number, number]; layer: FoliageLayer; spread: number;
  density: number; leafSize: number }[] = [
  // Upper-left of the wall: the densest, crispest leaves (as in the reference), spilling down the left edge.
  { at: [-3.4, 3.7, 0], from: [-3.0, 4.0], layer: "near", spread: 1.4, density: 1.4, leafSize: 0.11 },
  { at: [-2.4, 2.9, 0], from: [-3.2, 3.0], layer: "near", spread: 1.1, density: 1.2, leafSize: 0.1 },
  { at: [-3.2, 1.7, 0], from: [-3.8, 1.2], layer: "near", spread: 1.0, density: 1.1, leafSize: 0.1 },
  { at: [-1.6, 3.9, 0], from: [-2.0, 3.5], layer: "near", spread: 0.9, density: 1.0, leafSize: 0.1 },
  // Broad, soft canopy over the middle of the wall, the floor and the platforms.
  { at: [-0.6, 2.6, 0], from: [-4.0, 5.0], layer: "far", spread: 1.8, density: 1.1, leafSize: 0.16 },
  { at: [-2.0, 0.0, 2.5], from: [-5.0, 2.5], layer: "far", spread: 2.2, density: 1.2, leafSize: 0.16 },
  { at: [0.5, 0.0, 5.5], from: [-4.5, 1.0], layer: "far", spread: 2.2, density: 1.0, leafSize: 0.16 },
  { at: [2.4, 0.4, 3.5], from: [-3.0, 3.0], layer: "far", spread: 1.6, density: 0.9, leafSize: 0.15 },
  // Pillar faces.
  { at: [2.2, 2.8, 0.3], from: [-3.0, 4.0], layer: "near", spread: 0.8, density: 0.8, leafSize: 0.1 },
  // Sunlit back wall beyond the portico: a second tree's leaves, crisp.
  { at: [6.0, 2.4, -10.2], from: [-2.5, 3.5], layer: "near", spread: 1.5, density: 1.2, leafSize: 0.1 },
  { at: [7.5, 1.4, -10.2], from: [-2.5, 2.5], layer: "near", spread: 1.2, density: 1.0, leafSize: 0.1 },
];

// Trunks and main stems of the tree out of frame (front left), as world segments: their shadows are the long soft
// bands that rake diagonally across the wall.
const TRUNKS: { from: [number, number, number]; to: [number, number, number]; width: number }[] = [
  { from: [-8.5, 0, 5.5], to: [-7.8, 9, 5.2], width: 0.34 },
  { from: [-7.0, 0, 6.8], to: [-6.2, 9, 6.0], width: 0.22 },
  { from: [-6.8, 3.5, 4.2], to: [-4.5, 8.5, 3.6], width: 0.16 },
  { from: [-5.5, 0, 8.5], to: [-4.6, 9, 7.9], width: 0.26 },
];

/** Light space: the plane perpendicular to the sunlight, where the leaf mask lives. */
function lightSpace(toSun: THREE.Vector3) {
  const travel = toSun.clone().negate().normalize();
  const u = new THREE.Vector3().crossVectors(travel, new THREE.Vector3(0, 1, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(u, travel).normalize();
  const origin = new THREE.Vector3(0, 0, 0);
  const project = (p: THREE.Vector3) => new THREE.Vector2(p.clone().sub(origin).dot(u), p.clone().sub(origin).dot(v));
  // Everything the camera or the floor reflection can see.
  const bounds = new THREE.Box3(new THREE.Vector3(-8, -0.1, -11.5), new THREE.Vector3(12, 5.2, 9));
  const rect = new THREE.Box2();
  for (let i = 0; i < 8; i++) {
    rect.expandByPoint(project(new THREE.Vector3(
      i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z,
    )));
  }
  return { u, v, origin, project, rect };
}

export async function createEnvironment(host: HTMLElement, options: EnvironmentOptions): Promise<EnvironmentHandle> {
  let settings: EnvironmentSettings = { ...DEFAULT_SETTINGS, ...options.settings };
  let tierName = options.tier;
  let tier = TIERS[tierName];
  let reducedMotion = options.reducedMotion;
  let disposed = false;

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = TONE_MAPPING[settings.toneMapping];
  renderer.toneMappingExposure = settings.exposure;
  renderer.shadowMap.enabled = false; // all shadows are baked or come from the leaf mask

  // --- Assets ---------------------------------------------------------------------------------------------------
  const url = (file: string) => `${ENVIRONMENT_BASE}/${file}`;
  const meta: SceneMeta = await fetch(url("scene.json")).then((r) => {
    if (!r.ok) throw new Error(`scene.json: ${r.status}`);
    return r.json();
  });
  const textureLoader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures: THREE.Texture[] = [];
  const loadTexture = async (file: string, srgb: boolean, repeat: boolean, channel = 0) => {
    const t = await textureLoader.loadAsync(url(file));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.channel = channel;
    t.anisotropy = anisotropy;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.flipY = false; // glTF UV convention
    textures.push(t);
    return t;
  };

  const [gltf, hdr, terrazzo, stucco, lmArch, lmFloor] = await Promise.all([
    new GLTFLoader().loadAsync(url("scene.glb")),
    new HDRLoader().loadAsync(url(meta.panorama)),
    Promise.all([
      loadTexture("textures/terrazzo_albedo.webp", true, true),
      loadTexture("textures/terrazzo_rough.webp", false, true),
      loadTexture("textures/terrazzo_normal.webp", false, true),
    ]),
    Promise.all([
      loadTexture("textures/stucco_albedo.webp", true, true),
      loadTexture("textures/stucco_rough.webp", false, true),
      loadTexture("textures/stucco_normal.webp", false, true),
    ]),
    // Lightmap RGB is sRGB-encoded irradiance / intensity; alpha is linear sun visibility.
    loadTexture(meta.lightmaps.architecture.file, true, false, 1),
    loadTexture(meta.lightmaps.floor.file, true, false, 1),
  ]);
  if (disposed) throw new Error("disposed");

  // Lightmaps were written top-down from Blender; glTF UVs are top-down too, so no flip (flipY = false above).
  const pmrem = new THREE.PMREMGenerator(renderer);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const envMap = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
  pmrem.dispose();

  // --- Scene ----------------------------------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.62, 0.64, 0.8);
  const uniforms = createStoneUniforms();

  const materials = {
    stone: stoneMaterial({
      map: terrazzo[0], roughnessMap: terrazzo[1], normalMap: terrazzo[2], normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 2.1, metalness: 0, envMap, lightMap: lmArch, lightMapIntensity: meta.lightmaps.architecture.intensity,
    }, uniforms, { key: "stone" }),
    stucco: stoneMaterial({
      map: stucco[0], roughnessMap: stucco[1], normalMap: stucco[2], normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 1.0, metalness: 0, envMap, lightMap: lmArch, lightMapIntensity: meta.lightmaps.architecture.intensity,
    }, uniforms, { key: "stucco" }),
    floor: stoneMaterial({
      map: terrazzo[0], roughnessMap: terrazzo[1], normalMap: terrazzo[2], normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 1.0, metalness: 0, envMap, lightMap: lmFloor, lightMapIntensity: meta.lightmaps.floor.intensity,
    }, uniforms, { key: "floor", reflective: true }),
  };

  const geometries: THREE.BufferGeometry[] = [];
  let floorMesh: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.push(mesh.geometry);
    (mesh.material as THREE.Material).dispose(); // glTF placeholders; the runtime owns the shading
    const name = (mesh.material as THREE.Material).name;
    if (name.startsWith("terrazzo_floor")) {
      mesh.material = materials.floor;
      floorMesh = mesh;
    } else if (name.startsWith("stucco")) {
      mesh.material = materials.stucco;
    } else {
      mesh.material = materials.stone;
    }
  });
  scene.add(gltf.scene);

  const toSun = new THREE.Vector3().fromArray(meta.sun.direction).normalize();
  const sun = new THREE.DirectionalLight(new THREE.Color().fromArray(meta.sun.color), meta.sun.intensity);
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(meta.camera.fovDeg, 1, 0.1, 80);
  camera.position.fromArray(meta.camera.position);
  camera.lookAt(new THREE.Vector3().fromArray(meta.camera.target));

  // --- Foliage (leaf mask) --------------------------------------------------------------------------------------
  const ls = lightSpace(toSun);
  const canopy: CanopyTarget[] = CANOPY.map((c) => {
    const at = ls.project(new THREE.Vector3(...c.at));
    return { at, from: at.clone().add(new THREE.Vector2(...c.from)), layer: c.layer, spread: c.spread,
      density: c.density, leafSize: c.leafSize };
  });
  const trunks = TRUNKS.map((t) => ({
    from: ls.project(new THREE.Vector3(...t.from)),
    to: ls.project(new THREE.Vector3(...t.to)),
    width: t.width,
    layer: "far" as const,
  }));
  const foliage = createFoliage(canopy, trunks, 20240917);
  const maskCamera = new THREE.OrthographicCamera(ls.rect.min.x, ls.rect.max.x, ls.rect.max.y, ls.rect.min.y, 0.1, 10);
  maskCamera.position.set(0, 0, 5);
  const rtOptions = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const size = new THREE.Vector2();
  let maskRaw: THREE.WebGLRenderTarget, maskTemp: THREE.WebGLRenderTarget, maskNear: THREE.WebGLRenderTarget;
  let farTemp: THREE.WebGLRenderTarget, maskFar: THREE.WebGLRenderTarget;
  let reflRaw: THREE.WebGLRenderTarget, reflTemp: THREE.WebGLRenderTarget, reflSharp: THREE.WebGLRenderTarget, reflSoft: THREE.WebGLRenderTarget;
  const blur = createBlur();

  function applySun() {
    const dir = toSun.clone();
    const up = new THREE.Vector3(0, 1, 0);
    dir.applyAxisAngle(up, THREE.MathUtils.degToRad(settings.sunAzimuth));
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    dir.applyAxisAngle(side, THREE.MathUtils.degToRad(settings.sunElevation));
    sun.position.copy(dir.multiplyScalar(30));
    sun.intensity = meta.sun.intensity * settings.sun;
    materials.stone.lightMapIntensity = materials.stucco.lightMapIntensity = meta.lightmaps.architecture.intensity * settings.ambient;
    materials.floor.lightMapIntensity = meta.lightmaps.floor.intensity * settings.ambient;
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
    // The mask follows the live sun: rotate light space with it (the canopy stays attached to its tree).
    const live = lightSpace(sun.position.clone().normalize());
    uniforms.uLightU.value.copy(live.u);
    uniforms.uLightV.value.copy(live.v);
    uniforms.uLightOrigin.value.copy(live.origin);
    const r = ls.rect;
    uniforms.uLightRect.value.set(r.min.x, r.min.y, 1 / (r.max.x - r.min.x), 1 / (r.max.y - r.min.y));
  }

  function buildTargets() {
    [maskRaw, maskTemp, maskNear, farTemp, maskFar].forEach((t) => t?.dispose());
    const aspect = (ls.rect.max.y - ls.rect.min.y) / (ls.rect.max.x - ls.rect.min.x);
    const mw = tier.mask, mh = Math.round(tier.mask * aspect);
    maskRaw = new THREE.WebGLRenderTarget(mw, mh, rtOptions);
    maskTemp = new THREE.WebGLRenderTarget(mw, mh, rtOptions);
    maskNear = new THREE.WebGLRenderTarget(mw, mh, rtOptions);
    farTemp = new THREE.WebGLRenderTarget(mw / 2, Math.round(mh / 2), rtOptions);
    maskFar = new THREE.WebGLRenderTarget(mw / 2, Math.round(mh / 2), rtOptions);
    uniforms.uLeafNear.value = maskNear.texture;
    uniforms.uLeafFar.value = maskFar.texture;
  }

  function buildReflectionTargets(width: number, height: number) {
    [reflRaw, reflTemp, reflSharp, reflSoft].forEach((t) => t?.dispose());
    const w = Math.max(64, Math.round(width * tier.reflection));
    const h = Math.max(64, Math.round(height * tier.reflection));
    reflRaw = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: tier.msaa ? 2 : 0 });
    reflTemp = new THREE.WebGLRenderTarget(w, h, rtOptions);
    reflSharp = new THREE.WebGLRenderTarget(w, h, rtOptions);
    reflSoft = new THREE.WebGLRenderTarget(w, h, rtOptions);
    uniforms.uReflection.value = reflSoft.texture;
    uniforms.uReflectionSharp.value = reflSharp.texture;
  }

  // --- Post -----------------------------------------------------------------------------------------------------
  let composer: EffectComposer;
  let finish: ShaderPass;
  function buildComposer() {
    composer?.dispose();
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: tier.msaa });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    if (!tier.msaa) composer.addPass(new SMAAPass());
    finish = new ShaderPass(FinishShader);
    composer.addPass(finish);
  }

  // --- Reflection camera (planar mirror in y = 0) ----------------------------------------------------------------
  const mirror = new THREE.PerspectiveCamera();
  const biasMatrix = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  function updateMirror() {
    mirror.copy(camera, false);
    const p = camera.position;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const target = p.clone().add(forward);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    mirror.position.set(p.x, -p.y, p.z);
    mirror.up.set(up.x, -up.y, up.z);
    mirror.lookAt(target.x, -target.y, target.z);
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    uniforms.uReflectionMatrix.value.copy(biasMatrix).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
  }

  // --- Framing --------------------------------------------------------------------------------------------------
  const REF_ASPECT = 16 / 9;
  const refTanX = Math.tan(THREE.MathUtils.degToRad(meta.camera.fovDeg / 2)) * REF_ASPECT;
  function frame(aspect: number) {
    camera.aspect = aspect;
    if (aspect >= REF_ASPECT) {
      camera.fov = meta.camera.fovDeg;
      camera.filmOffset = 0;
    } else {
      // Narrower screens keep the reference's horizontal framing until the vertical angle reaches 50°, then
      // (portrait) pan so the portico stays in view instead of cropping it away.
      const fov = Math.min(50, THREE.MathUtils.radToDeg(2 * Math.atan(refTanX / aspect)));
      camera.fov = fov;
      const halfX = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
      // Portrait: centre on the first pillar, with the leaf-lit wall to its left.
      const shift = Math.max(0, Math.min(refTanX - halfX, 0.12));
      camera.filmOffset = shift * camera.getFilmWidth();
    }
    camera.updateProjectionMatrix();
  }

  function resize() {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, tier.maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    renderer.getDrawingBufferSize(size);
    buildReflectionTargets(size.x, size.y);
    finish.uniforms.uAspect.value = width / height;
    frame(width / height);
    requestRender();
  }

  // --- Render ---------------------------------------------------------------------------------------------------
  let time = options.startTime ?? 0;
  function renderMask() {
    foliage.uniforms.uTime.value = time;
    foliage.uniforms.uWind.value = settings.wind;
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(maskRaw);
    renderer.clear();
    renderer.render(foliage.scene, maskCamera);
    // Penumbrae: a leaf ~2–4 m from the stone blurs by a few cm; the far canopy by 15–25 cm.
    const texelsPerMetre = tier.mask / (ls.rect.max.x - ls.rect.min.x);
    blur.run(renderer, maskRaw.texture, maskTemp, maskNear, Math.max(1, 0.028 * texelsPerMetre));
    // The far layer is blurred from the already-smoothed full-resolution result, so halving the resolution
    // can't alias the leaves into shimmering blocks.
    blur.run(renderer, maskNear.texture, farTemp, maskFar, Math.max(1.5, 0.12 * texelsPerMetre * 0.5));
  }

  function renderReflection() {
    if (!floorMesh) return;
    updateMirror();
    (floorMesh as THREE.Mesh).visible = false;
    renderer.setRenderTarget(reflRaw);
    renderer.clear();
    renderer.render(scene, mirror);
    (floorMesh as THREE.Mesh).visible = true;
    const px = reflRaw.width / 640; // blur radii scale with the reflection buffer
    blur.run(renderer, reflRaw.texture, reflTemp, reflSharp, Math.max(1, 2.0 * px));
    blur.run(renderer, reflSharp.texture, reflTemp, reflSoft, Math.max(2, 9.0 * px));
  }

  const maskView = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tNear: { value: null }, tFar: { value: null } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D tNear; uniform sampler2D tFar; varying vec2 vUv;
      void main() { float l = (1.0 - texture2D(tNear, vUv).r) * (1.0 - texture2D(tFar, vUv).g); gl_FragColor = vec4(vec3(l), 1.0); }`,
  }));

  function renderFrame() {
    renderMask();
    if (settings.view === "mask") {
      const m = maskView.material as THREE.ShaderMaterial;
      m.uniforms.tNear.value = maskNear.texture;
      m.uniforms.tFar.value = maskFar.texture;
      renderer.setRenderTarget(null);
      maskView.render(renderer);
      return;
    }
    renderReflection();
    renderer.setRenderTarget(null);
    finish.uniforms.uTime.value = time;
    composer.render();
  }

  // --- Loop, visibility, adaptive quality -----------------------------------------------------------------------
  let raf = 0;
  let last = 0;
  let lastRender = 0;
  let inView = true;
  let firstFrame = false;
  let frameTimes: number[] = [];
  let fps = 0;

  const active = () => !disposed && inView && !document.hidden;

  function tick(now: number) {
    raf = 0;
    if (!active()) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    if (now - lastRender >= 1000 / tier.fps - 2) {
      const interval = lastRender ? now - lastRender : 0;
      if (!reducedMotion) time += Math.min(interval, 100) / 1000;
      renderFrame();
      lastRender = now;
      if (!firstFrame) {
        firstFrame = true;
        options.onFirstFrame?.();
      } else if (interval) {
        // Time between rendered frames: includes GPU back-pressure, which CPU timers would miss.
        frameTimes.push(Math.max(interval, dt * 1000));
      }
      measure();
    }
    if (!reducedMotion) raf = requestAnimationFrame(tick);
  }

  function measure() {
    if (frameTimes.length < 90) return;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    fps = 1000 / avg;
    frameTimes = [];
    if (options.lockTier) return;
    // Sustained slow frames lower quality once per step, never back up (no oscillation).
    if (tierName === "high" && avg > 1000 / 40) setTier("medium");
    else if (tierName === "medium" && avg > 1000 / 22) options.onFallback?.("slow");
  }

  function requestRender() {
    if (!active() || raf) return;
    lastRender = 0;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function setTier(next: Exclude<QualityTier, "poster">) {
    tierName = next;
    tier = TIERS[next];
    buildTargets();
    buildComposer();
    resize();
  }

  const onVisibility = () => {
    if (active()) requestRender();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    onVisibility();
  });
  const resizeObserver = new ResizeObserver(() => resize());
  const onContextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    options.onFallback?.("context-lost");
  };

  buildTargets();
  buildComposer();
  applySun();
  canvas.addEventListener("webglcontextlost", onContextLost);
  host.appendChild(canvas);
  resizeObserver.observe(host);
  intersection.observe(host);
  document.addEventListener("visibilitychange", onVisibility);
  resize();

  // Compile every program before the first visible frame, so the fade-in isn't a hitch.
  // (compileAsync only helps with KHR_parallel_shader_compile; without it three warns, so compile synchronously.)
  if (renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  if (disposed) throw new Error("disposed");
  requestRender();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      [maskRaw, maskTemp, maskNear, farTemp, maskFar, reflRaw, reflTemp, reflSharp, reflSoft].forEach((t) => t.dispose());
      composer.passes.forEach((p) => p.dispose());
      composer.dispose();
      blur.dispose();
      maskView.material.dispose();
      maskView.dispose();
      foliage.dispose();
      geometries.forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      envMap.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
    update(next) {
      settings = { ...settings, ...next };
      renderer.toneMapping = TONE_MAPPING[settings.toneMapping];
      renderer.toneMappingExposure = settings.exposure;
      applySun();
      requestRender();
    },
    setTier,
    seek(seconds) {
      time = seconds;
      renderFrame();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      requestRender();
    },
    info: () => ({
      tier: tierName,
      fps: Math.round(fps),
      time,
      memory: { ...renderer.info.memory },
      programs: renderer.info.programs?.length ?? 0,
      leaves: foliage.counts.leaves,
    }),
  };
}
