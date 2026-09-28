import * as THREE from "three";

/**
 * Shared uniforms for every stone surface: the sun's leaf mask (light space) and, for the floor, the blurred
 * planar reflection.
 */
export interface StoneUniforms {
  uLeafNear: THREE.IUniform<THREE.Texture | null>;
  uLeafFar: THREE.IUniform<THREE.Texture | null>;
  uLightOrigin: THREE.IUniform<THREE.Vector3>;
  uLightU: THREE.IUniform<THREE.Vector3>;
  uLightV: THREE.IUniform<THREE.Vector3>;
  uLightRect: THREE.IUniform<THREE.Vector4>; // uMin, vMin, 1/width, 1/height
  uLeafStrength: THREE.IUniform<number>;
  uReflection: THREE.IUniform<THREE.Texture | null>;
  uReflectionSharp: THREE.IUniform<THREE.Texture | null>;
  uReflectionMatrix: THREE.IUniform<THREE.Matrix4>;
  uReflectionStrength: THREE.IUniform<number>;
}

export function createStoneUniforms(): StoneUniforms {
  return {
    uLeafNear: { value: null },
    uLeafFar: { value: null },
    uLightOrigin: { value: new THREE.Vector3() },
    uLightU: { value: new THREE.Vector3(1, 0, 0) },
    uLightV: { value: new THREE.Vector3(0, 1, 0) },
    uLightRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uLeafStrength: { value: 1 },
    uReflection: { value: null },
    uReflectionSharp: { value: null },
    uReflectionMatrix: { value: new THREE.Matrix4() },
    uReflectionStrength: { value: 1 },
  };
}

/**
 * MeshStandardMaterial with the environment's lighting model:
 *  - diffuse ambient comes only from the baked lightmap (sky + bounce, AO included); the IBL irradiance term is
 *    removed so ambient light isn't counted twice. Specular IBL (the in-scene panorama) stays.
 *  - the sun is a real DirectionalLight (correct diffuse and specular), scaled per pixel by the baked sun
 *    visibility (lightmap alpha: the architecture's soft shadows) and by the live foliage mask.
 *  - `reflective` surfaces (the floor) replace their specular IBL with a blurred planar reflection.
 */
export function stoneMaterial(
  params: THREE.MeshStandardMaterialParameters,
  uniforms: StoneUniforms,
  options: { reflective?: boolean; key: string },
) {
  const material = new THREE.MeshStandardMaterial(params);
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vEnvWorld;`)
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>\nvEnvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    const leafFn = /* glsl */ `
      varying vec3 vEnvWorld;
      uniform sampler2D uLeafNear;
      uniform sampler2D uLeafFar;
      uniform vec3 uLightOrigin;
      uniform vec3 uLightU;
      uniform vec3 uLightV;
      uniform vec4 uLightRect;
      uniform float uLeafStrength;
      uniform sampler2D uReflection;
      uniform sampler2D uReflectionSharp;
      uniform mat4 uReflectionMatrix;
      uniform float uReflectionStrength;
      float leafLight(vec3 p) {
        vec3 d = p - uLightOrigin;
        vec2 uv = (vec2(dot(d, uLightU), dot(d, uLightV)) - uLightRect.xy) * uLightRect.zw;
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 1.0;
        float nearC = texture2D(uLeafNear, uv).r;
        float farC = texture2D(uLeafFar, uv).g;
        return mix(1.0, (1.0 - nearC) * (1.0 - farC), uLeafStrength);
      }
    `;

    const lightsBegin = THREE.ShaderChunk.lights_fragment_begin.replace(
      "getDirectionalLightInfo( directionalLight, directLight );",
      "getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= envSun;",
    );

    let lightsMaps = THREE.ShaderChunk.lights_fragment_maps.replace(
      "iblIrradiance += getIBLIrradiance( geometryNormal );",
      "// ambient diffuse comes from the baked lightmap",
    );
    if (options.reflective) {
      lightsMaps = lightsMaps.replace(
        "radiance += iblRadiance;",
        /* glsl */ `
        {
          vec4 rc = uReflectionMatrix * vec4(vEnvWorld, 1.0);
          // Micro-relief of the stone breaks the reflection up a little, as polish on real stone does.
          vec2 ruv = rc.xy / rc.w + (normal.xy - geometryNormal.xy) * 0.035;
          vec3 soft = texture2D(uReflection, ruv).rgb;
          vec3 sharp = texture2D(uReflectionSharp, ruv).rgb;
          // Rougher texels (cracks, pores) see only the blurred reflection.
          float gloss = smoothstep(0.32, 0.12, material.roughness);
          vec3 planar = mix(soft, sharp, 0.35 * gloss);
          radiance += mix(iblRadiance, planar, uReflectionStrength);
        }`,
      );
    }

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${leafFn}`)
      .replace(
        "#include <lights_fragment_begin>",
        /* glsl */ `
        float envSun = texture2D(lightMap, vLightMapUv).a * leafLight(vEnvWorld);
        ${lightsBegin}`,
      )
      .replace("#include <lights_fragment_maps>", lightsMaps);
  };
  material.customProgramCacheKey = () => `marble-env-${options.key}-${options.reflective ? "r" : "s"}`;
  return material;
}
