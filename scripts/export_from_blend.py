"""Export the exhibition blend to glTF for the web walkthrough.

Opens the .blend1 read-only. Bakes procedural wood and floor materials to
images, writes public/models/exhibition.glb and scene.json, and does not
save the Blender file.
"""

import json
import math
import addon_utils
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

BLEND = Path(r"M:\2 Project\2026_ELCHK\1. Rendering\2026_ELCHK_exhibition_setup_SEP.blend1")
ROOT = Path(r"M:\2 Project\2026_ELCHK\3. Software Dev\elchk_exhibition_web")
MODEL_DIR = ROOT / "public" / "models"
TEX_DIR = MODEL_DIR / "textures"

FLOOR_MAT = "Staggered timber floor - procedural"
BIRCH_MAT = "Light birch display boxes"
PINE_MAT = "Car photo - warm pine"
BAKE_MATERIALS = (FLOOR_MAT, BIRCH_MAT, PINE_MAT)

# Six unique regions of a generated-coordinate bake, keyed by (axis, sign).
GENERATED_CELLS = {
    (0, 1): (0, 1),
    (0, -1): (1, 1),
    (1, 1): (2, 1),
    (1, -1): (0, 0),
    (2, 1): (1, 0),
    (2, -1): (2, 0),
}


def to_three(v):
    return [round(float(v.x), 4), round(float(v.z), 4), round(float(-v.y), 4)]


def principled(mat):
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node
    raise RuntimeError(f"{mat.name} has no Principled BSDF")


def coord_source(mat):
    for link in mat.node_tree.links:
        if link.from_node.type == "TEX_COORD":
            return link.from_socket.name.upper()
    return "OTHER"


def material_users(mat):
    users = []
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.name.startswith("BakeProxy"):
            continue
        for slot in obj.material_slots:
            if slot.material == mat:
                users.append(obj)
                break
    return users


def apply_modifiers():
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = []
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not obj.modifiers:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        new_mesh = bpy.data.meshes.new_from_object(
            evaluated, preserve_all_data_layers=True, depsgraph=depsgraph
        )
        baked.append((obj, new_mesh))
    for obj, new_mesh in baked:
        old = obj.data
        obj.modifiers.clear()
        obj.data = new_mesh
        if old.users == 0:
            bpy.data.meshes.remove(old)
    print(f"Applied modifiers on {len(baked)} meshes")


def ensure_uv(mesh):
    while len(mesh.uv_layers) > 1:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    layer = mesh.uv_layers[0]
    layer.name = "UVMap"
    mesh.uv_layers.active = layer
    return layer


def generated_face_uv(obj):
    mesh = obj.data
    if not mesh.vertices:
        return
    layer = ensure_uv(mesh)
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    mn = (min(xs), min(ys), min(zs))
    size = (
        max(max(xs) - mn[0], 1e-8),
        max(max(ys) - mn[1], 1e-8),
        max(max(zs) - mn[2], 1e-8),
    )
    inset = 0.05
    for poly in mesh.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        sign = 1 if normal[axis] >= 0 else -1
        col, row = GENERATED_CELLS[(axis, sign)]
        others = [i for i in range(3) if i != axis]
        a, b = others
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            ga = (co[a] - mn[a]) / size[a]
            gb = (co[b] - mn[b]) / size[b]
            u = (col + inset + ga * (1 - 2 * inset)) / 3.0
            v = (row + inset + gb * (1 - 2 * inset)) / 2.0
            layer.data[li].uv = (u, v)


def floor_top_uv(obj):
    mesh = obj.data
    layer = ensure_uv(mesh)
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    top = max(zs)
    dx = max(maxx - minx, 1e-8)
    dy = max(maxy - miny, 1e-8)
    for poly in mesh.polygons:
        center_z = sum(mesh.vertices[i].co.z for i in poly.vertices) / len(poly.vertices)
        for li in poly.loop_indices:
            if center_z >= top - 0.04:
                co = mesh.vertices[mesh.loops[li].vertex_index].co
                layer.data[li].uv = ((co.x - minx) / dx, (co.y - miny) / dy)
            else:
                layer.data[li].uv = (0.0, 0.0)


def new_image(name, size, noncolor=False):
    image = bpy.data.images.new(name, width=size, height=size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name)
    path = TEX_DIR / f"{safe}.png"
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    return image


def save_image(image):
    image.save()
    print(f"  saved {image.filepath_raw}")


def sample_pixel(image, u, v):
    w, h = image.size
    x = min(w - 1, max(0, int(u * (w - 1))))
    y = min(h - 1, max(0, int(v * (h - 1))))
    i = (y * w + x) * 4
    px = image.pixels
    return [round(px[i + k], 3) for k in range(3)]


