# ==========================================================================
# fattoria · Blender-bygger (headless): toscansk vingård i den gyldne time – layout efter brugerens plantegning.
#   python3 tools/fattoria/gen/trace.py && python3 tools/fattoria/gen/layout.py                (layout → out/fattoria_design.json + shared/fattoria_data.js)
#   blender -b --factory-startup -P tools/fattoria/build.py -- clay                            (kun geometri → out/fattoria_clay.blend)
#   blender -b --factory-startup -P tools/fattoria/build.py -- shots [navn,navn]               (prøvebilleder → out/shots/*.png)
#   blender -b --factory-startup -P tools/fattoria/build.py -- day [navn,navn]                 (prøvebilleder med bagt-lys-opsætning: sol + himmel + lamper)
#   blender -b --factory-startup -P tools/fattoria/build.py -- qa                              (QA: usynlige hitbokse / synligt i fri rute)
#   blender -b --factory-startup -P tools/fattoria/build.py -- bake                            (lysmaps + world.bin/json → public/assets/fattoria)
# ==========================================================================
import os, sys, math, time, json, random
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import bpy, bmesh
from mathutils import Vector, Matrix
from bld import common
from bld.common import B, coll, OUT, MB, defmat, MATS, mat
import ft_common, ft_ground, ft_arch, ft_props, ft_scen

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['clay']
MODE = ARGS[0]
D = json.load(open(os.path.join(HERE, 'out', 'fattoria_design.json')))

def subdivide_long(ob, thr):
    """lange kanter deles (≤ thr m), så vertex-lyset har målepunkter midt på fladerne (tage, store plader)"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for _ in range(3):
        long = [e for e in bm.edges if e.calc_length() > thr]
        if not long: break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    bm.to_mesh(ob.data); bm.free()

def build_world():
    t0 = time.time(); ft_common.define(defmat)
    S = {k: MB(n) for k, n in (('bd', 'detail_far_bd'), ('ground', 'ground'), ('walls', 'walls'), ('trim', 'detail_trim'), ('far', 'detail_far'), ('water', 'water'), ('props', 'props'), ('bark', 'props_bark'), ('fol', 'props_fol'))}
    ft_ground.ground(D, S['ground']); ft_ground.fills(D, S['ground']); ft_ground.thresholds(D, S['trim'])
    ft_arch.build(D, S); ft_props.build(D, S); ft_scen.build(D, S)
    print('[fattoria] geometri %.1f s' % (time.time() - t0))
    cols = {'bd': 'backdrop', 'ground': 'ground', 'walls': 'walls', 'trim': 'structures', 'far': 'structures', 'water': 'water', 'props': 'props', 'bark': 'props', 'fol': 'props'}
    obs = {}
    for k, Mb in S.items():
        if not Mb.f: continue
        obs[k] = Mb.build(coll(cols[k]), bevel=0.0)
    if 'far' in obs: subdivide_long(obs['far'], 1.6)
    if 'fol' in obs: subdivide_long(obs['fol'], 2.8)
    TRIS = lambda ob: sum(len(p.vertices) - 2 for p in ob.data.polygons)
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
    'swat': dict(pos=(-50, 1.65, -55), look=(-38, 1.8, -46), lens=24),
    'exit': dict(pos=(-33, 1.65, -43), look=(-27, 1.9, -39), lens=24),
    'adiag': dict(pos=(-33, 1.65, -39), look=(-42, 1.9, -22), lens=24),
    'villa': dict(pos=(-25, 1.65, -36), look=(-24, 1.8, -17), lens=24),
    'upper': dict(pos=(-20, 1.65, -40), look=(4, 2.2, -43), lens=24),
    'along': dict(pos=(-24, 1.65, -15.8), look=(-42, 1.8, -15.5), lens=24),
    'asite': dict(pos=(-38, 1.65, -15.6), look=(-50, 1.8, -9), lens=24),
    'asite2': dict(pos=(-39, 1.65, -4.5), look=(-52, 1.8, -12), lens=24),
    'asite3': dict(pos=(-58, 1.65, 3), look=(-50, 1.8, -10), lens=24),
    'tower': dict(pos=(-33, 1.65, 12.6), look=(-44, 1.7, 13.2), lens=24),
    'towerdeck': dict(pos=(-37.8, 4.8, 15.2), look=(-47, 4.6, 11), lens=24),
    'deckview': dict(pos=(-41, 4.85, 11.2), look=(-47, 2.4, -6), lens=26),
    'stub': dict(pos=(-14, 1.65, 12.6), look=(-32, 1.7, 12.6), lens=24),
    'mid': dict(pos=(-12, 1.65, 8), look=(8, 1.5, 2), lens=24),
    'mid2': dict(pos=(28, 1.65, 8), look=(5, 1.5, 3), lens=24),
    'midnorth': dict(pos=(16, 1.65, -8), look=(16, 1.9, -20), lens=24),
    'blink': dict(pos=(16, 1.65, -22), look=(26, 2.0, -27), lens=24),
    'bhall': dict(pos=(26.5, 1.65, -33), look=(48, 2.0, -33), lens=24),
    'bhall2': dict(pos=(54, 1.65, -33), look=(28, 2.2, -33), lens=24),
    'bgallery': dict(pos=(40, 4.3, -38), look=(40, 1.5, -31), lens=24),
    'eastroad': dict(pos=(53, 1.65, 18), look=(57, 1.9, 36), lens=24),
    'hij': dict(pos=(50, 1.65, 52), look=(30, 1.9, 49), lens=24),
    'south': dict(pos=(0, 1.65, 52), look=(-30, 1.9, 49), lens=24),
    'orchard': dict(pos=(-40, 1.65, 46), look=(-41, 1.9, 30), lens=24),
    'westloop': dict(pos=(-59, 1.65, 22), look=(-59, 1.9, 4), lens=24),
    'dbg1': dict(pos=(-33.5, 1.65, -37.5), look=(-42, 2.5, -24), lens=22),
    'dbg2': dict(pos=(-33.5, 1.65, -37.5), look=(-52, 6, -46), lens=22),
    'dbg3': dict(pos=(-40, 1.65, -27), look=(-34, 6, -40), lens=22),
    'dbg4': dict(pos=(-36, 12, -33), look=(-40, 0, -27), lens=30),
    'lobbybg': dict(pos=(-12.5, 1.7, 9.5), look=(10, 2.3, 1.5), lens=24, samples=128, res=(1920, 1051)),
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
    k = 0; seen = set()
    for e in ft_arch.LAMPS:
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
    lamps = ft_arch.LAMPS
    json.dump({'lights': [dict(l, kind='lamp') for l in lamps]}, open(os.path.join(bake.DST, 'lights.json'), 'w'), separators=(',', ':'))
    json.dump({'lamps': [{'x': e['x'], 'y': e['y'], 'z': e['z'], 'i': e.get('i', 1.2), 'range': e.get('range', 8.0), 'color': 0xffb060, 'dir': [0, -1, 0], 'cone': 1.2} for e in lamps]}, open(os.path.join(bake.DST, 'probes.json'), 'w'), separators=(',', ':'))
    json.dump([], open(os.path.join(bake.DST, 'dprops.json'), 'w'))

SKY_STRENGTH = float(os.environ.get('FT_SKY', 1.0))

def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S, obs = build_world()
    if MODE == 'qa':
        import ft_qa; bpy.context.view_layer.update(); ft_qa.run()
    if MODE == 'near':
        import ft_qa; bpy.context.view_layer.update(); ft_qa.near(float(ARGS[1]), float(ARGS[2]))
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
