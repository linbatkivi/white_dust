# ==========================================================================
# fattoria · Blender-bygger (headless): toscansk vingård på en bakketop i den gyldne time – layout fra tools/fattoria/gen/layout.py.
#   python3 tools/fattoria/gen/layout.py                                                           (layout → out/fattoria_design.json + shared/fattoria_data.js)
#   blender -b --factory-startup -P tools/fattoria/build.py -- clay                                (kun geometri → out/fattoria_clay.blend)
#   blender -b --factory-startup -P tools/fattoria/build.py -- shots [navn,navn]                   (prøvebilleder → out/shots/*.png)
#   blender -b --factory-startup -P tools/fattoria/build.py -- qa                                  (QA: svævende/usynligt)
#   blender -b --factory-startup -P tools/fattoria/build.py -- bake                                (lysmaps + world.bin/json → public/assets/fattoria)
# ==========================================================================
import os, sys, math, time, json, random
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from bld import common
from bld.common import B, coll, OUT, MB, defmat, MATS, mat
import ft_common, ft_ground

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['clay']
MODE = ARGS[0]
D = json.load(open(os.path.join(HERE, 'out', 'fattoria_design.json')))
MODS = {}
for nm in ('ft_arch', 'ft_props', 'ft_plants', 'ft_dress', 'ft_back'):
    try: MODS[nm] = __import__(nm)
    except ImportError as e: print('[build] modul mangler:', nm, e)

def subdivide_long(ob, thr):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for _ in range(2 if thr > 2 else 3):
        long = [e for e in bm.edges if e.calc_length() > thr]
        if not long: break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    bm.to_mesh(ob.data); bm.free()

def build_world():
    t0 = time.time(); ft_common.define(defmat)
    S = {k: MB(n) for k, n in (('bd', 'detail_far_bd'), ('ground', 'ground'), ('walls', 'walls'), ('ceil', 'ceil'), ('trim', 'detail_trim'), ('far', 'detail_far'), ('water', 'water'), ('props', 'props'), ('bark', 'props_bark'), ('fol', 'props_fol'))}
    S['lights'] = []
    G = ft_ground.Grid(D); S['G'] = G
    ft_ground.tops(G, S['ground'], S['trim']); ft_ground.hill_top(G, S['ground']); ft_ground.faces(G, S['walls'])
    ft_ground.overlays(G, S['ground'], S['trim'], S['ceil']); ft_ground.ramps(G, S['ground'], S['walls']); ft_ground.stairs(G, S['trim'], S['walls'])
    for nm in ('ft_arch', 'ft_props', 'ft_plants', 'ft_dress', 'ft_back'):
        m = MODS.get(nm)
        if m: m.build(D, S)
    print('[fattoria] geometri %.1f s' % (time.time() - t0))
    cols = {'bd': 'backdrop', 'ground': 'ground', 'walls': 'walls', 'ceil': 'ceil', 'trim': 'structures', 'far': 'structures', 'water': 'water', 'props': 'props', 'bark': 'props', 'fol': 'props'}
    obs = {}
    for k, M in S.items():
        if k in ('lights', 'G') or not hasattr(M, 'f') or not M.f: continue
        obs[k] = M.build(coll(cols[k]), bevel=0.0)
    if 'far' in obs: subdivide_long(obs['far'], 1.6)
    TRIS = lambda ob: sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if 'fol' in obs: subdivide_long(obs['fol'], 2.8)
    print('[fattoria] trekanter:', {k: TRIS(o) for k, o in obs.items()}, 'i alt', sum(TRIS(o) for o in obs.values()))
    return S, obs

def setup_preview_world(strength=1.0, sun=3.0):
    sc = bpy.context.scene; w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.62, 0.72, 0.9, 1); bg.inputs['Strength'].default_value = strength
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = sun; ld.angle = math.radians(1.5); o = bpy.data.objects.new('sun', ld); sc.collection.objects.link(o)
    o.rotation_euler = (math.radians(68), math.radians(8), math.radians(-52))
    sc.view_settings.view_transform = 'AgX'

