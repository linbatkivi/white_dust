# ==========================================================================
# valkyrie · himmel: find solen i HDRI'en, fjern solskiven (til bagning af indirekte lys) og beregn solens styrke.
#   Lysmappet = himmellys + alt tilbagekastet lys. Direkte sol tegnes i realtid i spillet (skarpe skygger, også på spillere),
#   så solen skal være en separat lampe med samme retning/styrke som solskiven i HDRI'en.
# ==========================================================================
import json, math, os
import bpy
import numpy as np
from .common import CACHE, OUT

HDR = os.path.join(CACHE, 'sky', 'moonlit_golf_2k.hdr')

def analyse(force=False):
    js = os.path.join(OUT, 'sky.json'); nosun = os.path.join(OUT, 'sky_nosun.exr')
    if os.path.exists(js) and os.path.exists(nosun) and not force: return json.load(open(js))
    im = bpy.data.images.load(HDR); W, H = im.size
    px = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(H, W, 4)   # rækker nedefra og op
    lum = px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722
    j, i = np.unravel_index(np.argmax(lum), lum.shape)
    # Blenders equirect: u = atan2(dir.y, -dir.x)/(2π) + 0.5, v = atan2(dir.z, hypot(x, y))/π + 0.5 (rækker nedefra)
    u, v = (i + 0.5) / W, (j + 0.5) / H
    phi = (u - 0.5) * 2 * math.pi; theta = (v - 0.5) * math.pi
    dx, dy, dz = -math.cos(theta) * math.cos(phi), math.cos(theta) * math.sin(phi), math.sin(theta)
    # solskiven: pixels inden for 3° af solen og meget lysere end himlen omkring
    ys, xs = np.mgrid[0:H, 0:W]
    th = ((ys + 0.5) / H - 0.5) * math.pi; ph = ((xs + 0.5) / W - 0.5) * 2 * math.pi
    vx, vy, vz = -np.cos(th) * np.cos(ph), np.cos(th) * np.sin(ph), np.sin(th)
    cosang = vx * dx + vy * dy + vz * dz
    ring = (cosang < math.cos(math.radians(3.0))) & (cosang > math.cos(math.radians(6.0)))
    sky_around = np.median(px[ring][:, :3], axis=0)
    disk = cosang > math.cos(math.radians(3.0))
    excess = np.clip(px[..., :3] - sky_around, 0, None) * disk[..., None]
    domega = (2 * math.pi / W) * (math.pi / H) * np.cos(th)                         # rumvinkel pr. pixel
    sun_irr = (excess * domega[..., None]).sum(axis=(0, 1))                          # W/m² vinkelret på solen (RGB)
    clean = px.copy(); clean[disk, :3] = np.minimum(clean[disk, :3], sky_around)
    # himlens bestråling af en vandret flade (til balance-tjek)
    up = np.clip(vz, 0, None); sky_irr = ((clean[..., :3] * (up * domega)[..., None]).sum(axis=(0, 1)))
    out = bpy.data.images.new('sky_nosun', W, H, alpha=False, float_buffer=True)
    out.pixels.foreach_set(clean.ravel()); out.filepath_raw = nosun; out.file_format = 'OPEN_EXR'; out.save()
    el = math.degrees(math.asin(dz)); az = math.degrees(math.atan2(dy, dx))
    res = {'dir_blender': [dx, dy, dz], 'elev': el, 'azim': az, 'sun_irradiance_rgb': sun_irr.tolist(), 'sky_horizontal_irradiance_rgb': sky_irr.tolist(),
           'sky_around': sky_around.tolist(), 'size': [W, H]}
    json.dump(res, open(js, 'w'), indent=1)
    print('[sky] sol: elevation %.1f°, azimut %.1f°, sol %.0f W/m², himmel (vandret) %.0f W/m²' % (el, az, float(np.mean(sun_irr)), float(np.mean(sky_irr))))
    return res

SUN_AZIM = 125.0           # månen fra sydvest, lavt over bygningerne (Blender: azimut = atan2(nord, øst))
def rotation():
    """vinkel (rad) himlen drejes om lodret akse, så HDRI'ens sol står i SUN_AZIM; samme drejning bruges i spillets himmel"""
    info = analyse(); return math.radians(info['azim'] - SUN_AZIM)
def sun_dir():
    info = analyse(); th = -rotation(); d = info['dir_blender']
    return [d[0] * math.cos(th) - d[1] * math.sin(th), d[0] * math.sin(th) + d[1] * math.cos(th), d[2]]
def setup_world(bake=False, strength=1.0):
    """himmel uden solskive + solen som lampe (bruges både til prøvebilleder og bagning)"""
    info = analyse()
    sc = bpy.context.scene; w = sc.world or bpy.data.worlds.new('world'); sc.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(OUT, 'sky_nosun.exr'), check_existing=True)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value[2] = rotation()
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = strength
    o = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], o.inputs['Surface'])
    # solen som lampe (samme retning og styrke som solskiven)
    sun = bpy.data.objects.get('Sol')
    if not sun:
        ld = bpy.data.lights.new('Sol', 'SUN'); sun = bpy.data.objects.new('Sol', ld); sc.collection.objects.link(sun)
    d = sun_dir(); irr = info['sun_irradiance_rgb']; e = max(irr)
    sun.data.energy = e * strength; sun.data.color = tuple(c / e for c in irr); sun.data.angle = math.radians(0.53)
    from mathutils import Vector
    sun.rotation_mode = 'QUATERNION'; sun.rotation_quaternion = Vector((-d[0], -d[1], -d[2])).to_track_quat('-Z', 'Y')
    return info

def game_sky(dst_dir):
    """himmel til spillet: HDRI'en drejet som i Blender og omsat til spillets equirect-konvention (u = atan2(z, x)/2π + ½),
    nedskaleret til 2048×1024 (.hdr) + sky.json med solens retning (spillets akser x, y, z) og styrker"""
    info = analyse(); th = rotation()
    im = bpy.data.images.load(HDR, check_existing=True); W, H = im.size
    px = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    u = (np.arange(W) + 0.5) / W; phi = (u - 0.5) * 2 * math.pi                    # spillets azimut: x = cos, z = sin
    X, Y = np.cos(phi), -np.sin(phi)                                                # Blender: X = x, Y = −z
    LX, LY = X * math.cos(th) - Y * math.sin(th), X * math.sin(th) + Y * math.cos(th)   # opslag i teksturen = Rz(θ)·d
    uo = np.arctan2(LY, -LX) / (2 * math.pi) + 0.5
    cols = np.clip((uo * W).astype(int), 0, W - 1)
    rot = px[:, cols, :]
    small = rot.reshape(H // 2, 2, W // 2, 2, 4).mean(axis=(1, 3))
    out = bpy.data.images.new('sky_game', W // 2, H // 2, alpha=False, float_buffer=True)
    out.pixels.foreach_set(small.astype(np.float32).ravel()); out.filepath_raw = os.path.join(dst_dir, 'sky.hdr'); out.file_format = 'HDR'; out.save()
    d = sun_dir()                                                                   # Blender → spil: (x, y, z) = (X, Z, −Y)
    js = {'sunDir': [d[0], d[2], -d[1]], 'sunIrr': info['sun_irradiance_rgb'], 'skyIrr': info['sky_horizontal_irradiance_rgb'], 'elev': info['elev']}
    json.dump(js, open(os.path.join(dst_dir, 'sky.json'), 'w'), indent=1)
    print('[sky] spillets himmel: sky.hdr + sky.json, sol', js['sunDir'])
