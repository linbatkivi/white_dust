# ==========================================================================
# de_niseko · CC0-modeller (Poly Haven, glTF): import, reduktion og placering. Materialer → spillets 'm_<tekstur>' (kun albedo; normal/ORM mangler bevidst).
# ==========================================================================
import os, math
import bpy
from mathutils import Vector
from bld.common import B, coll, OUT, MATS, mat, defmat

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = {'wine_barrel_01': 2200, 'planter_box_01': 1800, 'planter_box_02': 2000, 'planter_box_03': 2200, 'boulder_01': 5000, 'namaqualand_boulder_02': 5000, 'namaqualand_boulder_03': 5000,
          'namaqualand_boulder_05': 4000, 'wooden_crate_01': 700, 'wooden_crate_02': 700, 'ceramic_pot': 900, 'jug_01': 900, 'tea_set_01': 3000, 'wooden_bowl_01': 900,
          'watering_can_metal_01': 1200, 'brass_pot_01': 900, 'vintage_electric_kettle': 1600, 'rock_moss_set_01': 3500, 'rock_moss_set_02': 3000, 'stone_01': 1800, 'rock_09': 1200, 'rock_07': 1400,
          'ceramic_vase_01': 900, 'ceramic_vase_02': 900, 'ceramic_vase_04': 900, 'antique_ceramic_vase_01': 1400, 'chinese_tea_table': 1800, 'folding_wooden_stool': 900, 'wooden_stool_01': 900,
          'wooden_bucket_01': 900, 'wooden_bucket_02': 900, 'wicker_basket_01': 1200, 'wicker_basket_02': 1400, 'planter_pot_clay': 900, 'tree_stump_01': 2200, 'fern_02': 2500, 'wooden_ladder': 1200,
          'painted_wooden_bench': 1600, 'wooden_lantern_01': 1500, 'flower_gazania': 1500, 'periwinkle_plant': 1500}
_lib = {}
def model_obj(mid):
    if mid in _lib: return _lib[mid]
    path = os.path.join(HERE, 'cache', 'models', mid, mid + '.gltf')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
    names = [o.name for o in new]
    if not meshes: _lib[mid] = None; return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for nm in names:
        o = bpy.data.objects.get(nm)
        if o and o != ob: bpy.data.objects.remove(o, do_unlink=True)
    if ob.data.shape_keys: ob.shape_key_clear()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons); tgt = TARGET.get(mid, 1200)
    if tris > tgt * 1.15:
        md = ob.modifiers.new('dec', 'DECIMATE'); md.ratio = max(0.02, tgt / tris); md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=md.name)
    import bmesh as _bm
    bm = _bm.new(); bm.from_mesh(ob.data)
    for _ in range(2):                                           # lange kanter deles (≤ 0,5 m): vertex-lys får målepunkter
        long = [e for e in bm.edges if e.calc_length() > 0.5]
        if not long: break
        _bm.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    bm.to_mesh(ob.data); bm.free()
    for i, m in enumerate(ob.data.materials):
        if m is None: continue
        img = None
        if m.use_nodes:
            img = next((n.image for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and ('diff' in n.image.name.lower() or 'col' in n.image.name.lower() or 'base' in n.image.name.lower())), None) \
                or next((n.image for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        bs = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
        col = tuple(bs.inputs['Base Color'].default_value)[:3] if bs else (0.6, 0.6, 0.6)
        name = 'm_' + (os.path.splitext(img.name)[0] if img else m.name).split('.')[0].lower().replace(' ', '_')
        if name not in MATS:
            files = None
            if img:
                src = bpy.path.abspath(img.filepath) if img.filepath else None
                if not src or not os.path.exists(src):
                    src = os.path.join(OUT, 'modeltex', name + '.png'); os.makedirs(os.path.dirname(src), exist_ok=True); img.filepath_raw = src; img.file_format = 'PNG'; img.save()
                files = {'d': src, 'n': None, 'a': None}
            MATS[name] = {'tex': name if files else None, 'tint': (1, 1, 1), 'rough': bs.inputs['Roughness'].default_value if bs else 0.6, 'metal': bs.inputs['Metallic'].default_value if bs else 0.0,
                          'size': None, 'kind': 'opaque', 'emit': None, 'color': None if files else col, 'files': files, 'model': True, 'unlit': False, 'nrm': False, 'arm': False, 'alpha': False}
        ex = bpy.data.materials.get(name)
        if ex is not None and ex is not m: ob.data.materials[i] = ex; continue
        m.name = name
    for c in list(ob.users_collection): c.objects.unlink(ob)
    coll('lib').objects.link(ob); ob.hide_render = True; ob.hide_viewport = True
    vs = [v.co for v in ob.data.vertices]; mnz = min(v.z for v in vs); mxz = max(v.z for v in vs)
    bb = (min(v.x for v in vs), max(v.x for v in vs), min(v.y for v in vs), max(v.y for v in vs))
    _lib[mid] = (ob, mnz, mxz, bb); return _lib[mid]

_n = [0]
def place(mid, x, y, z, yaw=0.0, s=1.0, sx=None, sy=None, sz=None):
    """modellen med laveste punkt på y. yaw i grader (om lodret akse). Returnerer (objekt, højde, bb) eller None"""
    L = model_obj(mid)
    if not L: return None
    ob0, mnz, mxz, bb = L; ob = ob0.copy(); ob.data = ob0.data; ob.hide_render = False; ob.hide_viewport = False; _n[0] += 1; ob.name = 'props_m%d' % _n[0]
    ob.rotation_mode = 'XYZ'; ob.scale = (sx or s, sy or s, sz or s); ob.rotation_euler = (0, 0, math.radians(yaw)); ob.location = B(x, y - mnz * (sz or s), z)
    coll('props').objects.link(ob); return ob, (mxz - mnz) * (sz or s), bb
