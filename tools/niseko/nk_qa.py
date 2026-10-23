# ==========================================================================
# de_niseko · QA i Blender: (A) intet synligt i spillerens rum (fri rute uden kollision) – (B) hver kollisionsflade har noget synligt (ingen usynlige hitbokser)
#   blender -b --factory-startup -P tools/niseko/build.py -- qa
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
        return (loc - o).length if hit else None
    # (A) frie punkter: otte vandrette stråler i tre højder (spillerens cylinder r = 0,32)
    bad = collections.defaultdict(list); n = 0
    dirs = [Vector((math.cos(a * math.pi / 4), math.sin(a * math.pi / 4), 0)) for a in range(8)]
    for (x, z) in Q['free']:
        for y in (0.25, 0.8, 1.45, 1.75):
            o = B(x, y, z)
            for d in dirs:
                r = cast(o, d, 0.34)
                if r is not None: bad['A'].append((x, z, y, round(r, 2))); break
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
