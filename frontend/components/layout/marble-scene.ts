import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// World-space stone: no image maps, UV seams, tiling, or animated surface noise.
const stoneNoise = /* glsl */ `
  varying vec3 vStonePosition;
  float stoneHash(vec3 p) {
    p = fract(p * .1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float stoneNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(stoneHash(i), stoneHash(i+vec3(1,0,0)), f.x),
                   mix(stoneHash(i+vec3(0,1,0)), stoneHash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(stoneHash(i+vec3(0,0,1)), stoneHash(i+vec3(1,0,1)), f.x),
                   mix(stoneHash(i+vec3(0,1,1)), stoneHash(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float stoneFbm(vec3 p) {
    return .57 * stoneNoise(p) + .28 * stoneNoise(p * 2.03 + 7.1)
      + .15 * stoneNoise(p * 4.07 + 19.3);
  }
`;

function marbleMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: "#f2f0ed", roughness: .31, metalness: 0, envMapIntensity: .28,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vStonePosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      vStonePosition = (modelMatrix * vec4(position, 1.0)).xyz;
    `);
    shader.fragmentShader = stoneNoise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      vec3 stoneP = vStonePosition * vec3(.46, .65, .52);
      float cloud = stoneFbm(stoneP);
      float fold = stoneFbm(stoneP * 1.7 + cloud * 2.8);
      float seam = abs(sin(stoneP.x * 2.1 + stoneP.y * .85 + stoneP.z * 1.3 + fold * 7.0));
      float vein = 1.0 - smoothstep(.015, .115, seam);
      float stoneRelief = vein * .006 + cloud * .01;
      diffuseColor.rgb *= 1.0 - vein * .035 - cloud * .028;
      diffuseColor.rgb += vec3(-.003, -.001, .007) * cloud;
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (cloud - .5) * .10 + vein * .035, .24, .43);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
      #include <normal_fragment_maps>
      // Screen-space surface gradient gives sub-pixel relief without a texture.
      vec3 stoneQx = dFdx(vViewPosition), stoneQy = dFdy(vViewPosition);
      vec3 stoneRx = cross(stoneQy, normal), stoneRy = cross(normal, stoneQx);
      float stoneDet = dot(stoneQx, stoneRx);
      vec3 stoneGradient = sign(stoneDet) * (dFdx(stoneRelief) * stoneRx + dFdy(stoneRelief) * stoneRy);
      normal = normalize(abs(stoneDet) * normal - stoneGradient * .07);
    `);
  };
  material.customProgramCacheKey = () => "architectural-marble-v1";
  return material;
}

