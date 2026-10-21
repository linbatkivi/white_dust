#!/usr/bin/env python3
# bureau · modellernes faktiske mål (akse-orienteret boks i modellens eget rum, y op, forside +z) → data/model_dims.json
#   Bruges af dress.py, så hvert møbel får kollision efter sin egen form – ikke efter overblikkets dækningsfelt.
#   python3 tools/bureau/gen/modeldims.py      (læser cache/models/<navn>/<navn>.gltf og cache/custom/<navn>.glb)
import json, os, struct, glob
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, '..', 'cache')

def load(path):
    if path.endswith('.glb'):
        b = open(path, 'rb').read(); n = struct.unpack_from('<I', b, 12)[0]
        return json.loads(b[20:20 + n])
    return json.load(open(path))

def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def node_mat(nd):
    if 'matrix' in nd: return np.array(nd['matrix'], float).reshape(4, 4).T
    m = np.eye(4); s = np.diag(nd.get('scale', [1, 1, 1]))
    m[:3, :3] = qmat(nd.get('rotation', [0, 0, 0, 1])) @ s; m[:3, 3] = nd.get('translation', [0, 0, 0]); return m

def bounds(g):
    lo = np.full(3, 1e9); hi = np.full(3, -1e9)
    def walk(i, M):
        nd = g['nodes'][i]; M2 = M @ node_mat(nd)
        if 'mesh' in nd:
            for pr in g['meshes'][nd['mesh']]['primitives']:
                a = g['accessors'][pr['attributes']['POSITION']]; mn, mx = a['min'], a['max']
                for c in [(x, y, z) for x in (mn[0], mx[0]) for y in (mn[1], mx[1]) for z in (mn[2], mx[2])]:
                    p = M2 @ np.array([*c, 1.0]); lo[:] = np.minimum(lo, p[:3]); hi[:] = np.maximum(hi, p[:3])
        for c in nd.get('children', []): walk(c, M2)
    scene = g['scenes'][g.get('scene', 0)]
    for r in scene['nodes']: walk(r, np.eye(4))
    return lo, hi

out = {}
for p in glob.glob(os.path.join(CACHE, 'models', '*', '*.gltf')) + glob.glob(os.path.join(CACHE, 'custom', '*.glb')):
    name = os.path.splitext(os.path.basename(p))[0]
    try:
        lo, hi = bounds(load(p)); out[name] = {'min': [round(v, 3) for v in lo], 'max': [round(v, 3) for v in hi]}
    except Exception as e: print('FEJL', name, e)
json.dump(out, open(os.path.join(HERE, 'data', 'model_dims.json'), 'w'), indent=0)
print('[dims] %d modeller' % len(out))
for k in ('desk_pair', 'office_chair', 'reception_desk', 'sofa_02', 'weapon_locker', 'pallet', 'server_rack', 'pachira_aquatica_01', 'steel_frame_shelves_01', 'flight_case'):
    if k in out: print(' ', k, [round(b - a, 2) for a, b in zip(out[k]['min'], out[k]['max'])], out[k]['min'])
