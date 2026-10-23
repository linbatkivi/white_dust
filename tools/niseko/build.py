# ==========================================================================
# niseko · Blender-bygger (headless): gammel japansk landsby om natten – layout efter brugerens minimap.
#   python3 tools/niseko/gen/trace.py && python3 tools/niseko/gen/layout.py                      (layout → out/niseko_design.json + shared/niseko_data.js)
#   blender -b --factory-startup -P tools/niseko/build.py -- clay                                (kun geometri → out/niseko_clay.blend)
#   blender -b --factory-startup -P tools/niseko/build.py -- shots [navn,navn]                   (prøvebilleder → out/shots/*.png; kræver clay først eller bygger selv)
#   blender -b --factory-startup -P tools/niseko/build.py -- bake                                (lysmaps + world.bin/json → public/assets/niseko)
# ==========================================================================
import os, sys, math, time, json, random
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import bpy, bmesh
from mathutils import Vector, Matrix
from bld import common
from bld.common import B, coll, OUT, MB, defmat, MATS, mat
import nk_common, nk_geo, nk_ground, nk_arch, nk_props, nk_dress, nk_qa

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['clay']
MODE = ARGS[0]
D = json.load(open(os.path.join(HERE, 'out', 'niseko_design.json')))

def subdivide_long(ob, thr):
    """lange kanter deles (≤ thr m), så vertex-lyset har målepunkter midt på fladerne (tage, store plader)"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for _ in range(3):
        long = [e for e in bm.edges if e.calc_length() > thr]
        if not long: break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
    bm.to_mesh(ob.data); bm.free()

def build_world():
    t0 = time.time(); nk_common.define(defmat)
    S = {k: MB(n) for k, n in (('bd', 'detail_far_bd'), ('ground', 'ground'), ('walls', 'walls'), ('trim', 'detail_trim'), ('far', 'detail_far'), ('water', 'water'), ('props', 'props'), ('bark', 'props_bark'), ('fol', 'props_fol'))}
    S['lights'] = []
    S['bd'].box(-420, -2.6, -420, 420, -2.5, 420, 'nk_soil', faces='t')
    nk_ground.ground(D, S['ground']); nk_ground.bed(D, S['ground']); nk_ground.banks(D, S['walls'], S['trim']); nk_ground.water(D, S['water']); nk_ground.bridge(D, S['walls'], S['trim']); nk_ground.thresholds(D, S['trim'])
    for i, l in enumerate(D['lots']):
        rnd = random.Random(1000 + i * 7919)
        nk_arch.facade(l, S, rnd); nk_arch.roof(l, S, rnd)
    for sm in D['seams']: nk_arch.seam(sm, S)
    nk_props.build(D, S); nk_props.lanterns(S, nk_arch.LIGHTS); nk_dress.build(D, S)
    print('[niseko] geometri %.1f s' % (time.time() - t0))
    cols = {'bd': 'backdrop', 'ground': 'ground', 'walls': 'walls', 'trim': 'structures', 'far': 'structures', 'water': 'water', 'props': 'props', 'bark': 'props', 'fol': 'props'}
    obs = {}
    for k, M in S.items():
        if k == 'lights' or not M.f: continue
        ob = M.build(coll(cols[k]), bevel=0.0); obs[k] = ob
    if 'far' in obs: subdivide_long(obs['far'], 1.6)
    if 'fol' in obs: subdivide_long(obs['fol'], 1.1)
    return S, obs

def setup_preview_world(strength=0.9, sun=2.0):
    sc = bpy.context.scene; w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.52, 0.6, 0.75, 1); bg.inputs['Strength'].default_value = strength
    ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = sun; ld.angle = math.radians(2); o = bpy.data.objects.new('sun', ld); sc.collection.objects.link(o)
    o.rotation_euler = (math.radians(50), math.radians(10), math.radians(-40))

SHOTS = {
    'iso': dict(pos=(0, 95, 80), look=(0, 0, 0), lens=34),
    'mid': dict(pos=(-2, 1.65, 4.5), look=(2, 1.2, 30), lens=26),
    'canal': dict(pos=(-3.5, 1.65, -8), look=(0, 0.8, 8), lens=24),
    'bsite': dict(pos=(-31, 1.65, -17), look=(-42, 1.5, -20), lens=24),
    'asite': dict(pos=(39, 1.65, -14), look=(40, 1.5, -24), lens=24),
    'aroad': dict(pos=(8, 1.65, -32.5), look=(30, 1.7, -36), lens=24),
    'swat': dict(pos=(-18, 1.65, -52), look=(-14, 1.6, -40), lens=24),
    'hij': dict(pos=(-9, 1.65, 52), look=(-10, 2.0, 42), lens=24),
    'upper': dict(pos=(-14, 1.65, -33), look=(-12, 2.0, -42), lens=24),
    'east': dict(pos=(33, 1.65, 12), look=(32, 1.5, 24), lens=24),
    'lower': dict(pos=(-57, 1.65, 4), look=(-55, 3.0, 24), lens=22),
    'lower2': dict(pos=(-40, 1.65, 31), look=(-30, 3.5, 29), lens=22),
    'hook': dict(pos=(24, 1.65, -33), look=(22, 3.0, -24), lens=22),
    'lobbybg': dict(pos=(-3.6, 1.62, 7.2), look=(3.0, 1.6, 19.0), lens=27, samples=160, res=(1920, 1051)),
    'lobbymap': dict(pos=(0, 118, 66), look=(0, 0, 3), lens=36, samples=64, res=(1920, 1052)),
    'wc': dict(pos=(-12.0, 1.65, -0.5), look=(-14, 2.0, -8), lens=24),
    'tea': dict(pos=(10, 1.65, 23), look=(19.5, 1.6, 17.5), lens=26),
    'torii': dict(pos=(-17.2, 1.65, -47.6), look=(-12.5, 2.0, -42.9), lens=24),
    'torii2': dict(pos=(42.4, 1.65, -22), look=(42.4, 2.4, -30), lens=26),
    'asite2': dict(pos=(40.5, 1.65, -13.2), look=(42, 1.8, -23), lens=26),
    'asite3': dict(pos=(37.5, 1.65, -19), look=(47, 2.5, -26), lens=26),
    'bsite2': dict(pos=(-33.5, 1.65, -14), look=(-43, 2.0, -22), lens=24),
    'pond': dict(pos=(2.9, 1.65, 24.5), look=(3.5, 0.2, 17), lens=24),
    'hijpl': dict(pos=(-22, 1.65, 44), look=(-14, 2.0, 50), lens=24),
    'swatpl': dict(pos=(-17, 1.65, -46), look=(-21, 3.5, -53), lens=26),
}
def render_shot(name, spec, out_dir, samples=24, res=(1280, 720)):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = d.type != 'CPU'
        sc.cycles.device = 'GPU'
    except Exception as e: print('[shot] GPU ikke tilgængelig', e)
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.film_transparent = False
    cam = bpy.data.objects.get('cam') or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'));
    if cam.name not in bpy.context.scene.collection.objects: bpy.context.scene.collection.objects.link(cam)
    cam.data.lens = spec.get('lens', 28); cam.data.clip_end = 400
    cam.location = B(*spec['pos']); d = B(*spec['look']) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
    sc.render.filepath = os.path.join(out_dir, name + '.png'); bpy.ops.render.render(write_still=True)

def night_setup(preview=False):
    from bld import sky
    sc = bpy.context.scene
    # lanterner: punktlys (varmt) – selve papirmaterialet lyser ikke i bagningen (spillet tegner det selvlysende)
    k = 0
    for e in nk_arch.LIGHTS:
        if e['kind'] not in ('chochin', 'tourou'): continue
        ld = bpy.data.lights.new('L%d' % k, 'POINT'); ld.energy = (LANTERN_W if e['kind'] == 'chochin' else LANTERN_W * 0.45) * (0.55 if e.get('red') else 1.0); ld.color = (1.0, 0.2, 0.08) if e.get('red') else (1.0, 0.55, 0.26); ld.shadow_soft_size = 0.14
        ob = bpy.data.objects.new('L%d' % k, ld); coll('lamps').objects.link(ob); ob.location = B(e['x'], e['y'], e['z']); k += 1
    for nme in ('nk_paper', 'nk_paper_red'):
        m = bpy.data.materials.get(nme)
        if m:
            for n in m.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED': n.inputs['Emission Strength'].default_value = 0.0
    sky.setup_world(bake=True, strength=SKY_STRENGTH)
    sun = bpy.data.objects.get('Sol')
    if sun: sun.data.energy *= MOON
    if preview:
        sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = float(os.environ.get('NK_EXPOSURE', 1.5))
        for nme in ('nk_paper', 'nk_paper_red'):
            m = bpy.data.materials.get(nme)
            if m:
                for n in m.node_tree.nodes:
                    if n.type == 'BSDF_PRINCIPLED': n.inputs['Emission Strength'].default_value = 5.0

def bake_mode(S):
    from bld import sky, bake
    night_setup()
    os.makedirs(bake.DST, exist_ok=True)
    sky.game_sky(bake.DST)
    t0 = time.time(); bake.bake_all(); print('[niseko] bagt %.1f s' % (time.time() - t0))
    lc = bpy.data.collections.get('lib')
    bake.export()
    lamps = [{'x': e['x'], 'y': e['y'], 'z': e['z'], 'kind': 'lantern', 'col': [1.0, 0.2, 0.08] if e.get('red') else [1.0, 0.58, 0.3], 'w': 60} for e in nk_arch.LIGHTS if e['kind'] in ('chochin', 'tourou')]
    json.dump({'lights': lamps}, open(os.path.join(bake.DST, 'lights.json'), 'w'), separators=(',', ':'))
    json.dump({'lamps': [{'x': e['x'], 'y': e['y'], 'z': e['z'], 'i': 1.6, 'range': 9.0, 'color': 0xff9a50, 'dir': [0, -1, 0], 'cone': 1.2} for e in nk_arch.LIGHTS if e['kind'] in ('chochin', 'tourou')]}, open(os.path.join(bake.DST, 'probes.json'), 'w'), separators=(',', ':'))
    json.dump([], open(os.path.join(bake.DST, 'dprops.json'), 'w'))

LANTERN_W = float(os.environ.get('NK_LANTERN_W', 160.0)); SKY_STRENGTH = float(os.environ.get('NK_SKY', 1.0)); MOON = float(os.environ.get('NK_MOON', 0.12))

def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    S, obs = build_world()
    if MODE == 'qa':
        bpy.context.view_layer.update(); nk_qa.run()
    if MODE == 'bake': bake_mode(S)
    if MODE in ('night', 'tour'): night_setup(True)
    if MODE in ('clay', 'shots', 'night', 'tour'):
        if MODE not in ('night', 'tour'): setup_preview_world()
        if MODE == 'clay': bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'niseko_clay.blend'))
        if MODE in ('shots', 'night'):
            od = os.path.join(OUT, 'shots'); os.makedirs(od, exist_ok=True)
            names = ARGS[1].split(',') if len(ARGS) > 1 else list(SHOTS)
            for n in names: render_shot(n, SHOTS[n], od, samples=SHOTS[n].get('samples', 24), res=SHOTS[n].get('res', (1280, 720))); print('[shot]', n, '%.0f s' % (time.time() - t0), flush=True)
        if MODE == 'tour':
            od = os.path.join(OUT, 'shots'); os.makedirs(od, exist_ok=True)
            for t in json.load(open(os.path.join(OUT, 'tour.json'))):
                render_shot('t_' + t['n'].replace(' ', '_'), dict(pos=(t['x'], 1.65, t['z']), look=(t['look'][0], 1.9, t['look'][1]), lens=24), od, samples=16, res=(960, 540)); print('[tour]', t['n'], flush=True)
    print('[niseko] færdig %.1f s' % (time.time() - t0))

main()
