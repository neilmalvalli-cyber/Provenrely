"""Marble environment: scene, lightmap bakes and in-scene panorama, fully scripted (Blender 5.2 LTS, headless).

  pip install bpy==5.2.2 numpy scipy pillow        # bpy 5.2 wheels need Python 3.13
  python build_scene.py preview                    # quick Cycles still from the runtime camera (composition check)
  python build_scene.py bake [--samples 384]       # GLB + lightmaps + panorama → ../../public/environment/

Units are metres, Blender is Z-up (glTF export converts to three.js Y-up: (x, y, z) → (x, z, -y)).
Every constant the runtime depends on (camera, sun, lightmap scales) is written to scene.json next to the GLB,
so the Blender scene and the Three.js runtime can't drift apart.

Lighting split (see PROGRESS.md "Marble environment"):
  lightmap RGB  = everything except the sun's direct light: sky light and all bounce light (sun bounce included),
                  so baked AO and contact shadowing come for free;
  sunvis        = how much of the sun disc each texel sees past the architecture (soft penumbrae);
  the runtime adds direct sun from a real DirectionalLight × sunvis × a live foliage-only shadow map.
"""

import json
import math
import os
import sys

import bpy  # noqa: I001  (bpy must be imported before bmesh/mathutils)
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "../../public/environment"))

# --- Scene constants (shared with the runtime through scene.json) -----------------------------------------------
CAMERA = {"location": (0.9, -9.0, 1.0), "target": (0.9, 0.0, 0.62), "fov_deg": 40.0}
# Low, warm late-afternoon sun from the front left; shadows rake across the wall towards the lower right.
SUN = {"azimuth_deg": 52.0, "elevation_deg": 27.0, "strength": 5.2, "color": (1.0, 0.86, 0.70), "angle_deg": 1.4}
SKY_ZENITH = (0.42, 0.47, 0.78)  # cool lavender-blue: the shadows' colour
SKY_HORIZON = (0.78, 0.76, 0.82)
SKY_GROUND = (0.34, 0.31, 0.30)  # warm ground bounce from outside the room
SKY_STRENGTH = 0.85

STONE_ALBEDO = (0.74, 0.725, 0.69)  # mean linear albedo of the generated textures (bounce colour)
TILE = {"terrazzo": 1.0, "stucco": 1.6}  # metres per texture repeat


def sun_direction():
    """Unit vector towards the sun. Azimuth is measured from -Y (behind the camera) towards -X (camera left)."""
    az, el = math.radians(SUN["azimuth_deg"]), math.radians(SUN["elevation_deg"])
    return Vector((-math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))


# --- Geometry -----------------------------------------------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def box(name, size, center, bevel=0.012, segments=3, material="stone", rot=0.0):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = center
    obj.rotation_euler.z = rot
    bpy.context.collection.objects.link(obj)
    obj["material"] = material
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    return obj


def fluted_panel(name, x0, x1, y, z0, z1, depth, flutes, material="stone"):
    """A slab whose camera-facing side is a row of concave flutes (like a fluted column shaft laid flat)."""
    width = (x1 - x0) / flutes
    ring = 10
    verts, faces = [], []
    prof = []
    for f in range(flutes):
        for k in range(ring + (1 if f == flutes - 1 else 0)):
            t = k / ring
            x = x0 + (f + t) * width
            # Concave semicircle, with a thin flat arris between flutes that catches the light.
            u = min(max((t - 0.06) / 0.88, 0.0), 1.0)
            prof.append((x, y - depth * 0.5 + math.sin(u * math.pi) * width * 0.34))
    n = len(prof)
    for z in (z0, z1):
        for x, yy in prof:
            verts.append((x, yy, z))
    for i in range(n - 1):
        faces.append((i, i + 1, n + i + 1, n + i))
    # Back and caps so the slab is closed (it casts and receives in the bakes).
    back = len(verts)
    verts += [(x0, y + depth * 0.5, z0), (x1, y + depth * 0.5, z0), (x1, y + depth * 0.5, z1), (x0, y + depth * 0.5, z1)]
    faces.append((back + 1, back, back + 3, back + 2))
    faces.append((0, n, back + 3, back))  # left side
    faces.append((n - 1, back + 1, back + 2, 2 * n - 1))  # right side
    faces.append(tuple(range(n - 1, -1, -1)) + (back, back + 1))  # bottom
    faces.append(tuple(range(n, 2 * n)) + (back + 2, back + 3))  # top
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.shade_smooth()
    mesh.set_sharp_from_angle(angle=math.radians(40))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["material"] = material
    return obj