export function createMarbleScene(host: HTMLDivElement): () => void {
  const canvas = document.createElement("canvas");
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  } catch {
    host.dataset.renderer = "fallback";
    return () => { delete host.dataset.renderer; };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#edeae7");
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 70);
  camera.position.set(0, 3.1, 11.8);
  camera.lookAt(0, 2.6, -2);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const stone = marbleMaterial();
  materials.add(stone);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  geometries.add(boxGeometry);
  function block(size: [number, number, number], position: [number, number, number]) {
    const mesh = new THREE.Mesh(boxGeometry, stone);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // The broad wall is intentionally quiet; all architectural detail lives at the edge.
  block([60, 22, .4], [0, 7, -3.4]);
  block([60, .4, 42], [0, -.8, 8]);
  block([6, .22, 4.5], [6.1, -.49, -1]);
  block([4.9, .22, 3.5], [6.6, -.27, -1.4]);
  block([3.8, .22, 2.5], [7.1, -.05, -1.8]);
  block([.62, 14, 1.1], [4.65, 6.7, -2.5]);
  block([.52, 14, .85], [6.5, 6.7, -2.6]);
  block([.46, 14, .7], [8.05, 6.7, -2.7]);

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, .06);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = .3;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#c4cce8", "#d6d2d1", .65));
  // A broad off-screen window adds a gentle spatial gradient and polished highlights.
  RectAreaLightUniformsLib.init();
  const windowLight = new THREE.RectAreaLight("#fff4e5", 1.6, 5, 7);
  windowLight.position.set(-4.5, 6, 2.5);
  windowLight.lookAt(0, 1, -3);
  scene.add(windowLight);
  const sun = new THREE.DirectionalLight("#fff5e9", 2.1);
  sun.position.set(-7, 10, 7);
  sun.target.position.set(0, 1, -3);
  sun.castShadow = true;
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -.00015;
  sun.shadow.normalBias = .035;
  sun.shadow.radius = 7;
  // Low contrast: the hemisphere/environment still illuminate the shaded stone.
  sun.shadow.intensity = .78;
  scene.add(sun, sun.target);

  // Invisible to the beauty pass, but real silhouettes in the light's shadow pass.
  // Unlike visible=false or opacity=0, colorWrite preserves shadow casting.
  const leafMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, side: THREE.DoubleSide,
  });
  materials.add(leafMaterial);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(-.23, .19, -.25, .53, 0, .87);
  leafShape.bezierCurveTo(.25, .53, .23, .19, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 5);
  geometries.add(leafGeometry);
  const foliage = new THREE.Group();
  // Between sunlight and stone, above/left of the architectural camera.
  foliage.position.set(-7, 8.5, 1.7);
  foliage.scale.setScalar(1.35);
  foliage.rotation.set(-.36, -.25, -.42);
  scene.add(foliage);
  const leaves: { mesh: THREE.Mesh; x: number; y: number; angle: number; phase: number }[] = [];
  let seed = 731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let branch = 0; branch < 7; branch++) {
    const branchX = (branch - 3) * .85;
    const branchY = (random() - .5) * 2.2;
    for (let j = 0; j < 10; j++) {
      const mesh = new THREE.Mesh(leafGeometry, leafMaterial);
      const side = j % 2 ? 1 : -1;
      const x = branchX + side * (.15 + random() * .5);
      const y = branchY + Math.floor(j / 2) * .47;
      const angle = side * (.55 + random() * .8);
      mesh.position.set(x, y, random() * .8);
      mesh.rotation.set(random() * .45, random() * .4, angle);
      mesh.scale.setScalar(.65 + random() * .65);
      mesh.castShadow = true;
      foliage.add(mesh);
      leaves.push({ mesh, x, y, angle, phase: random() * Math.PI * 2 });
    }
  }
  // Off-camera window mullions cast broad diagonal architectural shadows.
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(boxGeometry, leafMaterial);
    bar.scale.set(.24, 17, .10);
    bar.position.set(-7 + i * 3.4, 8, 3.4);
    bar.rotation.z = -.35;
    bar.castShadow = true;
    scene.add(bar);
  }

  let frame = 0, lastTime = 0, elapsed = 0, lastShadow = -1;
  let inView = true, disposed = false, contextLost = false;
  let pixelRatio = 1, frameCount = 0, frameCost = 0;
  let quality = "";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 640px)");
  const tablet = matchMedia("(max-width: 1024px)");

  function animateLeaves(time: number) {
    for (const { mesh, x, y, angle, phase } of leaves) {
      mesh.rotation.z = angle + .042 * Math.sin(time * .21 + phase) + .018 * Math.sin(time * .137 + phase * 2);
      mesh.rotation.y = .16 + .07 * Math.sin(time * .173 + phase);
      mesh.position.x = x + .045 * Math.sin(time * .159 + phase);
      mesh.position.y = y + .018 * Math.sin(time * .233 + phase * 1.7);
    }
    foliage.rotation.z = -.42 + .012 * Math.sin(time * .11);
    sun.intensity = 2.1 + .012 * Math.sin(time * .097);
  }

  function render(now: number) {
    frame = 0;
    if (disposed || contextLost || !inView || document.hidden) return;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .1) : 0;
    lastTime = now;
    if (!reducedMotion.matches) elapsed += delta;
    animateLeaves(reducedMotion.matches ? 0 : elapsed);
    // Shadows need only 24–30 Hz for this almost imperceptible breeze.
    if (elapsed - lastShadow > (mobile.matches ? 1 / 24 : 1 / 30) || reducedMotion.matches) {
      renderer.shadowMap.needsUpdate = true;
      lastShadow = elapsed;
    }
    const start = performance.now();
    renderer.render(scene, camera);
    // Sustained slow frames reduce fill rate once, rather than oscillating quality.
    frameCost += Math.max(performance.now() - start, delta * 1000);
    if (++frameCount === 180) {
      if (frameCost / frameCount > 23 && pixelRatio > 1) {
        pixelRatio = 1;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(host.clientWidth, host.clientHeight, false);
      }
      frameCost = 0;
      frameCount = 0;
    }
    if (!reducedMotion.matches) frame = requestAnimationFrame(render);
  }

  function wake() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    lastShadow = -1;
    if (!disposed && !contextLost && inView && !document.hidden) frame = requestAnimationFrame(render);
  }

  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    const nextQuality = mobile.matches ? "mobile" : tablet.matches ? "tablet" : "desktop";
    pixelRatio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (quality !== nextQuality) {
      quality = nextQuality;
      const resolution = mobile.matches ? 512 : 1024;
      sun.shadow.mapSize.set(resolution, resolution);
      sun.shadow.map?.dispose();
      sun.shadow.mapPass?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapPass = null;
      leaves.forEach(({ mesh }, index) => {
        mesh.visible = index < (mobile.matches ? 30 : tablet.matches ? 50 : 70);
      });
    }
    wake();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    canvas.style.visibility = "hidden";
    host.dataset.renderer = "fallback";
    cancelAnimationFrame(frame);
  }
  function onContextRestored() {
    contextLost = false;
    canvas.style.visibility = "";
    host.dataset.renderer = "webgl";
    resize();
  }

  host.appendChild(canvas);
  host.dataset.renderer = "webgl";
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    wake();
  });
  visibilityObserver.observe(host);
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("resize", resize);
  reducedMotion.addEventListener("change", wake);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  resize();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("resize", resize);
    reducedMotion.removeEventListener("change", wake);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    environmentMap.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    delete host.dataset.renderer;
  };
}
