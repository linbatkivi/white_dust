# ==========================================================================
# de_bureau · Blender-bygger (headless): luksus-bureauet øverst i et højhus om natten.
#   python3 tools/bureau/city.py && python3 tools/bureau/gen/gen.py        (teksturer/himmel + layout → out/bureau.json)
#   blender -b --factory-startup -P tools/bureau/build.py -- bake            → public/assets/bureau (lysmaps + world.bin/json)
#   blender -b --factory-startup -P tools/bureau/build.py -- clay            → kun geometri (out/bureau_clay.blend)
# Geometrien kommer fra gen/gen.py (rum, døre, vinduer, lameller, gelændere, indretning). Inventaret bages med (lys pr. hjørne)
# → rigtige kontaktskygger. Byen omkring (egne højhuse med oplyste vinduer) og nattehimlen er lavet i city.py.
# ==========================================================================
import os, sys, math, time, json, random, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'gen'))
import bpy, bmesh
from mathutils import Vector, Matrix
from bld import common
from bld.common import B, coll, OUT, MB, defmat, MATS, mat

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['clay']
MODE = ARGS[0]
TEX = os.path.join(HERE, 'cache', 'tex'); CITYT = os.path.join(HERE, 'cache', 'city')

# ---------------------------------------------------------------- materialer (navn = tekstur-id i spillet)
SCALE = {'terrazzo': 1.6, 'marble_floor': 2.0, 'carpet': 1.5, 'carpet_dark': 1.5, 'raised_floor': 1.2, 'concrete_floor': 3.0, 'concrete_old': 3.0,
         'asphalt': 4.0, 'steel_plate': 1.0, 'plaster': 2.5, 'arch_concrete': 3.0, 'block_wall': 2.5, 'concrete_wall': 3.0, 'metal_panel': 2.0,
         'ceiling_tile': 1.2, 'ceiling_tile2': 1.2, 'facade': 4.0, 'corrugated': 2.0, 'walnut_panel': 2.4, 'walnut': 1.6, 'marble_white': 2.4,
         'terrace': 2.4, 'plaster_warm': 3.0}
ROUGH = {'marble_white': 0.22, 'marble_floor': 0.25}                  # (spillets ARM-kort giver ruheden – disse bruges kun i bagningen)
def define():
    for n, sz in SCALE.items():
        f = {'d': os.path.join(TEX, n + '_albedo.jpg'), 'n': os.path.join(TEX, n + '_normal.jpg'), 'a': os.path.join(TEX, n + '_orm.jpg')}
        if os.path.exists(f['d']): defmat(n, tex=n, size=sz, files=f)
    defmat('walnut_slat', tex='walnut', size=1.6, files={'d': os.path.join(TEX, 'walnut_albedo.jpg'), 'n': os.path.join(TEX, 'walnut_normal.jpg'), 'a': os.path.join(TEX, 'walnut_orm.jpg')})
    defmat('lux_wall', tex='plaster_warm', size=3.0, files={'d': os.path.join(TEX, 'plaster_warm_albedo.jpg'), 'n': os.path.join(TEX, 'plaster_warm_normal.jpg'), 'a': os.path.join(TEX, 'plaster_warm_orm.jpg')})
    defmat('glass', kind='glass'); defmat('window', kind='glass'); defmat('glass_door', kind='glass')
    defmat('trim_metal', color=(0.16, 0.17, 0.18), rough=0.35, metal=0.9); defmat('mullion', color=(0.06, 0.065, 0.07), rough=0.32, metal=0.85)
    defmat('baseboard', color=(0.08, 0.08, 0.085), rough=0.45); defmat('door_leaf', color=(0.19, 0.2, 0.21), rough=0.38, metal=0.55)
    defmat('light_off', color=(0.5, 0.52, 0.55), rough=0.3)
    defmat('ceiling_paint', color=(0.74, 0.73, 0.70), rough=0.92)                   # v26: glat, malet gipsloft (kontorer) – lysmappet giver skyggerne
    defmat('light_panel', color=(0.95, 0.96, 1.0), emit=(0.95, 0.97, 1.0, 14.0)); defmat('light_strip', color=(0.95, 0.96, 1.0), emit=(0.9, 0.95, 1.0, 16.0))
    defmat('light_down', color=(1.0, 0.9, 0.75), emit=(1.0, 0.84, 0.64, 22.0)); defmat('exit_sign', color=(0.1, 0.8, 0.35), emit=(0.15, 1.0, 0.4, 10.0))
    defmat('beacon_red', color=(0.9, 0.1, 0.05), emit=(1.0, 0.08, 0.03, 14.0))
    for n in ('city_a', 'city_b', 'city_c', 'street'):
        defmat(n, tex=n, size=14.4 if n != 'street' else 120.0, unlit=True,
               files={'d': os.path.join(CITYT, n + '_albedo.jpg'), 'n': os.path.join(CITYT, n + '_normal.jpg'), 'a': os.path.join(CITYT, n + '_orm.jpg')})
    defmat('city_roof', color=(0.02, 0.022, 0.026), rough=0.9)

