# bureau · modellernes mål målt i Blender med samme import som build.py (transformer anvendt) → gen/data/model_dims.json
#   blender -b --factory-startup -P tools/bureau/gen/modeldims_blender.py
#   Spil-koordinater: x = Blender x, y (op) = Blender z, z (frem) = −Blender y.
import bpy, os, json, glob
HERE = os.path.dirname(os.path.abspath(__file__)); CACHE = os.path.join(HERE, '..', 'cache')
out = {}
for p in sorted(glob.glob(os.path.join(CACHE, 'models', '*', '*.gltf')) + glob.glob(os.path.join(CACHE, 'custom', '*.glb'))):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try: bpy.ops.import_scene.gltf(filepath=p)
    except Exception as e: print('FEJL', p, e); continue
    xs, ys, zs = [], [], []
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        M = o.matrix_world
        for v in o.data.vertices:
            w = M @ v.co; xs.append(w.x); ys.append(w.z); zs.append(-w.y)
    if not xs: continue
    out[os.path.splitext(os.path.basename(p))[0]] = {'min': [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3)], 'max': [round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)]}
json.dump(out, open(os.path.join(HERE, 'data', 'model_dims.json'), 'w'), indent=0)
print('[dims] %d modeller' % len(out))
