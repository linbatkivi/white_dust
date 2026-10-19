# v26.5 knive: brugerens færdige modeller (tools/knives/src/*.glb) → spillets knivramme → public/assets/weapons/knives/knife_<id>.glb
#   Ramme (som de gamle v19-knive): Blender +Y = klingen (spil −Z), Z = op (ryggen), X = tykkelsen; origo ved grebet (klinge/greb-overgangen).
#   Normalisering: PCA (længste akse = klingeretning, korteste = tykkelse) → klingeenden = den tynde ende → ryggen = den tykkeste side
#   → skaleres til knivens rigtige længde. Teksturer skaleres til ≤ 1024 px (JPEG), for mange trekanter decimeres.
#   Kør:  blender -b --factory-startup -P tools/knives/import.py      (FLIP: manuelle rettelser pr. kniv efter visuel kontrol)
import bpy, bmesh, os, sys, math, json
import numpy as np
from mathutils import Vector, Matrix
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'tools', 'knives', 'src'); OUT = os.path.join(ROOT, 'public', 'assets', 'weapons', 'knives')
KNIVES = [  # id, kildefil, længde (m), klingens andel (origo ved grebet), maks. trekanter
    ('karambitgold', 'karambit_csgo_gold_runes.glb', 0.235, 0.42, 9000),
    ('karambitscand', 'karambit_csgo_scandinavian.glb', 0.235, 0.42, 9000),
    ('karambit', 'knife_cs_go.glb', 0.235, 0.42, 9000),
    ('gut', 'gut-knife-csgo_scandinavian.glb', 0.215, 0.45, 9000),
    ('m9', 'm9_bayonet_knife.glb', 0.32, 0.57, 7000),
    ('kabar', 'ka-bar_knife.glb', 0.30, 0.59, 6000),
    ('classic', 'classic_knife_-_cs_1.6.glb', 0.30, 0.6, 4000),
]
FLIP = json.load(open(os.path.join(os.path.dirname(__file__), 'flip.json'))) if os.path.exists(os.path.join(os.path.dirname(__file__), 'flip.json')) else {}
ONLY = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
meta = {}
for kid, fn, L, bladeK, maxt in KNIVES:
    if ONLY and kid not in ONLY: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, fn))
    obs = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects: o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(obs) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    V = np.array([v.co[:] for v in ob.data.vertices]); c = V.mean(0); X = V - c
    w, E = np.linalg.eigh(np.cov(X.T)); E = E[:, np.argsort(-w)]                  # kolonner: længde, op, tykkelse
    P = X @ E
    u = P[:, 0]; lo, hi = u.min(), u.max()
    def thick(a, b):
        m = (u >= a) & (u <= b); return np.ptp(P[m, 2]) if m.sum() > 5 else 0
    span = hi - lo
    if thick(lo, lo + span * 0.25) > thick(hi - span * 0.25, hi): E[:, 0] *= -1; P[:, 0] *= -1      # klingen (tynd) mod +
    u = P[:, 0]; lo, hi = u.min(), u.max(); span = hi - lo
    bl = u > hi - span * 0.45                                                                         # klingen: ryggen er den tykke side
    up = P[bl, 1]; mid = (up.min() + up.max()) / 2
    tk_hi = np.ptp(P[bl & (P[:, 1] > mid), 2]) if (bl & (P[:, 1] > mid)).sum() > 5 else 0
    tk_lo = np.ptp(P[bl & (P[:, 1] < mid), 2]) if (bl & (P[:, 1] < mid)).sum() > 5 else 0
    if tk_lo > tk_hi: E[:, 1] *= -1
    f = FLIP.get(kid, {})
    if f.get('up'): E[:, 1] *= -1
    if f.get('len'): E[:, 0] *= -1
    if np.linalg.det(E) < 0: E[:, 2] *= -1                                                            # højrehåndet
    R = np.eye(4); R[:3, :3] = np.array([E[:, 2], E[:, 0], E[:, 1]])                                 # Blender X = tykkelse, Y = længde, Z = op
    ob.data.transform(Matrix(R.tolist()) @ Matrix.Translation(Vector((-c).tolist())))
    V = np.array([v.co[:] for v in ob.data.vertices]); lo, hi = V[:, 1].min(), V[:, 1].max(); s = L / (hi - lo)
    org = hi - (hi - lo) * bladeK                                                                     # origo ved grebet
    zc = (V[:, 2].min() + V[:, 2].max()) / 2
    ob.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-(V[:, 0].min() + V[:, 0].max()) / 2, -org, -zc))))
    # decimering + teksturer ≤ 1024
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris > maxt:
        md = ob.modifiers.new('d', 'DECIMATE'); md.ratio = maxt / tris; bpy.ops.object.modifier_apply(modifier=md.name)
    for im in bpy.data.images:
        if im.size[0] > 1024 or im.size[1] > 1024:
            k = 1024 / max(im.size); im.scale(max(4, int(im.size[0] * k)), max(4, int(im.size[1] * k)))
    V = np.array([v.co[:] for v in ob.data.vertices]); tip = V[np.argmax(V[:, 1])]
    # spil-rum: (x, y, z) = (Bx, Bz, −By)
    meta[kid] = {'tip': [0.0, round(float(tip[2]), 4), round(-float(tip[1]), 4)], 'len': L,
                 'tris': sum(len(p.vertices) - 2 for p in ob.data.polygons)}
    out = os.path.join(OUT, 'knife_%s.glb' % kid)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=86, export_yup=True, export_apply=True, export_animations=False, export_cameras=False, export_lights=False)
    print('[kniv] %-14s %5d tris  %5.0f KB  spids %s' % (kid, meta[kid]['tris'], os.path.getsize(out) / 1024, meta[kid]['tip']))
json.dump(meta, open(os.path.join(ROOT, 'tools', 'knives', 'meta.json'), 'w'), indent=1)