# ---------------------------------------------------------------- bygningen: generatorens flader → mesh-byggere
DETAIL = {'trim_metal', 'mullion', 'baseboard', 'door_leaf', 'walnut_slat', 'light_off', 'light_panel', 'light_strip', 'light_down', 'exit_sign', 'beacon_red'}
def load_gen():
    spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen', 'gen.py')); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g); return g
def building(G):
    walls, det = MB('walls'), MB('detail_trim')
    for k, f in enumerate(G.VIS.f):
        m = G.VIS.mat[k]
        if m == 'lux_wall': m = 'plaster_warm'
        pts = [G.VIS.v[i] for i in f]; sz = MATS[m].get('size') or 1.0
        uv = [(u / sz, v / sz) for (u, v) in G.VIS.uv[k]]
        (det if m in DETAIL else walls).poly(pts, m, uv=uv)
    walls.build(coll('walls')); det.build(coll('structures'))

# ---------------------------------------------------------------- inventar (Poly Haven + egne modeller), reduceret og bagt med
TARGET = {'covered_car': 6000, 'pachira_aquatica_01': 2600, 'sofa_02': 2400, 'sofa_03': 2400, 'modern_arm_chair_01': 1600, 'horse_statue_01': 3000,
          'bronze_shark_statue': 2400, 'marble_bust_01': 2400, 'steel_frame_shelves_03': 1400, 'street_lamp_01': 1400, 'exterior_aircon_unit': 1400,
          'classic_laptop': 500, 'desk_lamp_arm_01': 500, 'calathea_orbifolia_01': 1600, 'potted_plant_01': 1400, 'potted_plant_04': 1400,
          'korean_fire_extinguisher_01': 400, 'bookshelf': 1400, 'keyboard_mouse': 260, 'pallet': 500, 'office_chair': 700, 'server_rack': 500,
          'desk_pair': 700, 'reception_desk': 400, 'elevator_doors': 600, 'coffee_bar': 700, 'cable_tray': 280, 'security_camera_01': 400, 'wall_clock': 300, 'bar_chair_round_01': 700, 'metal_trash_can': 500,
          'flight_case': 3600, 'flight_case_s': 3400}