def add_image_node(mat, image, name, location):
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.name = name
    node.label = name
    node.image = image
    node.location = location
    return node


def activate_image_node(mat, node):
    for other in mat.node_tree.nodes:
        other.select = False
    node.select = True
    mat.node_tree.nodes.active = node


def select_only(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bake_diffuse(obj, mat, node):
    activate_image_node(mat, node)
    select_only(obj)
    bpy.context.view_layer.update()
    bpy.ops.object.bake(type="DIFFUSE")


def bake_normal(obj, mat, node):
    activate_image_node(mat, node)
    select_only(obj)
    bpy.context.view_layer.update()
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")


def connect_base_color(mat, tex_node):
    tree = mat.node_tree
    socket = principled(mat).inputs["Base Color"]
    for link in list(socket.links):
        tree.links.remove(link)
    tree.links.new(tex_node.outputs["Color"], socket)


def connect_normal(mat, tex_node):
    tree = mat.node_tree
    socket = principled(mat).inputs["Normal"]
    for link in list(socket.links):
        tree.links.remove(link)
    normal_map = tree.nodes.new("ShaderNodeNormalMap")
    normal_map.space = "TANGENT"
    normal_map.location = (-300, -280)
    tree.links.new(tex_node.outputs["Color"], normal_map.inputs["Color"])
    tree.links.new(normal_map.outputs["Normal"], socket)


def make_proxy(mat):
    mesh = bpy.data.meshes.new("BakeProxyMesh")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("BakeProxy", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def prepare_color_management():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    bake = scene.render.bake
    bake.use_pass_color = True
    bake.use_pass_direct = False
    bake.use_pass_indirect = False
    bake.use_selected_to_active = False
    bake.use_clear = True
    bake.margin = 2


def bake_generated_material(mat_name, size):
    mat = bpy.data.materials[mat_name]
    source = coord_source(mat)
    print(f"Baking {mat_name} ({source}) at {size}")
    if source not in {"GENERATED", "OTHER"}:
        print(f"  note: texture coordinate is {source}, proxy bake still used for generated-style mapping")
    users = material_users(mat)
    print(f"  users {len(users)}")
    image = new_image(mat_name + " albedo", size, noncolor=False)
    node = add_image_node(mat, image, "BakedAlbedo", (-700, 200))
    proxy = make_proxy(mat)
    generated_face_uv(proxy)
    seen = set()
    for obj in users:
        key = obj.data.as_pointer()
        if key in seen:
            continue
        seen.add(key)
        generated_face_uv(obj)
    bpy.context.scene.render.bake.margin = 2
    bake_diffuse(proxy, mat, node)
    mid = sample_pixel(image, 0.5, 0.25)
    print(f"  albedo sample {mid}")
    if sum(mid) < 0.02:
        raise RuntimeError(f"{mat_name} bake looks empty: {mid}")
    connect_base_color(mat, node)
    save_image(image)
    bpy.data.objects.remove(proxy, do_unlink=True)
    return image


def bake_floor():
    mat = bpy.data.materials[FLOOR_MAT]
    users = material_users(mat)
    if len(users) != 1:
        raise RuntimeError(f"Expected one floor object, found {len(users)}")
    floor = users[0]
    print(f"Baking floor on {floor.name} coord {coord_source(mat)}")
    floor_top_uv(floor)
    size = 4096
    albedo = new_image(FLOOR_MAT + " albedo", size, noncolor=False)
    albedo_node = add_image_node(mat, albedo, "BakedAlbedo", (-700, 220))
    bpy.context.scene.render.bake.margin = 0
    bake_diffuse(floor, mat, albedo_node)
    mid = sample_pixel(albedo, 0.5, 0.5)
    print(f"  albedo sample {mid}")
    if sum(mid) < 0.02:
        raise RuntimeError(f"Floor bake looks empty: {mid}")
    connect_base_color(mat, albedo_node)
    save_image(albedo)

    bpy.context.scene.view_settings.view_transform = "Raw"
    normal = new_image(FLOOR_MAT + " normal", size, noncolor=True)
    normal_node = add_image_node(mat, normal, "BakedNormal", (-700, -80))
    bpy.context.scene.render.bake.margin = 0
    bake_normal(floor, mat, normal_node)
    print(f"  normal sample {sample_pixel(normal, 0.5, 0.5)}")
    connect_normal(mat, normal_node)
    save_image(normal)
    bpy.context.scene.view_settings.view_transform = "Standard"


def emission_info(mat):
    if not mat.node_tree:
        return None
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            strength_socket = node.inputs.get("Emission Strength")
            color_socket = node.inputs.get("Emission Color")
            if strength_socket and not strength_socket.is_linked and strength_socket.default_value > 0.01:
                color = color_socket.default_value if color_socket else (1, 1, 1, 1)
                return {
                    "material": mat.name,
                    "strength": round(float(strength_socket.default_value), 4),
                    "color": [round(float(color[0]), 4), round(float(color[1]), 4), round(float(color[2]), 4)],
                    "textured": bool(color_socket and color_socket.is_linked),
                }
        if node.type == "EMISSION":
            strength_socket = node.inputs.get("Strength")
            color_socket = node.inputs.get("Color")
            strength = float(strength_socket.default_value) if strength_socket and not strength_socket.is_linked else 1.0
            if color_socket and color_socket.is_linked:
                color = [1.0, 1.0, 1.0]
                textured = True
            else:
                raw = color_socket.default_value if color_socket else (1, 1, 1, 1)
                color = [round(float(raw[0]), 4), round(float(raw[1]), 4), round(float(raw[2]), 4)]
                textured = False
            return {
                "material": mat.name,
                "strength": round(strength, 4),
                "color": color,
                "textured": textured,
            }
    return None


def camera_record(obj):
    pos = obj.matrix_world.translation
    forward = obj.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    target = pos + forward
    return {
        "name": obj.name,
        "type": obj.data.type,
        "position": to_three(pos),
        "lookAt": to_three(target),
    }


def light_record(obj):
    data = obj.data
    pos = obj.matrix_world.translation
    direction = obj.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    color = data.color
    return {
        "name": obj.name,
        "shape": data.shape,
        "energy": round(float(data.energy), 4),
        "color": [round(float(color[0]), 4), round(float(color[1]), 4), round(float(color[2]), 4)],
        "size": round(float(data.size), 4),
        "sizeY": round(float(getattr(data, "size_y", data.size)), 4),
        "threePosition": to_three(pos),
        "threeDirection": to_three(direction),
    }


def collect_scene():
    world = bpy.context.scene.world
    background = world.node_tree.nodes["Background"]
    bg = background.inputs[0].default_value
    spawn = camera_record(bpy.data.objects["02 Manny and Fung interior"])
    emissive = []
    for mat in bpy.data.materials:
        info = emission_info(mat)
        if info:
            emissive.append(info)
    return {
        "space": "three-y-up",
        "source": str(BLEND),
        "world": {
            "color": [round(float(bg[0]), 4), round(float(bg[1]), 4), round(float(bg[2]), 4)],
            "strength": round(float(background.inputs[1].default_value), 4),
        },
        "spawn": spawn,
        "cameras": [camera_record(obj) for obj in bpy.data.objects if obj.type == "CAMERA"],
        "lights": [light_record(obj) for obj in bpy.data.objects if obj.type == "LIGHT"],
        "emissive": emissive,
        "skipCollisionCollections": ["07 Lighting", "08 Cameras"],
        "skipCollisionNameIncludes": ["suspension", "diffuser", "strip light"],
    }


def tag_collections():
    for obj in bpy.data.objects:
        cols = [col.name for col in obj.users_collection]
        if cols:
            obj["elchk_collection"] = cols[0]


def export_glb(path):
    addon_utils.enable("io_scene_gltf2")
    props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    kwargs = {
        "filepath": str(path),
        "export_format": "GLB",
        "export_apply": True,
        "export_extras": True,
        "export_cameras": False,
        "export_lights": False,
        "export_yup": True,
        "export_texcoords": True,
        "export_normals": True,
        "export_materials": "EXPORT",
        "use_selection": False,
    }
    filtered = {key: value for key, value in kwargs.items() if key in props}
    missing = sorted(set(kwargs) - set(filtered))
    if missing:
        print("GLTF exporter skipped unsupported options:", ", ".join(missing))
    print("Exporting", path)
    bpy.ops.export_scene.gltf(**filtered)


def main():
    if Path(bpy.data.filepath).resolve() != BLEND.resolve():
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    print("Opened", bpy.data.filepath)
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    scene_data = collect_scene()
    prepare_color_management()
    apply_modifiers()
    bake_floor()
    bake_generated_material(BIRCH_MAT, 1024)
    bake_generated_material(PINE_MAT, 1024)
    for obj in list(bpy.data.objects):
        if obj.name.startswith("BakeProxy"):
            bpy.data.objects.remove(obj, do_unlink=True)
    tag_collections()
    glb_path = MODEL_DIR / "exhibition.glb"
    export_glb(glb_path)
    scene_path = MODEL_DIR / "scene.json"
    scene_path.write_text(json.dumps(scene_data, indent=2), encoding="utf-8")
    print("EXPORT_OK", glb_path, glb_path.stat().st_size)
    print("SCENE_OK", scene_path)
    # Do not save the blend.


if __name__ == "__main__":
    main()