def build_architecture():
    parts = []
    # Main wall, square to the camera: long, calm, the canvas for the leaf shadows.
    parts.append(box("wall", (14.0, 0.5, 6.0), (-5.0, 0.25, 3.0), bevel=0.02, material="stucco"))
    # Portico to the right: two square pillars under a low ceiling, a sunlit back wall beyond.
    parts.append(box("pillar_a", (0.95, 0.95, PORTICO_H), (2.26, -0.3, PORTICO_H / 2), bevel=0.018))
    parts.append(box("pillar_b", (0.9, 0.9, PORTICO_H), (4.04, 2.2, PORTICO_H / 2), bevel=0.018))
    parts.append(box("ceiling", (14.0, 13.0, 0.45), (9.0, 4.8, PORTICO_H + 0.225), bevel=0.02, material="stucco"))
    parts.append(box("back_wall", (14.0, 0.5, PORTICO_H), (9.0, 10.5, PORTICO_H / 2), bevel=0.0, material="stucco"))
    # Three low platforms stepping up to the right, turned against the wall so their edges run diagonally
    # through the lower right of the frame. Each tread is a separate slab with its own bevelled nosing.
    pivot = Vector((0.7, 0.0, 0.0))
    for i in range(3):
        h = 0.19
        inset = (0.0, 1.15, 1.9)[i]
        length = 15.0 - i * 1.4  # along the platform (towards the camera)
        local = Vector((inset + 7.0, -length / 2 + 2.0, 0.0))
        c = pivot + Matrix.Rotation(STEP_ROT, 3, "Z") @ local
        parts.append(box(f"step_{i}", (14.0, length, h), (c.x, c.y, h * (i + 0.5)), bevel=0.014, rot=STEP_ROT))
    # Fluted screen at the far right, nearer the camera, standing on the top platform.
    fl = fluted_panel("flutes", -1.3, 1.3, 0.0, 0.57, PORTICO_H, 0.3, 16)
    fl.location = (4.6, -1.9, 0.0)
    fl.rotation_euler.z = math.radians(-66)
    parts.append(fl)
    return parts


PORTICO_H = 4.3
STEP_ROT = math.radians(15)