_lib = {}
def model_obj(path):
    if path in _lib: return _lib[path]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
    names = [o.name for o in new]
    if not meshes: _lib[path] = None; return None
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
    mid = os.path.splitext(os.path.basename(path))[0]
    if ob.data.shape_keys: ob.shape_key_clear()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons); tgt = TARGET.get(mid, 500)
    if tris > tgt * 1.15:
        md = ob.modifiers.new('dec', 'DECIMATE'); md.ratio = max(0.02, tgt / tris); md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=md.name)
    if '/custom/' in path:                                                         # v26: lange kanter deles (≤ 0,3 m), så vertex-lyset har målepunkter midt på fladerne
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(ob.data)
        for _ in range(4):
            long = [e for e in bm.edges if e.calc_length() > 0.3]
            if not long: break
            _bm.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
        bm.to_mesh(ob.data); bm.free()
    for i, m in enumerate(ob.data.materials):                                       # materialer → spillets navne (tekstur-id eller farve)
        if m is None: continue
        if 'glass' in m.name.lower(): ob.data.materials[i] = mat('glass'); continue
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
                if not src or not os.path.exists(src):                               # indlejret i .glb: gem billedet ud
                    src = os.path.join(OUT, 'modeltex', name + '.png'); os.makedirs(os.path.dirname(src), exist_ok=True)
                    img.filepath_raw = src; img.file_format = 'PNG'; img.save()
                files = {'d': src, 'n': None, 'a': None}
            MATS[name] = {'tex': name if files else None, 'tint': (1, 1, 1), 'rough': bs.inputs['Roughness'].default_value if bs else 0.6,
                          'metal': bs.inputs['Metallic'].default_value if bs else 0.0, 'size': None, 'kind': 'opaque', 'emit': None,
                          'color': None if files else col, 'files': files, 'model': True, 'unlit': False, 'nrm': False, 'arm': False}
            if bs and bs.inputs['Emission Strength'].default_value > 0.5 and not files:
                ec = tuple(bs.inputs['Emission Color'].default_value)[:3]; MATS[name]['emit'] = (*ec, min(12.0, bs.inputs['Emission Strength'].default_value))
        m.name = name
    for c in list(ob.users_collection): c.objects.unlink(ob)
    coll('lib').objects.link(ob); ob.hide_render = True
    vs = [v.co for v in ob.data.vertices]; mnz = min(v.z for v in vs)
    _lib[path] = (ob, mnz); return _lib[path]
def furnish(props):
    n = 0; t0 = time.time()
    for p in props:
        rel = p['m'].replace('res://assets/models/custom/', 'cache/custom/').replace('res://assets/models/', 'cache/models/')
        path = os.path.join(HERE, rel)
        if not os.path.exists(path): continue
        L = model_obj(path)
        if not L: continue
        ob0, mnz = L; ob = ob0.copy(); ob.hide_render = False; n += 1; ob.name = 'props_%d' % n
        x, y, z = p['p']; custom = '/custom/' in rel
        loc = B(x, y if custom else y - mnz, z)                                  # Poly Haven: laveste punkt på gulvet (ingen svævere)
        ob.location = loc; ob.rotation_euler = (0, 0, math.radians(p['yaw']))
        coll('props').objects.link(ob)
    print('[bureau] inventar: %d stk., %d modeller, %.0f s' % (n, len(_lib), time.time() - t0))

# ---------------------------------------------------------------- byen omkring: højhuse med oplyste vinduer, gader 110 m nede, flylys
def city():
    rnd = random.Random(5); M = MB('city'); STREET = -112.0
    for k in range(150):
        a = rnd.uniform(0, math.tau); r = rnd.uniform(95, 520)
        x, z = math.cos(a) * r, math.sin(a) * r
        w, d = rnd.uniform(18, 42), rnd.uniform(18, 42)
        top = STREET + rnd.uniform(60, 120) + (rnd.uniform(40, 170) if rnd.random() < 0.35 else 0)
        if r < 160: top = min(top, rnd.uniform(-20, 25))                          # nærmeste naboer: lavere, så udsigten er fri
        m = rnd.choice(('city_a', 'city_b', 'city_c'))
        x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
        M.box(x0, STREET, z0, x1, top, z1, m, faces='nsew'); M.box(x0, top, z0, x1, top + 0.3, z1, 'city_roof', faces='t')
        if top > STREET + 90:                                                      # flylys på de høje
            M.box(x0 + 1, top + 1.5, z0 + 1, x0 + 1.6, top + 2.1, z0 + 1.6, 'beacon_red'); M.box(x1 - 1.6, top + 1.5, z1 - 1.6, x1 - 1, top + 2.1, z1 - 1, 'beacon_red')
    M.grid(-700, -700, 700, 700, STREET, 'street', step=140.0)
    M.build(coll('city'))

