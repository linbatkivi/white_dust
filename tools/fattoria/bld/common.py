# ==========================================================================
# de_bureau · Blender-bygger – fælles (fra de_ascension) (kopi af de_havn's): stier, kortdata, mesh-bygger med verdens-UV'er og blend-vægte.
# Akser: layoutet bruger (x øst, z syd, y op). Blender bruger Z op: blender (X, Y, Z) = (x, -z, y), så nord (−z) = +Y.
# ==========================================================================
import json, math, os, random, contextlib
import bpy, bmesh
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # tools/asc
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CACHE = os.path.join(HERE, 'cache')
OUT = os.path.join(HERE, 'out')
TEXDIM = {}

def B(x, y, z):
    """layout (x, y, z) → Blender-vektor"""
    return Vector((x, -z, y))

def rng(*key):
    return random.Random(hash(tuple(round(k, 3) if isinstance(k, float) else k for k in key)) & 0xffffffff)

# ---------------------------------------------------------------- mesh-bygger
class MB:
    """Samler polygoner med materiale, UV0 (verdensprojektion efter materialets virkelige mål) og blend-farve (RGBA).
    Polygoner gives i layout-koordinater (x, y, z) i mod-uret rækkefølge set udefra."""
    def __init__(self, name):
        self.name = name; self.v = []; self.f = []; self.mat = []; self.uv = []; self.col = []; self.mats = []; self.smooth = []; self.grp = []
        self.cur = None; self._gid = 0
    @contextlib.contextmanager
    def part(self):
        """én sammenhængende del (kasse, rør, profil …): kun dens egne hjørner svejses sammen – nabodele forbliver adskilte, så fasningen er ren"""
        if self.cur is not None: yield; return
        self._gid += 1; self.cur = self._gid
        try: yield
        finally: self.cur = None
    def mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def poly(self, pts, m, uv=None, col=None, smooth=False, uvmode='world', uvoff=(0, 0), uvrot=0.0, want=None):
        """pts: [(x,y,z), ...]. uv: liste af (u,v) pr. hjørne – ellers verdensprojektion (skaleret efter materialets mål).
        want: ønsket normalretning (x,y,z) – polygonen vendes hvis dens normal peger modsat."""
        if want is not None:
            a, b, c = Vector(pts[0]), Vector(pts[1]), Vector(pts[2]); nn = (b - a).cross(c - a)
            if len(pts) > 3 and nn.length < 1e-9: nn = (c - a).cross(Vector(pts[3]) - a)
            if nn.dot(Vector(want)) < 0: pts = pts[::-1]
        base = len(self.v); self.v.extend(pts); self.f.append(list(range(base, base + len(pts)))); self.mat.append(self.mi(m)); self.smooth.append(smooth); self.grp.append(self.cur)
        if uv is None: uv = world_uv(pts, m, uvoff, uvrot)
        self.uv.append(uv)
        if col is None: col = [(0, 0, 0, 1)] * len(pts)
        elif isinstance(col, tuple): col = [col] * len(pts)
        self.col.append(col)
        return self
    def quad(self, a, b, c, d, m, **k): return self.poly([a, b, c, d], m, **k)
    def box(self, x0, y0, z0, x1, y1, z1, m, faces='nsewtb', mtop=None, mbot=None, **k):
        """akse-parallel kasse (layout-koordinater). faces vælger hvilke sider der laves (n = −z, s = +z, w = −x, e = +x, t = top, b = bund)"""
        with self.part(): return self._box(x0, y0, z0, x1, y1, z1, m, faces, mtop, mbot, **k)
    def _box(self, x0, y0, z0, x1, y1, z1, m, faces, mtop, mbot, **k):
        P = lambda x, y, z: (x, y, z)
        if 't' in faces: self.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), mtop or m, **k)
        if 'b' in faces: self.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), mbot or m, **k)
        if 's' in faces: self.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), m, **k)
        if 'n' in faces: self.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), m, **k)
        if 'e' in faces: self.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), m, **k)
        if 'w' in faces: self.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), m, **k)
        return self
    def grid(self, x0, z0, x1, z1, y, m, step=1.0, colfn=None, yfn=None, **k):
        """vandret flade delt i felter (bærer blend-vægte pr. hjørne og evt. en let højdevariation)"""
        nx = max(1, int(math.ceil((x1 - x0) / step))); nz = max(1, int(math.ceil((z1 - z0) / step)))
        xs = [x0 + (x1 - x0) * i / nx for i in range(nx + 1)]; zs = [z0 + (z1 - z0) * j / nz for j in range(nz + 1)]
        Y = (lambda x, z: y + yfn(x, z)) if yfn else (lambda x, z: y)
        C = colfn or (lambda x, z: (0, 0, 0, 1))
        with self.part(): self._grid(xs, zs, nx, nz, Y, C, m, **k)
        return self
    def _grid(self, xs, zs, nx, nz, Y, C, m, **k):
        for j in range(nz):
            for i in range(nx):
                a, b_, c, d = (xs[i], zs[j + 1]), (xs[i + 1], zs[j + 1]), (xs[i + 1], zs[j]), (xs[i], zs[j])
                pts = [(p[0], Y(*p), p[1]) for p in (a, b_, c, d)]
                self.poly(pts, m, col=[C(p[0], p[1]) for p in (a, b_, c, d)], **k)
    def build(self, coll=None, bevel=0.0, bevel_seg=2, bevel_angle=40, smooth_angle=35):
        # svejsning pr. del: hjørner deles kun inden for samme del (løse polygoner svejses indbyrdes) – ingen ikke-mangfoldige
        # samlinger mellem dele der blot rører hinanden (dem kan fasningen ikke håndtere)
        idx = {}; V = []; F = []; keep = []
        for pi, f in enumerate(self.f):
            g = self.grp[pi]; out = []
            for vi in f:
                p = self.v[vi]; key = (g, round(p[0] * 2e3), round(p[1] * 2e3), round(p[2] * 2e3))
                j = idx.get(key)
                if j is None: j = idx[key] = len(V); V.append(p)
                if not out or out[-1] != j: out.append(j)
            if len(out) > 1 and out[0] == out[-1]: out.pop()
            if len(set(out)) >= 3 and len(set(out)) == len(out): F.append(out); keep.append(pi)
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([B(*p) for p in V], [], F)
        me.update()
        uvl = me.uv_layers.new(name='UVMap')
        ca = me.color_attributes.new(name='blend', type='FLOAT_COLOR', domain='CORNER')
        for qi, poly in enumerate(me.polygons):
            pi = keep[qi]; f = self.f[pi]
            poly.material_index = self.mat[pi]; poly.use_smooth = self.smooth[pi]
            # hjørne-data følger de oprindelige punkter (dubletter i polygonen er fjernet ovenfor – find dem via position)
            src = {}
            for k, vi in enumerate(f): src.setdefault(tuple(round(c * 2e3) for c in self.v[vi]), k)
            for loop in poly.loop_indices:
                co = V[me.loops[loop].vertex_index]; k = src.get(tuple(round(c * 2e3) for c in co), 0)
                uvl.data[loop].uv = self.uv[pi][k]; ca.data[loop].color = self.col[pi][k]
        ob = bpy.data.objects.new(self.name, me)
        (coll or bpy.context.scene.collection).objects.link(ob)
        for m in self.mats: me.materials.append(mat(m))
        if bevel > 0:
            md = ob.modifiers.new('bevel', 'BEVEL'); md.width = bevel; md.segments = bevel_seg; md.limit_method = 'ANGLE'
            md.angle_limit = math.radians(bevel_angle); md.harden_normals = True; md.miter_outer = 'MITER_SHARP'; md.use_clamp_overlap = True
        # vinkelbaseret glatning (Blender 4.1+: 'Smooth by Angle'-modifier / mesh-metode)
        try: me.set_sharp_from_angle(angle=math.radians(smooth_angle))
        except Exception: pass
        for p in me.polygons: p.use_smooth = True
        return ob

