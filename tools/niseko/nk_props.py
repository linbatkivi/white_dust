# ==========================================================================
# de_niseko · de grønne felter i minimappet, tehus, balkon og lanterner: rigtigt udseende med præcis samme mål som kollisionen
# ==========================================================================
import math, random
import nk_plants, nk_models
from nk_geo import *

def bbox(p):
    xs = [q[0] for q in p['poly']]; zs = [q[1] for q in p['poly']]; return min(xs), min(zs), max(xs), max(zs)

def stonewall(S, x0, z0, x1, z1, h, mat='nk_bank'):
    W, T = S['walls'], S['trim']
    W.box(x0, 0.0, z0, x1, h - 0.07, z1, mat, faces='nsew')
    T.box(x0, h - 0.07, z0, x1, h, z1, 'nk_stonebase', faces='nsewt')

def bonsai(S, x, y, z, rnd, s=1.0):
    """miniaturefyr i keramikkrukke: snoet stamme + tre nålepuder"""
    B, F = S['bark'], S['fol']
    nk_models.place('ceramic_pot', x, y, z, rnd.uniform(0, 360), 0.55 * s)
    base = y + 0.30 * s
    pts = [(x + 0.07 * math.sin(i * 1.3) * s, base + 0.36 * s * i / 5, z + 0.06 * math.cos(i * 1.1) * s) for i in range(6)]
    nk_plants.tube(B, pts, 0.034 * s, 0.014 * s, seg=5, uvsz=0.3)
    for k, (lv, rr) in enumerate(((0.45, 0.2), (0.75, 0.26), (1.0, 0.2))):
        p = pts[min(5, int(lv * 5))]; a = rnd.uniform(0, 6.28); c = (p[0] + math.cos(a) * 0.1 * s, p[1] + 0.03 * s, p[2] + math.sin(a) * 0.1 * s)
        for q in range(3):
            yaw = rnd.uniform(0, 6.28); right = (math.cos(yaw), 0, math.sin(yaw)); fwd = (-right[2], 0, right[0])
            nk_plants.card(F, 'fol_pine', c, right, fwd, 0.5 * s * rr / 0.2, 0.5 * s * rr / 0.2)
            nk_plants.card(F, 'fol_pine', (c[0], c[1] + 0.04 * s, c[2]), right, (0, 1, 0), 0.44 * s * rr / 0.2, 0.3 * s)

def cargo(S, x0, z0, x1, z1, h, rnd):
    """lagerkasser i et gitter der fylder hele feltet (samme udstrækning som kollisionen)"""
    T = S['trim']; w, d = x1 - x0, z1 - z0
    nx = max(1, round(w / 0.85)); nz = max(1, round(d / 0.85)); ny = max(1, round(h / 0.44)); mats = ['nk_beam', 'nk_cedar_d', 'nk_fence', 'nk_timber']
    cw, cd, ch = w / nx, d / nz, h / ny
    for k in range(ny):
        for i in range(nx):
            for j in range(nz):
                g = 0.015; m = mats[rnd.randrange(len(mats))]
                bx0, bz0, by0 = x0 + i * cw + g, z0 + j * cd + g, k * ch + 0.005
                T.box(bx0, by0, bz0, bx0 + cw - 2 * g, by0 + ch - 0.01, bz0 + cd - 2 * g, m, faces='nsewt')
                T.box(bx0 - 0.004, by0 + ch * 0.18, bz0 - 0.004, bx0 + cw - 2 * g + 0.004, by0 + ch * 0.26, bz0 + cd - 2 * g + 0.004, 'nk_rope', faces='nsew')