SHOTS = {
    'iso': dict(pos=(0, 150, 105), look=(0, 0, -2), lens=36),
    'isoN': dict(pos=(0, 120, -135), look=(0, 0, 0), lens=36),
    't_spawn': dict(pos=(-8, -1.4, 44), look=(0, 0.5, 20), lens=24),
    'vineyard': dict(pos=(0, -1.3, 28), look=(0, 0.5, 4), lens=22),
    'strip': dict(pos=(-10, 1.6, 2), look=(12, 3.0, -8), lens=24),
    'terrace': dict(pos=(12, 4.2, -6), look=(28, 4.0, -16), lens=24),
    'terrace2': dict(pos=(40, 4.2, -8), look=(14, 3.6, -14), lens=24),
    'cellar': dict(pos=(11, -0.4, -9), look=(26, -0.6, -15), lens=22),
    'cellar2': dict(pos=(33, -0.4, -9), look=(18, -0.6, -16), lens=22),
    'courtyard': dict(pos=(-31, 6.4, -24.4), look=(-21, 6.6, -31), lens=22),
    'courtyard2': dict(pos=(-11, 6.4, -34), look=(-26, 6.4, -28), lens=22),
    'gate': dict(pos=(-32, 6.4, -14), look=(-32, 7.0, -30), lens=24),
    'villa': dict(pos=(-23, 6.4, -53), look=(-23, 8.0, -40), lens=24),
    'eastgarden': dict(pos=(14, 6.4, -44), look=(36, 7.0, -40), lens=24),
    'flask': dict(pos=(11, 6.4, -44), look=(11, 3.0, -30), lens=24),
    'flask_in': dict(pos=(11, 3.6, -31), look=(11, 1.8, -24), lens=24),
    'flask_out': dict(pos=(11, 4.0, -27), look=(11, 6.5, -37), lens=24),
    'library': dict(pos=(-6, 6.4, -34), look=(1, 6.4, -28), lens=22),
    'stables': dict(pos=(-35.5, 6.4, -28), look=(-45, 6.4, -28), lens=22),
    'west': dict(pos=(-30, -1.4, 30), look=(-30, 4.0, 0), lens=24),
    'hollow': dict(pos=(-50, -1.4, 30), look=(-50, 3.0, 0), lens=24),
    'east': dict(pos=(41, -1.4, 28), look=(41, 1.0, 6), lens=24),
    'cypress': dict(pos=(54, -1.4, 30), look=(54, 4.0, -10), lens=24),
    'lobbybg': dict(pos=(-11, 6.4, -34), look=(-26, 6.2, -28), lens=22, samples=128, res=(1920, 1051)),
    'lobbymap': dict(pos=(0, 150, 105), look=(0, 0, -2), lens=36, samples=64, res=(1920, 1052)),
}
def render_shot(name, spec, out_dir, samples=24, res=(1280, 720)):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = d.type != 'CPU'
        sc.cycles.device = 'GPU'
    except Exception as e: print('[shot] GPU ikke tilgængelig', e)
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.film_transparent = False
    cam = bpy.data.objects.get('cam') or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(cam)
    cam.data.lens = spec.get('lens', 28); cam.data.clip_end = 500
    cam.location = B(*spec['pos']); d = B(*spec['look']) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
    sc.render.filepath = os.path.join(out_dir, name + '.png'); bpy.ops.render.render(write_still=True)

def day_setup(preview=False):
    from bld import sky
    sc = bpy.context.scene
    sky.setup_world(bake=True, strength=SKY_STRENGTH)
    k = 0
    lamps = []
    for m in MODS.values():
        if hasattr(m, 'LAMPS'): lamps += m.LAMPS
    seen = set()
    for e in lamps:
        key = (round(e['x'], 1), round(e['y'], 1), round(e['z'], 1))
        if key in seen: continue
        seen.add(key); ld = bpy.data.lights.new('L%d' % k, 'POINT'); ld.energy = float(e['w']) * float(os.environ.get('FT_LAMP', 1.0)); ld.color = (1.0, 0.66, 0.36); ld.shadow_soft_size = 0.25
        ob = bpy.data.objects.new('L%d' % k, ld); coll('lamps').objects.link(ob); ob.location = B(e['x'], e['y'], e['z']); k += 1
    if preview: sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = float(os.environ.get('FT_EXPOSURE', 0.0))

def bake_mode(S):
    from bld import sky, bake
    day_setup()
    os.makedirs(bake.DST, exist_ok=True)
    sky.game_sky(bake.DST)
    t0 = time.time(); bake.bake_all(); print('[fattoria] bagt %.1f s' % (time.time() - t0))
    bake.export()
    lamps = []
    for m in MODS.values():
        if hasattr(m, 'LAMPS'): lamps += m.LAMPS
    json.dump({'lights': [dict(l, kind='lamp') for l in lamps]}, open(os.path.join(bake.DST, 'lights.json'), 'w'), separators=(',', ':'))
    json.dump({'lamps': [{'x': e['x'], 'y': e['y'], 'z': e['z'], 'i': e.get('i', 1.2), 'range': e.get('range', 8.0), 'color': 0xffb060, 'dir': [0, -1, 0], 'cone': 1.2} for e in lamps]}, open(os.path.join(bake.DST, 'probes.json'), 'w'), separators=(',', ':'))
    json.dump([], open(os.path.join(bake.DST, 'dprops.json'), 'w'))

SKY_STRENGTH = float(os.environ.get('FT_SKY', 1.0))

def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S, obs = build_world()
    if MODE == 'bake': bake_mode(S)
    if MODE in ('night', 'day'): day_setup(True)
    if MODE in ('clay', 'shots', 'day'):
        if MODE != 'day': setup_preview_world()
        if MODE == 'clay': bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'fattoria_clay.blend'))
        if MODE in ('shots', 'day'):
            od = os.path.join(OUT, 'shots'); os.makedirs(od, exist_ok=True)
            names = ARGS[1].split(',') if len(ARGS) > 1 else list(SHOTS)
            for n in names: render_shot(n, SHOTS[n], od, samples=SHOTS[n].get('samples', 24), res=SHOTS[n].get('res', (1280, 720))); print('[shot]', n, '%.0f s' % (time.time() - t0), flush=True)
    print('[fattoria] færdig %.1f s' % (time.time() - t0))

main()
