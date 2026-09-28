# Marble environment — assets and licences

Every file in this folder is generated from scripts in this repository. No third-party texture, HDRI, model or
photograph is used. The reference image that guided the art direction is **not** used as a texture or anywhere else.

| File | What it is | Source | Licence |
| --- | --- | --- | --- |
| `textures/terrazzo_{albedo,rough,normal}.webp` | Tileable polished terrazzo (aggregate, crackle, pores) | `frontend/environment/generate_textures.py` (seeded numpy noise / Voronoi) | Project-original |
| `textures/stucco_{albedo,rough,normal}.webp` | Tileable honed marble-plaster for walls and ceiling | same script | Project-original |
| `scene.glb` | Architecture and floor, bevelled, two UV sets (tiling + lightmap) | `frontend/environment/blender/build_scene.py` (Blender 5.2 LTS, `bpy`) | Project-original |
| `lightmap_architecture.webp`, `lightmap_floor.webp` | Cycles bakes: RGB = sky + bounce irradiance, A = sun visibility | same script | Project-original |
| `panorama.hdr` | Equirectangular HDR rendered from inside the scene (specular IBL) | same script | Project-original |
| `scene.json` | Camera, sun and lightmap constants shared by the bake and the runtime | same script | Project-original |
| `poster-wide.webp`, `poster-tall.webp` | Stills of the final runtime scene (fallback and loading state) | `frontend/environment/capture.mjs` (lab route) | Project-original |
| `review/*.png` | Review screenshots and score history | `frontend/environment/capture.mjs` | Project-original |

Tools: Blender (GPL; its output is not covered by the GPL), Three.js (MIT). Why no Poly Haven / ambientCG assets:
the build environment cannot reach those hosts, and generated stone gives full control over tone (no clipped whites)
and scale with zero licence risk. CC0 scans could be swapped in later through the same material slots.