def tawara(S, x0, z0, x1, z1, h):
    """stabel af risballer (tawara) langs feltets lange side"""
    T = S['trim']; w, d = x1 - x0, z1 - z0; along_z = d >= w; L = d if along_z else w; Wd = w if along_z else d
    r = min(0.26, Wd / 4.0, h / 5.3); across = max(1, int(Wd / (2 * r))); r = Wd / (2 * across)
    layers = max(1, int((h - r) / (1.74 * r)) + 1); blen = 0.85; nb = max(1, int(L / blen)); bl = L / nb
    for k in range(layers):
        off = r if k % 2 else 0.0; cnt = across if not k % 2 else across - 1
        for i in range(max(1, cnt)):
            cw = (i + 0.5) * 2 * r + off if k % 2 else (i + 0.5) * 2 * r
            for q in range(nb):
                a0 = q * bl + 0.02; a1 = (q + 1) * bl - 0.02; yc = r + k * 1.74 * r
                if along_z: pa, pb = (x0 + cw, yc, z0 + a0), (x0 + cw, yc, z0 + a1)
                else: pa, pb = (x0 + a0, yc, z0 + cw), (x0 + a1, yc, z0 + cw)
                hcyl(T, pa, pb, r * 0.98, 'nk_bamboo', n=9, caps='ab', uvscale=0.8)
                for tt in (0.25, 0.75):
                    c = (pa[0] + (pb[0] - pa[0]) * tt, yc, pa[2] + (pb[2] - pa[2]) * tt)
                    hcyl(T, (c[0] - (0.012 if not along_z else 0), c[1], c[2] - (0.012 if along_z else 0)), (c[0] + (0.012 if not along_z else 0), c[1], c[2] + (0.012 if along_z else 0)), r * 1.02, 'nk_rope', n=9, caps='', uvscale=0.3)
    # sokkel så intet svæver
    T.box(x0, 0.0, z0, x1, 0.04, z1, 'nk_timber', faces='nsewt')

def bedbox(S, x0, z0, x1, z1, h, rnd, mats=('fol_azalea', 'fol_bush')):
    T, F = S['trim'], S['fol']
    T.box(x0, 0.0, z0, x1, h - 0.06, z1, 'nk_beam', faces='nsew'); T.box(x0, h - 0.07, z0, x1, h - 0.03, z1, 'nk_black_lac', faces='nsewt')
    T.poly([(x0 + 0.05, h - 0.03, z0 + 0.05), (x1 - 0.05, h - 0.03, z0 + 0.05), (x1 - 0.05, h - 0.03, z1 - 0.05), (x0 + 0.05, h - 0.03, z1 - 0.05)], 'nk_soil', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, 1, 0))
    w, d = x1 - x0, z1 - z0; along_z = d >= w; L = d if along_z else w; n = max(1, int(L / 0.85))
    for k in range(n):
        a = (k + 0.5) * L / n; cx = x0 + w / 2 if along_z else x0 + a; cz = z0 + a if along_z else z0 + d / 2
        nk_plants.bush(F, cx, cz, h - 0.03, rnd, r=min(0.62, max(w, d) / 2 if not along_z else w / 2 + 0.25) if False else rnd.uniform(0.45, 0.6), mat=mats[k % len(mats)], n=11)

