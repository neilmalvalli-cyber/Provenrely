import * as THREE from "three";

/**
 * Off-camera foliage, as the sun sees it.
 *
 * The leaves are never part of the visible scene: they live in their own scene, drawn by an orthographic camera
 * that looks along the sunlight, into a coverage mask ("light space"). Surfaces then look up that mask to decide
 * how much sun reaches them. So the leaves can't enter the frame or its reflections, and the shadows move only
 * because real geometry moves: boughs sway, twigs bend and leaves flutter in a vertex shader.
 *
 * Light space: x = u, y = v (metres, in the plane perpendicular to the sunlight), z = -depth. Depth is the leaf's
 * distance in front of the receivers, which decides its layer: near leaves (R channel) cast crisp shadows,
 * the far canopy (G channel) casts broad, soft ones.
 */

export type FoliageLayer = "near" | "far";

type Rand = () => number;

function mulberry32(seed: number): Rand {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A limb as the sun sees it: a curved, tapering stroke from `from` towards `to`, with a wind hierarchy. */
interface Limb {
  a: THREE.Vector2;
  c: THREE.Vector2; // quadratic Bézier control point
  b: THREE.Vector2;
  w0: number;
  w1: number;
  layer: FoliageLayer;
  bough: THREE.Vector3; // (base u, base v, phase) of the bough this limb belongs to
  twig: THREE.Vector3; // (base u, base v, phase) of this limb itself
  sway: number; // how much this limb follows the wind (thin, long limbs more)
}

interface Leaf {
  pos: THREE.Vector2;
  angle: number;
  size: number;
  layer: FoliageLayer;
  bough: THREE.Vector3;
  twig: THREE.Vector3;
  phase: number;
  sway: number;
}

export interface CanopyTarget {
  /** Where the cluster's shadow should fall, in light space (see `LightSpace.project`). */
  at: THREE.Vector2;
  /** Where its bough comes from: outside the visible area, like a tree just out of frame. */
  from: THREE.Vector2;
  layer: FoliageLayer;
  spread: number;
  density: number;
  leafSize: number;
}

const bezier = (l: Limb, t: number, out = new THREE.Vector2()) => {
  const it = 1 - t;
  return out.set(
    it * it * l.a.x + 2 * it * t * l.c.x + t * t * l.b.x,
    it * it * l.a.y + 2 * it * t * l.c.y + t * t * l.b.y,
  );
};

function grow(targets: CanopyTarget[], seed: number) {
  const rand = mulberry32(seed);
  const limbs: Limb[] = [];
  const leaves: Leaf[] = [];
  const range = (lo: number, hi: number) => lo + (hi - lo) * rand();

  const addLeafSpray = (at: THREE.Vector2, dir: number, size: number, count: number, layer: FoliageLayer,
    bough: THREE.Vector3, twig: THREE.Vector3, sway: number) => {
    // Compound leaf: a short rachis with paired leaflets and a terminal one (ash/rowan-like silhouette).
    for (let i = 0; i < count; i++) {
      const along = (i >> 1) / Math.max(1, count >> 1);
      const side = i % 2 ? 1 : -1;
      const p = new THREE.Vector2(Math.cos(dir), Math.sin(dir)).multiplyScalar(along * size * 2.4).add(at);
      const angle = dir + side * range(0.7, 1.15) + range(-0.18, 0.18);
      leaves.push({ pos: p, angle, size: size * range(0.75, 1.1), layer, bough, twig, phase: rand() * 100, sway });
    }
    const tip = new THREE.Vector2(Math.cos(dir), Math.sin(dir)).multiplyScalar(size * 2.6).add(at);
    leaves.push({ pos: tip, angle: dir + range(-0.15, 0.15), size: size * 1.1, layer, bough, twig, phase: rand() * 100, sway });
  };

  const branch = (from: THREE.Vector2, to: THREE.Vector2, width: number, layer: FoliageLayer, depth: number,
    bough: THREE.Vector3 | null, t: CanopyTarget) => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const normal = new THREE.Vector2(-dir.y, dir.x).normalize();
    const c = from.clone().addScaledVector(dir, 0.5).addScaledVector(normal, range(-0.18, 0.18) * len);
    const twig = new THREE.Vector3(from.x, from.y, rand() * 100);
    const limb: Limb = {
      a: from.clone(), c, b: to.clone(), w0: width, w1: width * 0.45, layer,
      bough: bough ?? twig, twig, sway: Math.min(1, 0.25 + depth * 0.3),
    };
    limbs.push(limb);
    if (depth >= 4 || width < 0.006) {
      // Twig: a spray of compound leaves along its last part.
      const sprays = Math.round(range(3, 5) * t.density);
      for (let i = 0; i < sprays; i++) {
        const s = range(0.35, 1.0);
        const p = bezier(limb, s);
        const tangent = bezier(limb, Math.min(1, s + 0.02)).sub(bezier(limb, Math.max(0, s - 0.02)));
        const a = Math.atan2(tangent.y, tangent.x) + (rand() < 0.5 ? 1 : -1) * range(0.4, 1.0);
        addLeafSpray(p, a, t.leafSize, 2 * Math.round(range(2, 4)) + 1, layer, limb.bough, twig, limb.sway);
      }
      return;
    }
    const children = depth < 2 ? 3 : 2 + Math.round(rand() * t.density);
    for (let i = 0; i < children; i++) {
      const s = range(0.45, 0.95);
      const p = bezier(limb, s);
      const heading = Math.atan2(dir.y, dir.x) + (i % 2 ? 1 : -1) * range(0.35, 0.85);
      // Children lean towards the target's cluster, so the shadow lands where the composition needs it.
      const toTarget = t.at.clone().sub(p);
      const pull = Math.atan2(toTarget.y, toTarget.x);
      const h = heading * 0.6 + pull * 0.4 + range(-0.3, 0.3);
      const l = len * range(0.45, 0.7);
      const end = new THREE.Vector2(Math.cos(h), Math.sin(h)).multiplyScalar(l).add(p);
      branch(p, end, width * range(0.5, 0.65), layer, depth + 1, limb.bough, t);
    }
    // Leaves along the outer half of mid-size limbs too, as on a real bough.
    if (depth >= 2) {
      for (let i = 0; i < Math.round(2 * t.density); i++) {
        const p = bezier(limb, range(0.5, 1));
        addLeafSpray(p, range(0, Math.PI * 2), t.leafSize * 0.9, 5, layer, limb.bough, twig, limb.sway);
      }
    }
  };

  for (const t of targets) {
    const dir = t.at.clone().sub(t.from);
    const len = dir.length();
    // The bough ends a little short of the target; its children fill the cluster around it.
    const end = t.from.clone().addScaledVector(dir, 1 - (t.spread * 0.6) / len);
    branch(t.from, end, t.layer === "near" ? 0.05 : 0.09, t.layer, 0, null, t);
  }
  return { limbs, leaves };
}