def build_floor():
    """A single plane: one face, so its planar lightmap has no overlapping islands."""
    mesh = bpy.data.meshes.new("floor")
    x0, x1, y0, y1 = -19.0, 15.0, -15.0, 11.0
    mesh.from_pydata([(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new("floor", mesh)
    bpy.context.collection.objects.link(obj)
    obj["material"] = "terrazzo_floor"
    return obj


# --- UVs ----------------------------------------------------------------------------------------------------------
def box_uv(obj, tile):
    """Metric box mapping into UV 0: the stone texture has the same physical scale on every face."""
    mesh = obj.data
    uv = mesh.uv_layers.new(name="uv")
    for poly in mesh.polygons:
        n = poly.normal
        axis = max(range(3), key=lambda a: abs(n[a]))
        for li in poly.loop_indices:
            co = obj.matrix_world @ mesh.vertices[mesh.loops[li].vertex_index].co
            if axis == 0:
                u, v = co.y, co.z
            elif axis == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            uv.data[li].uv = (u / tile, v / tile)


def lightmap_uv(obj, margin):
    mesh = obj.data
    lm = mesh.uv_layers.new(name="lightmap")
    mesh.uv_layers.active = lm
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=margin, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=margin, rotate=True, shape_method="CONCAVE")
    bpy.ops.object.mode_set(mode="OBJECT")


def floor_lightmap_uv(obj, extent):
    """The floor is one slab: planar mapping of its top over the region the camera (and its reflections) sees."""
    mesh = obj.data
    lm = mesh.uv_layers.new(name="lightmap")
    (x0, x1), (y0, y1) = extent
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            co = obj.matrix_world @ mesh.vertices[mesh.loops[li].vertex_index].co
            lm.data[li].uv = ((co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0))
    mesh.uv_layers.active = lm


# --- Materials and world ------------------------------------------------------------------------------------------
def stone_material(name, roughness, specular=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*STONE_ALBEDO, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    return mat


def assign_materials(objects):
    mats = {
        "stone": stone_material("stone", 0.34),
        "stucco": stone_material("stucco", 0.62),
        "terrazzo_floor": stone_material("terrazzo_floor", 0.16),
    }
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(mats[obj["material"]])
    return mats


def world(scene):
    w = bpy.data.worlds.new("sky")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    geo = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(geo.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    # Generated coordinates for the world are the view direction; Z in [-1, 1].
    mapr = nt.nodes.new("ShaderNodeMapRange")
    mapr.inputs["From Min"].default_value = -1
    mapr.inputs["From Max"].default_value = 1
    nt.links.new(sep.outputs["Z"], mapr.inputs["Value"])
    nt.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.44, (*SKY_GROUND, 1)
    els[1].position, els[1].color = 1.0, (*SKY_ZENITH, 1)
    mid = els.new(0.52)
    mid.color = (*SKY_HORIZON, 1)
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = SKY_STRENGTH
    nt.links.new(bg.outputs[0], out.inputs[0])
    return bg


def add_sun():
    data = bpy.data.lights.new("sun", "SUN")
    data.energy = SUN["strength"]
    data.color = SUN["color"]
    data.angle = math.radians(SUN["angle_deg"])
    obj = bpy.data.objects.new("sun", data)
    bpy.context.collection.objects.link(obj)
    d = sun_direction()
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()  # sun lamps shine along their local -Z
    return obj


def add_camera(scene):
    cam = bpy.data.cameras.new("camera")
    cam.angle = math.radians(CAMERA["fov_deg"])
    cam.sensor_fit = "VERTICAL"
    obj = bpy.data.objects.new("camera", cam)
    bpy.context.collection.objects.link(obj)
    obj.location = CAMERA["location"]
    direction = Vector(CAMERA["target"]) - Vector(CAMERA["location"])
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = obj
    return obj


def cycles(scene, samples):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 5
    scene.cycles.glossy_bounces = 4
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.sample_clamp_indirect = 8.0
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"


# --- Bakes --------------------------------------------------------------------------------------------------------
def bake_pass(objects, image, bake_type, pass_filter, samples):
    scene = bpy.context.scene
    scene.cycles.samples = samples
    for obj in objects:
        for mat in obj.data.materials:
            nt = mat.node_tree
            node = nt.nodes.get("bake_target") or nt.nodes.new("ShaderNodeTexImage")
            node.name = "bake_target"
            node.image = image
            nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    scene.render.bake.normal_space = "OBJECT"  # all objects have identity transforms: object = world space
    scene.render.bake.margin = 6
    scene.render.bake.use_clear = True
    kwargs = {"type": bake_type, "margin": 6, "use_clear": True}
    if pass_filter is not None:
        kwargs["pass_filter"] = pass_filter
    bpy.ops.object.bake(**kwargs)
    px = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    return px.reshape(image.size[1], image.size[0], 4)


def denoise(img, coverage, sigma):
    """Normalised Gaussian in UV space: smooths path-tracing noise without bleeding across empty texels."""
    from scipy.ndimage import gaussian_filter

    w = gaussian_filter(coverage.astype(np.float32), sigma)
    out = np.stack([gaussian_filter(img[..., c] * coverage, sigma) for c in range(img.shape[-1])], -1)
    return np.where(w[..., None] > 1e-4, out / np.maximum(w[..., None], 1e-4), img)


def srgb_encode(linear):
    c = np.clip(linear, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def write_lightmap(ambient, sunvis, path):
    """RGB = ambient irradiance (sRGB-encoded / scale, for precision in the shadows); A = sun visibility (linear)."""
    from PIL import Image

    scale = float(np.percentile(ambient[..., :3], 99.8)) * 1.02
    rgb = srgb_encode(ambient[..., :3] / scale)
    rgba = np.concatenate([rgb, np.clip(sunvis[..., None], 0, 1)], -1)
    img = (np.flipud(rgba) * 255 + 0.5).astype(np.uint8)  # Blender image rows start at the bottom
    Image.fromarray(img, "RGBA").save(path, quality=92, alpha_quality=95, method=6)
    return scale


def bake_group(name, objects, size, samples, world_bg, sun, sigma):
    img = bpy.data.images.new(f"bake_{name}", size, size, float_buffer=True, alpha=True)
    # 1) everything, 2) sun only, direct only → ambient = 1 - 2. 3) sun visibility from its direct light and normals.
    full = bake_pass(objects, img, "DIFFUSE", {"DIRECT", "INDIRECT"}, samples)
    coverage = full[..., 3] > 0.5
    strength = world_bg.inputs["Strength"].default_value
    world_bg.inputs["Strength"].default_value = 0.0
    sun_direct = bake_pass(objects, img, "DIFFUSE", {"DIRECT"}, max(64, samples // 3))
    world_bg.inputs["Strength"].default_value = strength
    normals = bake_pass(objects, img, "NORMAL", None, 1)[..., :3] * 2 - 1
    ambient = np.clip(full[..., :3] - sun_direct[..., :3], 0, None)
    ambient = denoise(ambient, coverage, sigma)
    # Cycles' diffuse "light" pass is radiance per unit albedo = E_sun · N·L · vis / π (colour-weighted).
    sun_dir = np.array(sun_direction())
    ndl = np.clip((normals * sun_dir).sum(-1), 0, 1)
    lum = sun_direct[..., :3].mean(-1)
    expected = SUN["strength"] * np.mean(SUN["color"]) * ndl / math.pi
    vis = np.where(ndl > 0.03, np.clip(lum / np.maximum(expected, 1e-6), 0, 1), 0.0)
    vis = denoise(vis[..., None], coverage, 0.8)[..., 0]
    scale = write_lightmap(ambient, vis, os.path.join(OUT, f"lightmap_{name}.webp"))
    return scale


def render_panorama(scene, samples):
    """Equirectangular HDR from inside the portico: the scene's own reflections for specular IBL."""
    cam = bpy.data.cameras.new("pano")
    cam.type = "PANO"
    cam.panorama_type = "EQUIRECTANGULAR"
    obj = bpy.data.objects.new("pano", cam)
    bpy.context.collection.objects.link(obj)
    obj.location = (2.2, -4.0, 1.4)
    obj.rotation_euler = Euler((math.radians(90), 0, 0))  # looking along +Y (into the scene)
    previous = scene.camera
    scene.camera = obj
    scene.cycles.samples = samples
    scene.render.resolution_x, scene.render.resolution_y = 1024, 512
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "HDR"
    path = os.path.join(OUT, "panorama.hdr")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    scene.camera = previous
    scene.view_settings.view_transform = "AgX"
    bpy.data.objects.remove(obj)
    return path


def export_glb(objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        obj.data.uv_layers.active = obj.data.uv_layers["uv"]
        # Drop bake nodes so the exporter writes plain named materials (the runtime owns the shading).
        for mat in obj.data.materials:
            n = mat.node_tree.nodes.get("bake_target")
            if n:
                mat.node_tree.nodes.remove(n)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",  # names only (plain Principled, no images): the runtime maps them to shaders
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


# --- Main ---------------------------------------------------------------------------------------------------------
def build(scene):
    arch = build_architecture()
    floor = build_floor()
    for obj in arch + [floor]:
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            with bpy.context.temp_override(object=obj):
                bpy.ops.object.modifier_apply(modifier=mod.name)
    # One mesh per material keeps draw calls low; the architecture shares one lightmap atlas.
    for obj in arch:
        box_uv(obj, TILE["stucco"] if obj["material"] == "stucco" else TILE["terrazzo"])
    box_uv(floor, TILE["terrazzo"])
    bpy.ops.object.select_all(action="DESELECT")
    for obj in arch:
        obj.select_set(True)
    materials = {o.name: o["material"] for o in arch}
    bpy.context.view_layer.objects.active = arch[0]
    assign_materials(arch + [floor])
    bpy.ops.object.join()
    architecture = bpy.context.view_layer.objects.active
    architecture.name = "architecture"
    architecture["material"] = "mixed"
    lightmap_uv(architecture, 0.004)
    floor_lightmap_uv(floor, FLOOR_LM_EXTENT)
    return architecture, floor, materials


# Floor region with its own lightmap: what the camera and the floor reflections can see.
FLOOR_LM_EXTENT = ((-10.0, 12.0), (-10.0, 10.5))


# Reference points for "project" mode (screen x, y from bottom-left) while blocking out the composition.
PROBES = {
    "pillar_a base-left/right": [(1.785, -0.775, 0.57), (2.735, -0.775, 0.57)],
    "pillar_b base-left/right": [(3.59, 1.75, 0.57), (4.49, 1.75, 0.57)],
    "flutes base": [(3.6, -2.3, 0.57)],
    "wall end": [(2.0, 0.0, 0.0)],
}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    samples = int(sys.argv[sys.argv.index("--samples") + 1]) if "--samples" in sys.argv else 384
    scene = reset()
    architecture, floor, _ = build(scene)
    world_bg = world(scene)
    sun = add_sun()
    add_camera(scene)
    cycles(scene, samples)
    os.makedirs(OUT, exist_ok=True)

    if mode == "project":
        from bpy_extras.object_utils import world_to_camera_view

        scene.render.resolution_x, scene.render.resolution_y = 1024, 576
        bpy.context.view_layer.update()
        for name, pts in PROBES.items():
            print(name, [tuple(round(c, 3) for c in world_to_camera_view(scene, scene.camera, Vector(p))[:2]) for p in pts])
        return

    if mode == "preview":
        scene.cycles.samples = int(samples) if "--samples" in sys.argv else 48
        scene.render.resolution_x, scene.render.resolution_y = 1024, 576
        scene.render.image_settings.file_format = "PNG"
        scene.render.filepath = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "/tmp/preview.png"
        bpy.ops.render.render(write_still=True)
        return

    arch_scale = bake_group("architecture", [architecture], 2048, samples, world_bg, sun, 1.2)
    floor_scale = bake_group("floor", [floor], 2048, samples, world_bg, sun, 1.6)
    render_panorama(scene, max(128, samples // 2))
    export_glb([architecture, floor], os.path.join(OUT, "scene.glb"))

    d = sun_direction()
    to_three = lambda v: [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]  # noqa: E731
    meta = {
        "generator": f"Blender {bpy.app.version_string} · build_scene.py",
        "camera": {
            "position": to_three(CAMERA["location"]),
            "target": to_three(CAMERA["target"]),
            "fovDeg": CAMERA["fov_deg"],
        },
        "sun": {
            "direction": to_three(d),
            "intensity": SUN["strength"],
            "color": list(SUN["color"]),
            "angleDeg": SUN["angle_deg"],
        },
        # Cycles' diffuse light pass is radiance / albedo; three.js lightmaps are irradiance → × π.
        "lightmaps": {
            "architecture": {"file": "lightmap_architecture.webp", "intensity": round(arch_scale * math.pi, 5)},
            "floor": {"file": "lightmap_floor.webp", "intensity": round(floor_scale * math.pi, 5)},
        },
        "panorama": "panorama.hdr",
        "materials": {"architecture": "stone/stucco by material slot", "floor": "terrazzo_floor"},
    }
    with open(os.path.join(OUT, "scene.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