def dress_prop(S, p, rnd):
    x0, z0, x1, z1 = bbox(p); h = p['h']; st = p['style']; T = S['trim']; W = S['walls']
    if st in ('spring', 'lowwall', 'gardenwall'):
        stonewall(S, x0, z0, x1, z1, h, 'nk_bank' if st != 'spring' else 'nk_stonebase')
        if st == 'spring':                                                                  # bambusrør der leder kildevandet ud i kanalen
            cx = (x0 + x1) / 2; hcyl(T, (cx, h - 0.28, z1 - 0.1), (cx, h - 0.3, z1 + 0.65), 0.05, 'nk_bamboo', n=8, caps='b', uvscale=0.5)
            for dx in (-0.45, 0.45): nk_plants.bush(S['fol'], cx + dx, z0 + 0.5, h, rnd, r=0.5, mat='fol_bush', n=9)
    elif st == 'barrels':
        nx, nz = 2, 3; cw, cd = (x1 - x0) / nx, (z1 - z0) / nz
        for i in range(nx):
            for j in range(nz): nk_models.place('wine_barrel_01', x0 + (i + 0.5) * cw, 0.0, z0 + (j + 0.5) * cd, rnd.uniform(0, 360), sx=(min(cw, cd) / 0.74), sy=(min(cw, cd) / 0.74), sz=h / 0.87)
    elif st in ('fence', 'planter'): bedbox(S, x0, z0, x1, z1, h, rnd)
    elif st == 'bench':                                                                       # stenbord med bonsai
        stonewall(S, x0, z0, x1, z1, h, 'nk_stonebase')
        n = 3
        for k in range(n): bonsai(S, x0 + (k + 0.5) * (x1 - x0) / n, h, (z0 + z1) / 2, rnd, 1.1)
    elif st == 'crates': cargo(S, x0, z0, x1, z1, h, rnd)
    elif st == 'shelf': tawara(S, x0, z0, x1, z1, h)
    elif st == 'doorpost':                                                                    # tømmer-skillevæg der deler døren i to
        T.box(x0, 0.0, z0, x1, 0.3, z1, 'nk_stonebase', faces='nsewt'); W.box(x0 + 0.1, 0.3, z0 + 0.1, x1 - 0.1, h - 0.3, z1 - 0.1, 'nk_plaster_w', faces='nsew')
        for xx in (x0, x1 - 0.2): T.box(xx, 0.3, z0, xx + 0.2, h, z1, 'nk_timber', faces='nsewt')
        T.box(x0, h - 0.3, z0, x1, h, z1, 'nk_timber', faces='nsewt'); T.box(x0 + 0.2, 1.4, z0 - 0.03, x1 - 0.2, 1.5, z0, 'nk_black_lac', faces='nsewt')
        T.box(x0 + 0.2, 1.4, z1, x1 - 0.2, 1.5, z1 + 0.03, 'nk_black_lac', faces='nsewt')
    else: T.box(x0, 0.0, z0, x1, h, z1, 'nk_beam', faces='nsewt')

