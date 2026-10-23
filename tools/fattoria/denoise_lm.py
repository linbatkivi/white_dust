# ==========================================================================
# de_havn – støjfjernelse af bagte lysmaps (Intel Open Image Denoise via Blenders compositor) + kodning til PNG.
# Køres af bld/bake.py som separat Blender-proces efter bagningen:
#   blender -b --factory-startup -P tools/havn/denoise_lm.py -- <jobs.json>
# jobs.json: [{"exr": rå lysmap (float, lineær), "png": mål, "name": chunk}] → skriver <jobs>.out.json med skala S pr. chunk.
# Lysmappen (A − B, kun indirekte lys) er lavfrekvent, så OIDN fjerner Monte Carlo-støjen uden at viske detaljer ud.
# ==========================================================================
import bpy, json, os, sys
import numpy as np

jobs_path = sys.argv[sys.argv.index('--') + 1]
jobs = json.load(open(jobs_path))
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_percentage = 100
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob)
nt = bpy.data.node_groups.new('denoise', 'CompositorNodeTree'); sc.compositing_node_group = nt
nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
out = nt.nodes.new('NodeGroupOutput'); im = nt.nodes.new('CompositorNodeImage'); dn = nt.nodes.new('CompositorNodeDenoise')
dn.inputs['HDR'].default_value = True
nt.links.new(im.outputs['Image'], dn.inputs['Image']); nt.links.new(dn.outputs['Image'], out.inputs[0])
st = sc.render.image_settings; st.file_format = 'OPEN_EXR'; st.color_depth = '32'; st.color_mode = 'RGB'
sc.view_settings.view_transform = 'Standard'; sc.display_settings.display_device = 'sRGB'
res = {}
for j in jobs:
    src = bpy.data.images.load(j['exr']); src.colorspace_settings.name = 'Non-Color'; w, h = src.size
    im.image = src; sc.render.resolution_x, sc.render.resolution_y = w, h
    tmp = j['exr'][:-4] + '_dn.exr'; sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    d = bpy.data.images.load(tmp); d.colorspace_settings.name = 'Non-Color'
    a = np.empty(w * h * 4, np.float32); d.pixels.foreach_get(a); L = np.clip(a.reshape(h, w, 4)[..., :3], 0, None)
    S = float(max(1e-3, np.percentile(L[L > 0], 99.7) * 1.15)) if (L > 0).any() else 1.0
    enc = np.clip(L / S, 0, 1) ** (1 / 2.2)
    o = bpy.data.images.new('png_' + j['name'], w, h, alpha=False); rgba = np.ones((h, w, 4), np.float32); rgba[..., :3] = enc
    o.pixels.foreach_set(rgba.ravel()); o.filepath_raw = j['png']; o.file_format = 'PNG'; o.save()
    res[j['name']] = S
    for x in (src, d, o): bpy.data.images.remove(x)
    os.remove(tmp)
    print('[denoise] %s: %dx%d, S=%.3f' % (j['name'], w, h, S), flush=True)
json.dump(res, open(jobs_path[:-5] + '.out.json', 'w'))
