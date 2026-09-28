import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

/** Separable Gaussian (13 taps, spacing scaled to sigma) used for the leaf mask and the floor reflection. */
export function createBlur() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tInput: { value: null },
      uDirection: { value: new THREE.Vector2() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tInput;
      uniform vec2 uDirection;
      varying vec2 vUv;
      void main() {
        vec4 sum = texture2D(tInput, vUv) * 0.1370;
        // Weights of a Gaussian sampled at 1..6 steps of sigma/3.
        float w[6] = float[](0.1296, 0.1098, 0.0832, 0.0563, 0.0341, 0.0185);
        for (int i = 0; i < 6; i++) {
          vec2 o = uDirection * float(i + 1);
          sum += (texture2D(tInput, vUv + o) + texture2D(tInput, vUv - o)) * w[i];
        }
        gl_FragColor = sum;
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);

  /** Blur `source` into `target` (via `temp`) with a Gaussian of `sigma` texels (of the target's size). */
  function run(renderer: THREE.WebGLRenderer, source: THREE.Texture, temp: THREE.WebGLRenderTarget,
    target: THREE.WebGLRenderTarget, sigma: number) {
    const step = sigma / 3;
    material.uniforms.tInput.value = source;
    material.uniforms.uDirection.value.set(step / temp.width, 0);
    renderer.setRenderTarget(temp);
    quad.render(renderer);
    material.uniforms.tInput.value = temp.texture;
    material.uniforms.uDirection.value.set(0, step / target.height);
    renderer.setRenderTarget(target);
    quad.render(renderer);
  }

  return {
    run,
    dispose() {
      material.dispose();
      quad.dispose();
    },
  };
}

/** Last pass: a whisper of vignette and film grain, as in a photograph. Runs on display-referred colour. */
export const FinishShader = {
  name: "FinishShader",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.012 },
    uVignette: { value: 0.16 },
    uAspect: { value: 1.6 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
      c.rgb *= v;
      // Luminance-weighted grain, strongest in the mid-tones; static per frame position, not per pixel column.
      float n = hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5;
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += n * uGrain * (1.0 - abs(l * 2.0 - 1.0) * 0.6);
      gl_FragColor = c;
    }`,
};