def teahouse(S, D, rnd):
    th = D['teahouse']; T, W = S['trim'], S['walls']; F = S['far']
    for w in th['walls']:
        x0, z0, x1, z1 = w; h = th['wall_h']
        horiz = (x1 - x0) >= (z1 - z0); L = (x1 - x0) if horiz else (z1 - z0)
        W.box(x0, 0.0, z0, x1, 0.5, z1, 'nk_stonebase', faces='nsew'); W.box(x0, 0.5, z0, x1, h, z1, 'nk_plaster_w', faces='nsew')
        T.box(x0 - 0.02, h - 0.16, z0 - 0.02, x1 + 0.02, h, z1 + 0.02, 'nk_timber', faces='nsewt'); T.box(x0 - 0.02, 0.5, z0 - 0.02, x1 + 0.02, 0.62, z1 + 0.02, 'nk_timber', faces='nsewt')
        nbay = max(1, int(L / 1.9)); bay = L / nbay
        for k in range(nbay + 1):
            a = min(max(k * bay, 0.07), L - 0.07)
            if horiz: T.box(x0 + a - 0.07, 0.5, z0 - 0.03, x0 + a + 0.07, h - 0.16, z1 + 0.03, 'nk_timber', faces='nsewt')
            else: T.box(x0 - 0.03, 0.5, z0 + a - 0.07, x1 + 0.03, h - 0.16, z0 + a + 0.07, 'nk_timber', faces='nsewt')
        for k in range(nbay):                                                  # lyse skærme mellem stolperne (begge sider)
            a0, a1 = k * bay + 0.16, (k + 1) * bay - 0.16
            for side in (0, 1):
                if horiz:
                    zz = z0 - 0.012 if side == 0 else z1 + 0.012; fr = Fr((x0 + a0, zz), (1.0, 0.0), (0.0, -1.0 if side == 0 else 1.0))
                else:
                    xx = x0 - 0.012 if side == 0 else x1 + 0.012; fr = Fr((xx, z0 + a0), (0.0, 1.0), (-1.0 if side == 0 else 1.0, 0.0))
                vquad(T, fr, 0, a1 - a0, 0.0, 0.85, h - 0.45, 'nk_shoji', 0.0)
                nslat = int((a1 - a0) / 0.16)
                for q in range(1, nslat): obox(T, fr, q * (a1 - a0) / nslat - 0.013, q * (a1 - a0) / nslat + 0.013, 0.0, 0.05, 0.85, h - 0.45, 'nk_black_lac', faces='flr')
                obox(T, fr, 0, a1 - a0, 0.0, 0.05, 0.82, 0.88, 'nk_black_lac', faces='fltrd'); obox(T, fr, 0, a1 - a0, 0.0, 0.05, h - 0.48, h - 0.42, 'nk_black_lac', faces='fltrd')
    c = th['counter']; T.box(c[0], 0.0, c[1], c[2], 0.92, c[3], 'nk_beam', faces='nsewt'); T.box(c[0] - 0.05, 0.92, c[1] - 0.05, c[2] + 0.05, 1.0, c[3] + 0.05, 'nk_hinoki', faces='nsewtb')
    # tag: hjørnetag (hip) over hele feltet, udhæng 0,6 m; undersiden i mørkt træ
    rx0, rz0, rx1, rz1 = th['roof']; y0 = th['roof_y']; o = 0.6; hh = 1.0
    cx, cz = (rx0 + rx1) / 2, (rz0 + rz1) / 2; ax0, az0, ax1, az1 = rx0 - o, rz0 - o, rx1 + o, rz1 + o
    ridge_hw = max(0.3, (rx1 - rx0) / 2 - (rz1 - rz0) / 2 * 0.0 - 1.6)
    top = y0 + 0.32 + hh; rr = [(cx - 1.0, top, cz), (cx + 1.0, top, cz)]
    sz = tsz('nk_roof2')
    def tri(a, b, c, mat='nk_roof2'): F.poly([a, b, c], mat, uv=[(a[0] / sz, a[2] / sz), (b[0] / sz, b[2] / sz), (c[0] / sz, c[2] / sz)], want=(0, 1, 0))
    def quad(a, b, c, d, mat='nk_roof2'): F.poly([a, b, c, d], mat, uv=[(p[0] / sz, p[2] / sz) for p in (a, b, c, d)], want=(0, 1, 0))
    ye = y0 + 0.02
    quad((ax0, ye, az1), (ax1, ye, az1), (rr[1][0], top, cz), (rr[0][0], top, cz)); quad((ax1, ye, az0), (ax0, ye, az0), (rr[0][0], top, cz), (rr[1][0], top, cz))
    tri((ax0, ye, az0), (ax0, ye, az1), rr[0]); tri((ax1, ye, az1), (ax1, ye, az0), rr[1])
    T.poly([(ax0, ye - 0.05, az0), (ax1, ye - 0.05, az0), (ax1, ye - 0.05, az1), (ax0, ye - 0.05, az1)], 'nk_timber', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, -1, 0))
    for (a, b, c_, d_) in ((ax0, az0, ax1, az0), (ax1, az0, ax1, az1), (ax1, az1, ax0, az1), (ax0, az1, ax0, az0)):
        n = ((d_ - b), -(c_ - a)); l = math.hypot(*n) or 1; n = (n[0] / l, n[1] / l)
        T.poly([(a, ye - 0.05, b), (c_, ye - 0.05, d_), (c_, ye + 0.12, d_), (a, ye + 0.12, b)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(n[0], 0, n[1]))
    T.box(rr[0][0], top, cz - 0.15, rr[1][0], top + 0.2, cz + 0.15, 'nk_roofcap', faces='nsewt')
    nk_arch_lights = None

def balcony(S, D, rnd):
    T = S['trim']; b = D['balcony']; x0, z0, x1, z1 = b['deck']; y = b['y']; sx0, sz0, sx1, sz1 = b['stair']
    nz = int((z1 - z0) / 0.18)
    for k in range(nz): T.box(x0, y - 0.07, z0 + k * (z1 - z0) / nz, x1, y, z0 + (k + 1) * (z1 - z0) / nz - 0.012, 'nk_deck', faces='t')
    T.box(x0, y - 0.3, z0, x1, y - 0.07, z1, 'nk_beam', faces='nsewb')
    for k in range(int((x1 - x0) / 1.8) + 1):                                              # bjælker under dækket og stolper (kollision i layout)
        xx = x0 + k * (x1 - x0) / max(1, int((x1 - x0) / 1.8))
        T.box(xx - 0.08, y - 0.3, z0, xx + 0.08, y - 0.07, z1, 'nk_timber', faces='nsewb')
    for px in (x0 + 0.15, (x0 + x1) / 2, x1 - 0.15): T.box(px - 0.15, 0.0, z1 - 0.35, px + 0.15, y - 0.3, z1 - 0.05, 'nk_timber', faces='nsewt')
    # rækværk langs sydkanten (1,0 m): stolper + to rækker
    nposts = int((x1 - x0) / 1.4) + 1
    for k in range(nposts):
        xx = x0 + k * (x1 - x0) / (nposts - 1); T.box(xx - 0.05, y, z1 - 0.1, xx + 0.05, y + 1.0, z1 - 0.0, 'nk_black_lac', faces='nsewt')
    for yy in (y + 0.55, y + 0.92): T.box(x0, yy, z1 - 0.07, x1, yy + 0.07, z1 - 0.03, 'nk_black_lac', faces='nsewt')
    # trappe: trin og vangestykker (kollision: 15 trin langs x)
    n = 15; run = (sx1 - sx0) / n; rise = y / n
    for i in range(n):
        xa, xb = sx0 + i * run, sx0 + (i + 1) * run; top = y - (i + 1) * rise
        T.box(xa, top - 0.05, sz0, xb, top, sz1, 'nk_deck', faces='nsewt')
    L = math.hypot(sx1 - sx0, y)
    for zz in (sz0, sz1 - 0.08): T.box(sx0, 0.0, zz, sx1, 0.1, zz + 0.08, 'nk_timber', faces='nsewt')
    for k in range(6):
        xx = sx0 + k * (sx1 - sx0) / 5; yy = y - (xx - sx0) / (sx1 - sx0) * y
        T.box(xx - 0.04, yy, sz1 - 0.1, xx + 0.04, yy + 0.95, sz1 - 0.02, 'nk_black_lac', faces='nsewt')
    T.poly([(sx0, y + 0.95, sz1 - 0.06), (sx1, 0.95, sz1 - 0.06), (sx1, 1.0, sz1 - 0.06), (sx0, y + 1.0, sz1 - 0.06)], 'nk_black_lac', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], want=(0, 0, 1))

def build(D, S):
    rnd = random.Random(3)
    for p in D['props']: dress_prop(S, p, rnd)
    teahouse(S, D, rnd); balcony(S, D, rnd)

def lanterns(S, L):
    """papirlanterner (chōchin) på arme ved facaderne – rød eller varm orange – (ingen kollision: hænger over hovedhøjde eller ved døren i ≥ 2,2 m)"""
    T = S['trim']
    for e in L:
        if e['kind'] != 'chochin': continue
        x, y, z = e['x'], e['y'], e['z']; nx, nz = e['n']
        mat_ = 'nk_paper_red' if e.get('red') else 'nk_paper'
        lantern_mesh(T, None, x, y, z, r=0.19, h=0.46, mat=mat_, n=10)
        wx, wz = x - nx * 0.38, z - nz * 0.38
        ux, uz = -nz, nx
        T.box(min(wx, x) - 0.02 - abs(ux) * 0.0, y + 0.26, min(wz, z) - 0.02, max(wx, x) + 0.02, y + 0.30, max(wz, z) + 0.02, 'nk_timber', faces='nsewtb')
