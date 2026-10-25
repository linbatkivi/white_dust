# ==========================================================================
# de_fattoria · QA i Blender: (A) intet synligt i spillerens rum (fri rute uden kollision) – (B) hver kollisionsflade har noget synligt (ingen usynlige hitbokser)
#   blender -b --factory-startup -P tools/fattoria/build.py -- qa
# ==========================================================================
import os, json, math, collections
import bpy
from mathutils import Vector
from bld.common import B, OUT

def run():
    Q = json.load(open(os.path.join(OUT, 'qa.json')))
    dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene
    water = {o.name for o in bpy.data.objects if o.name.startswith('water')}
    def cast(o, d, dist):
        hit, loc, nrm, idx, ob, mw = sc.ray_cast(dg, o, d, distance=dist)
        if hit and ob and ob.name in water: return None
        cast.last = (ob.name if ob else None, tuple(round(v, 2) for v in loc)) if hit else None
        return (loc - o).length if hit else None
    # (A) frie punkter: otte vandrette stråler i tre højder (spillerens cylinder r = 0,32)
    bad = collections.defaultdict(list); n = 0
    dirs = [Vector((math.cos(a * math.pi / 4), math.sin(a * math.pi / 4), 0)) for a in range(8)]
    for (x, z) in Q['free']:
        for y in (0.25, 0.8, 1.45, 1.75):
            o = B(x, y, z)
            for d in dirs:
                r = cast(o, d, 0.34)
                if r is not None: bad['A'].append((x, z, y, round(r, 2), cast.last)); break
        n += 1
    # (B) sonder: stråle fra den frie side (0,3 m ude) mod kollisionsfladen – skal ramme synlig geometri inden for 0,55 m
    miss = collections.defaultdict(list)
    for (x, z, nx, nz, y, kind) in Q['probes']:
        o = B(x + nx * 0.3, y, z + nz * 0.3); d = B(-nx, 0, -nz) - B(0, 0, 0)
        r = cast(o, d.normalized(), 0.6)
        if r is None: miss[kind].append((x, z, y))
    print('[QA] A: %d frie punkter → %d med synlig geometri i spillerens rum' % (n, len(set((a[0], a[1]) for a in bad['A']))))
    for a in bad['A'][:25]: print('   A synlig i fri rute:', a)
    tot = sum(len(v) for v in miss.values())
    print('[QA] B: %d sonder → %d uden synlig flade (mulig usynlig hitbox)' % (len(Q['probes']), tot))
    for k, v in sorted(miss.items(), key=lambda kv: -len(kv[1])): print('   B', k, len(v), v[:4])
    json.dump(dict(A=bad['A'], B={k: v for k, v in miss.items()}), open(os.path.join(OUT, 'qa_result.json'), 'w'))

def near(x, z, r=0.6):
    """diagnose: hvilke objekter/materialer har hjørner nær (x, z) lavere end 2 m"""
    out = {}
    for ob in bpy.data.objects:
        if ob.type != 'MESH': continue
        mw = ob.matrix_world
        for v in ob.data.vertices:
            p = mw @ v.co
            if abs(p.x - x) < r and abs(-p.y - z) < r and p.z < 2.0: out.setdefault(ob.name, []).append((round(p.x, 2), round(-p.y, 2), round(p.z, 2)))
    for k, v in out.items(): print('[near]', k, len(v), v[:3])
    ob = bpy.data.objects.get('props_fol')
    if ob:
        mw = ob.matrix_world
        for pl in ob.data.polygons:
            ps = [mw @ ob.data.vertices[i].co for i in pl.vertices]
            if any(abs(p.x - x) < r and abs(-p.y - z) < r and p.z < 2.0 for p in ps): print('[near-poly]', ob.data.materials[pl.material_index].name if ob.data.materials else '?', [(round(p.x, 2), round(-p.y, 2), round(p.z, 2)) for p in ps])