def world_uv(pts, m, off=(0, 0), rot=0.0):
    """planprojektion efter fladens normal; skala = materialets virkelige mål (m) – tekstur-hjørne i (u0, v0)"""
    size = MATS[m].get('size') or tex_size(MATS[m].get('tex')) or 2.0
    a = Vector(pts[0]); b = Vector(pts[1]); c = Vector(pts[2])
    n = (b - a).cross(c - a)
    if n.length < 1e-9 and len(pts) > 3: n = (Vector(pts[2]) - a).cross(Vector(pts[3]) - a)
    n = n.normalized() if n.length > 1e-12 else Vector((0, 1, 0))
    ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
    out = []
    cr, sr = math.cos(rot), math.sin(rot)
    for p in pts:
        x, y, z = p
        if ay >= ax and ay >= az: u, v = x, -z if n.y > 0 else z             # gulv/loft: x, −z (nord op)
        elif ax >= az: u, v = (-z if n.x > 0 else z), y                       # væg mod øst/vest
        else: u, v = (x if n.z > 0 else -x), y                                # væg mod nord/syd
        u, v = u * cr - v * sr, u * sr + v * cr
        out.append(((u + off[0]) / size, (v + off[1]) / size))
    return out

def tex_size(pid):
    if not pid: return None
    d = TEXDIM.get(pid); return (d[0] / 1000.0) if d else None