# ---------------------------------------------------------------- lys (gen.LIGHTS) og nattehimmel
POWER = {'down': 16.0, 'emergency': 14.0, 'exit': 2.5, 'panel': 30.0, 'linear': 28.0, 'highbay': 220.0, 'server': 140.0, 'ring': 45.0, 'atrium': 260.0, 'street': 120.0}
COLOR = {'down': (1.0, 0.8, 0.58), 'emergency': (1.0, 0.12, 0.06), 'exit': (0.2, 1.0, 0.45), 'panel': (1.0, 0.95, 0.88), 'linear': (0.92, 0.96, 1.0),
         'highbay': (1.0, 0.92, 0.8), 'server': (0.55, 0.75, 1.0), 'ring': (1.0, 0.86, 0.66), 'atrium': (1.0, 0.88, 0.74), 'street': (1.0, 0.72, 0.45)}
def lights(L):
    for k, l in enumerate(L):
        kind = l['kind']
        if kind in ('street', 'down'): ld = bpy.data.lights.new('L%d' % k, 'SPOT'); ld.spot_size = math.radians(120 if kind == 'street' else 95); ld.spot_blend = 0.55; ld.shadow_soft_size = 0.05
        elif kind in ('emergency', 'exit'): ld = bpy.data.lights.new('L%d' % k, 'POINT'); ld.shadow_soft_size = 0.05
        elif kind == 'ring': ld = bpy.data.lights.new('L%d' % k, 'POINT'); ld.shadow_soft_size = 0.25          # v26: atriets lysring
        else:
            ld = bpy.data.lights.new('L%d' % k, 'AREA'); ld.shape = 'RECTANGLE'
            ld.size, ld.size_y = {'panel': (0.6, 1.2), 'linear': (0.18, 1.5), 'highbay': (0.5, 0.5), 'server': (0.16, 2.4), 'atrium': (0.9, 0.9)}.get(kind, (0.5, 0.5))
        ld.energy = POWER.get(kind, 30.0) * (0.45 if l.get('dark') else 1.0); ld.color = COLOR.get(kind, (1, 1, 1))
        ob = bpy.data.objects.new('L%d' % k, ld); coll('lamps').objects.link(ob); ob.location = B(l['x'], l['y'] - 0.02, l['z'])
def night_world():
    sc = bpy.context.scene; w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True; nt = w.node_tree
    bg = nt.nodes['Background']; env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(os.path.join(HERE, 'cache', 'sky', 'night.hdr')); nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = float(os.environ.get('BU_SKY', 3.0))
def game_sky(dst):
    import shutil
    os.makedirs(dst, exist_ok=True); shutil.copy(os.path.join(HERE, 'cache', 'sky', 'night.hdr'), os.path.join(dst, 'sky.hdr'))
    json.dump({'sunDir': [0.35, 0.55, -0.76], 'sunIrr': [0, 0, 0], 'skyIrr': [0.02, 0.02, 0.025], 'elev': 33.0, 'night': True}, open(os.path.join(dst, 'sky.json'), 'w'))

def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    define(); G = load_gen(); print('[bureau] generator %.1f s' % (time.time() - t0))
    building(G); furnish(G.PROPS); city(); print('[bureau] geometri %.1f s' % (time.time() - t0))
    lights(G.LIGHTS); night_world()
    lc = bpy.data.collections.get('lib')
    if lc: lc.hide_render = True
    if MODE == 'bake':
        from bld import bake
        game_sky(bake.DST)
        bake.bake_all(); print('[bureau] bagt %.1f s' % (time.time() - t0))
        if os.environ.get('BU_SAVE'): bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'bureau_baked.blend'))
        if lc:
            for o in list(lc.objects): bpy.data.objects.remove(o, do_unlink=True)
        bake.export(); print('[bureau] eksporteret %.1f s' % (time.time() - t0))
        json.dump({'props': G.PROPS, 'lights': G.LIGHTS}, open(os.path.join(OUT, 'bureau_props.json'), 'w'))
        # lygternes glorier/glans i regnen (night.js): kun lamperne udenfor på tagterrassen
        out = []                                                                    # (lygternes glorier lignede en måne på himlen – fra)
        json.dump({'lights': out}, open(os.path.join(bake.DST, 'lights.json'), 'w'))
    else:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'bureau_clay.blend'))

main()