// --- Geometry -----------------------------------------------------------------------------------------------------

function limbGeometry(limbs: Limb[], layer: FoliageLayer) {
  const pos: number[] = [];
  const bough: number[] = [];
  const twig: number[] = [];
  const weight: number[] = [];
  const index: number[] = [];
  const seg = 10;
  const p = new THREE.Vector2();
  const q = new THREE.Vector2();
  for (const l of limbs) {
    if (l.layer !== layer) continue;
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      bezier(l, t, p);
      bezier(l, Math.min(1, t + 0.01), q);
      if (i === seg) bezier(l, t - 0.01, q).sub(p).negate().add(p);
      const d = q.sub(p).normalize();
      const w = THREE.MathUtils.lerp(l.w0, l.w1, t) * 0.5;
      for (const s of [-1, 1]) {
        pos.push(p.x - d.y * w * s, p.y + d.x * w * s, 0);
        bough.push(l.bough.x, l.bough.y, l.bough.z);
        twig.push(l.twig.x, l.twig.y, l.twig.z);
        weight.push(l.sway);
      }
      if (i < seg) {
        const k = base + i * 2;
        index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aBough", new THREE.Float32BufferAttribute(bough, 3));
  g.setAttribute("aTwig", new THREE.Float32BufferAttribute(twig, 3));
  g.setAttribute("aSway", new THREE.Float32BufferAttribute(weight, 1));
  g.setIndex(index);
  return g;
}

/** One leaflet outline, 1 m long along +x from the petiole at the origin; slightly asymmetric, finely serrated. */
function leafletShape() {
  const shape = new THREE.Shape();
  const n = 22;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.26 * (1 - 0.25 * t);
    const serr = i % 2 ? 0.012 : 0;
    pts.push(new THREE.Vector2(t, w + serr));
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const w = Math.sin(Math.PI * Math.pow(t, 0.85)) * 0.22 * (1 - 0.2 * t);
    const serr = i % 2 ? 0.01 : 0;
    pts.push(new THREE.Vector2(t, -(w + serr)));
  }
  shape.setFromPoints(pts);
  return new THREE.ShapeGeometry(shape, 1);
}

function leafMesh(leaves: Leaf[], layer: FoliageLayer, material: THREE.ShaderMaterial) {
  const list = leaves.filter((l) => l.layer === layer);
  const base = leafletShape();
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  const place = new Float32Array(list.length * 4); // u, v, angle, size
  const bough = new Float32Array(list.length * 3);
  const twig = new Float32Array(list.length * 3);
  const extra = new Float32Array(list.length * 2); // phase, sway
  list.forEach((l, i) => {
    place.set([l.pos.x, l.pos.y, l.angle, l.size], i * 4);
    bough.set([l.bough.x, l.bough.y, l.bough.z], i * 3);
    twig.set([l.twig.x, l.twig.y, l.twig.z], i * 3);
    extra.set([l.phase, l.sway], i * 2);
  });
  g.setAttribute("aPlace", new THREE.InstancedBufferAttribute(place, 4));
  g.setAttribute("aBough", new THREE.InstancedBufferAttribute(bough, 3));
  g.setAttribute("aTwig", new THREE.InstancedBufferAttribute(twig, 3));
  g.setAttribute("aLeaf", new THREE.InstancedBufferAttribute(extra, 2));
  g.instanceCount = list.length;
  base.dispose();
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  return mesh;
}

// --- Wind ---------------------------------------------------------------------------------------------------------

const windGlsl = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  uniform vec2 uWindDir;

  float wHash(float n) { return fract(sin(n) * 43758.5453123); }
  // 1D gradient noise: smooth, never periodic, so the motion never visibly loops.
  float wNoise(float x) {
    float i = floor(x), f = fract(x);
    float g0 = wHash(i) * 2.0 - 1.0, g1 = wHash(i + 1.0) * 2.0 - 1.0;
    float u = f * f * (3.0 - 2.0 * f);
    return mix(g0 * f, g1 * (f - 1.0), u) * 2.0;
  }
  // Slow, irregular gusts that travel across the canopy (a front moving along the wind direction).
  float gust(vec2 at) {
    float t = uTime * 0.045 - dot(at, uWindDir) * 0.035;
    float g = 0.5 + 0.5 * wNoise(t) + 0.25 * wNoise(t * 2.7 + 13.1);
    return 0.35 + 0.65 * smoothstep(0.15, 1.1, g);
  }
  vec2 rotateAbout(vec2 p, vec2 pivot, float a) {
    vec2 d = p - pivot;
    float c = cos(a), s = sin(a);
    return pivot + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  }
  vec2 sway(vec2 p, vec3 bough, vec3 twig, float weight) {
    float g = gust(bough.xy) * uWind;
    // Boughs: long, slow; twigs: quicker and smaller, each on its own phase.
    float boughAngle = g * 0.010 * (wNoise(uTime * 0.11 + bough.z) + 0.6 * wNoise(uTime * 0.043 + bough.z * 1.7));
    float twigAngle = g * weight * 0.028 * (wNoise(uTime * 0.29 + twig.z) + 0.5 * wNoise(uTime * 0.71 + twig.z * 2.3));
    p = rotateAbout(p, twig.xy, twigAngle);
    p = rotateAbout(p, bough.xy, boughAngle);
    return p;
  }
`;

function foliageMaterial(layer: FoliageLayer, kind: "limb" | "leaf", uniforms: Record<string, THREE.IUniform>) {
  const channel = layer === "near" ? "vec4(c, 0.0, 0.0, 1.0)" : "vec4(0.0, c, 0.0, 1.0)";
  // Leaves let a little light through; wood doesn't.
  const coverage = kind === "leaf" ? 0.9 : 1.0;
  const vertex = kind === "limb"
    ? /* glsl */ `
      attribute vec3 aBough; attribute vec3 aTwig; attribute float aSway;
      ${windGlsl}
      void main() {
        vec2 p = sway(position.xy, aBough, aTwig, aSway);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, position.z, 1.0);
      }`
    : /* glsl */ `
      attribute vec4 aPlace; attribute vec3 aBough; attribute vec3 aTwig; attribute vec2 aLeaf;
      ${windGlsl}
      void main() {
        float g = gust(aBough.xy) * uWind;
        // Flutter: the leaflet turns about its petiole and its blade twists (foreshortening its silhouette).
        float flutter = g * (0.09 * wNoise(uTime * 0.37 + aLeaf.x) + 0.05 * wNoise(uTime * 0.83 + aLeaf.x * 1.9));
        float twist = 1.0 - g * 0.22 * (0.5 + 0.5 * wNoise(uTime * 0.19 + aLeaf.x * 3.1));
        float a = aPlace.z + flutter;
        vec2 local = vec2(position.x, position.y * twist) * aPlace.w;
        vec2 p = aPlace.xy + vec2(cos(a) * local.x - sin(a) * local.y, sin(a) * local.x + cos(a) * local.y);
        p = sway(p, aBough, aTwig, aLeaf.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
      }`;
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: `void main() { float c = ${coverage.toFixed(2)}; gl_FragColor = ${channel}; }`,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    // Per-channel max: overlapping leaves saturate, and near/far layers never overwrite each other.
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
}

/** A straight, thick limb (a trunk or main stem) given directly in light space: the long, soft diagonal bands. */
export interface Trunk {
  from: THREE.Vector2;
  to: THREE.Vector2;
  width: number;
  layer: FoliageLayer;
}

export function createFoliage(targets: CanopyTarget[], trunks: Trunk[], seed: number) {
  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uWindDir: { value: new THREE.Vector2(1, -0.35).normalize() },
  };
  const { limbs, leaves } = grow(targets, seed);
  for (const t of trunks) {
    const base = new THREE.Vector3(t.from.x, t.from.y, (t.from.x * 7.13) % 100);
    const mid = t.from.clone().lerp(t.to, 0.5).add(new THREE.Vector2(0.15, -0.1));
    limbs.push({ a: t.from.clone(), c: mid, b: t.to.clone(), w0: t.width, w1: t.width * 0.7, layer: t.layer,
      bough: base, twig: base, sway: 0.08 });
  }
  const scene = new THREE.Scene();
  const materials: THREE.Material[] = [];
  for (const layer of ["far", "near"] as FoliageLayer[]) {
    const limbMat = foliageMaterial(layer, "limb", uniforms);
    const leafMat = foliageMaterial(layer, "leaf", uniforms);
    materials.push(limbMat, leafMat);
    const limbMesh = new THREE.Mesh(limbGeometry(limbs, layer), limbMat);
    limbMesh.frustumCulled = false;
    scene.add(limbMesh, leafMesh(leaves, layer, leafMat));
  }
  return {
    scene,
    uniforms,
    counts: { limbs: limbs.length, leaves: leaves.length },
    dispose() {
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
    },
  };
}