# ---------------------------------------------------------------- materialer (til bagning: farve + ruhed; spillet bruger fulde PBR-sæt)
MATS = {}            # navn -> {'tex': poly haven-id | None, 'tint': (r,g,b), 'rough': f, 'metal': f, 'size': m, 'emit': ..., 'kind': 'opaque'|'glass'|'water'}
_mat_cache = {}
def defmat(name, tex=None, tint=(1, 1, 1), rough=None, metal=0.0, size=None, kind='opaque', emit=None, color=None, files=None, unlit=False):
    MATS[name] = {'tex': tex, 'tint': tint, 'rough': rough, 'metal': metal, 'size': size, 'kind': kind, 'emit': emit, 'color': color, 'files': files, 'unlit': unlit}
def mat(name):
    if name in _mat_cache: return _mat_cache[name]
    d = MATS[name]; m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; P = nt.nodes['Principled BSDF']
    if d['tex'] and d.get('files'):                                               # de_bureau: egne filer (albedo/normal/ORM)
        f = d['files']; t = nt.nodes.new('ShaderNodeTexImage'); t.image = load_img(f['d'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        nt.links.new(t.outputs['Color'], mix.inputs['A']); mix.inputs['B'].default_value = (*d['tint'], 1)
        nt.links.new(mix.outputs['Result'], P.inputs['Base Color'])
        if d.get('alpha'): nt.links.new(t.outputs['Alpha'], P.inputs['Alpha'])
        if d['unlit']:                                                               # byens facader lyser selv (ingen bagning)
            nt.links.new(mix.outputs['Result'], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = 1.0
    elif d['tex']:
        img = load_img(os.path.join(CACHE, 'tex', d['tex'], d['tex'] + '_diff.jpg'))
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        nt.links.new(t.outputs['Color'], mix.inputs['A']); mix.inputs['B'].default_value = (*d['tint'], 1)
        nt.links.new(mix.outputs['Result'], P.inputs['Base Color'])
        arm = os.path.join(CACHE, 'tex', d['tex'], d['tex'] + '_arm.jpg')
        if os.path.exists(arm) and d['rough'] is None:
            ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = load_img(arm, data=True)
            sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(ta.outputs['Color'], sep.inputs['Color'])
            nt.links.new(sep.outputs['Green'], P.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], P.inputs['Metallic'])
        nor = os.path.join(CACHE, 'tex', d['tex'], d['tex'] + '_nor.jpg')
        if os.path.exists(nor):
            tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = load_img(nor, data=True)
            nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
            nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])
    else:
        P.inputs['Base Color'].default_value = (*(d['color'] or d['tint']), 1)
    if d['rough'] is not None: P.inputs['Roughness'].default_value = d['rough']
    if not d['tex']: P.inputs['Metallic'].default_value = d['metal']
    if d['kind'] == 'glass':                                                  # gennemsigtigt i bagningen (sollys ind gennem vinduer/ovenlys)
        P.inputs['Roughness'].default_value = 0.02; P.inputs['Base Color'].default_value = (0.95, 0.97, 0.98, 1)
        P.inputs['Transmission Weight'].default_value = 1.0; P.inputs['IOR'].default_value = 1.45
        m.use_backface_culling = False
    if d['kind'] == 'water':
        P.inputs['Base Color'].default_value = (0.01, 0.025, 0.03, 1); P.inputs['Roughness'].default_value = 0.08
    if d['emit']:
        P.inputs['Emission Color'].default_value = (*d['emit'][:3], 1); P.inputs['Emission Strength'].default_value = d['emit'][3]
    _mat_cache[name] = m; return m
_img = {}
def load_img(path, data=False):
    if path in _img: return _img[path]
    im = bpy.data.images.load(path, check_existing=True)
    if data: im.colorspace_settings.name = 'Non-Color'
    _img[path] = im; return im

def coll(name):
    c = bpy.data.collections.get(name)
    if not c: c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c
