# ==========================================================================
# Ascension Agency – arkitekturdetaljer og indretning (kaldes fra build_map.py efter rå-huset):
#   døre (karm, overligger, dørblad – glas i lobbyen, stål ellers) · fodlister · gelændere ved niveauspring · søjler
#   indretning: overblikkets dækningsfelter → rigtigt inventar efter rummets funktion (serverracks, skriveborde, skranke, hylder …)
#   + småting langs væggene (brandslukkere, kameraer, ure, planter, el-skabe, ventilationskanaler)
# Alt i spil-koordinater (X øst, Y op, Z syd). Props skrives som instanser (Godot sætter modellerne ind).
# ==========================================================================
import json, os, math, random
import numpy as np

def run(B, ROOMS, MATS, MI):
    """B = build_map-modulets globale navnerum (F, C, ZID, WALK, …). Returnerer props-listen."""
    F, C, ZID, WALK, INDOOR, OUT, SLOPE, STEPS = B['F'], B['C'], B['ZID'], B['WALK'], B['INDOOR'], B['OUT'], B['SLOPE'], B['STEPS']
    H, W, S, cx, cz, VIS, COL, ZN, M = B['H'], B['W'], B['S'], B['cx'], B['cz'], B['VIS'], B['COL'], B['ZN'], B['M']
    rnd = random.Random(11)
    zname = lambda i, j: ZN[ZID[i, j]] if ZID[i, j] >= 0 else None
    props = []

    def box(mesh, x0, y0, z0, x1, y1, z1, mat, faces='nsewtb'):
        """akse-orienteret kasse (synlig eller kollision) – UV i meter"""
        P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        Q = {'n': (1, 0, 3, 2), 's': (4, 5, 6, 7), 'w': (0, 4, 7, 3), 'e': (5, 1, 2, 6), 't': (3, 7, 6, 2), 'b': (0, 1, 5, 4)}
        for f in faces:
            q = [P[k] for k in Q[f]]
            uv = [((p[0] if f in 'nstb' else p[2]), (p[1] if f not in 'tb' else p[2])) for p in q]
            mesh.quad(q, mat, uv)

    # ------------------------------------------------------------ døre: korte indsnævringer gennem en mur (0,7–4,2 m brede, ≤ 1,7 m dybe),
    # der på begge sider åbner sig til et bredere rum. Karm i hele murens dybde, overligger op til loftet, dørblad slået op mod væggen.
    GLASSY = {'Mid', 'Mid T', 'T Base', 'Top Mid', 'Mid Door', 'Arch', 'Balkonen', 'Heaven', 'Connector', 'T Ramp', 'T Spawn'}
    def runs_of(mask):
        """pr. linje: liste af (a, b) gangbare løb (b eksklusiv)"""
        out = []
        for line in mask:
            d = np.diff(np.concatenate([[0], line.view(np.int8), [0]])); st = np.flatnonzero(d == 1); en = np.flatnonzero(d == -1)
            out.append(list(zip(st, en)))
        return out
    def run_at(runs, i, j):
        for a, b in runs[i]:
            if a <= j < b: return (a, b)
        return None
    doors = []
    for axis in ('z', 'x'):                                                   # 'z': passage langs z (åbning i en øst-vest-mur)
        mask = WALK if axis == 'z' else WALK.T
        runs = runs_of(mask); NL = mask.shape[0]
        seen = set()
        for i in range(NL):
            for (a, b) in runs[i]:
                w = b - a
                if w < 6 or w > 60 or (i, a, b) in seen: continue
                # stak af rækker med (næsten) samme smalle løb
                r1 = i
                while r1 + 1 < NL:
                    rr = run_at(runs, r1 + 1, (a + b) // 2)
                    if rr is None or abs(rr[0] - a) > 1 or abs(rr[1] - b) > 1: break
                    r1 += 1; seen.add((r1, rr[0], rr[1]))
                L = r1 - i + 1
                if L > 14: continue
                before = run_at(runs, i - 1, (a + b) // 2) if i > 0 else None
                after = run_at(runs, r1 + 1, (a + b) // 2) if r1 + 1 < NL else None
                if not before or not after: continue
                wb_, wa_ = before[1] - before[0], after[1] - after[0]
                if max(wb_, wa_) < w + 6 or min(wb_, wa_) < w + 2: continue
                if axis == 'z': rect = (i, a, r1 + 1, b)                      # (i0, j0, i1, j1) i rasteret
                else: rect = (a, i, b, r1 + 1)
                i0, j0, i1, j1 = rect
                if (SLOPE[i0:i1, j0:j1] >= 0).any(): continue
                doors.append((axis, rect))
    ndoors = 0
    for axis, (i0, j0, i1, j1) in doors:
        cells = WALK[i0:i1, j0:j1]
        fl = float(np.nanmax(F[i0:i1, j0:j1])); cc = C[i0:i1, j0:j1]
        ceil = float(np.nanmin(cc)) if np.isfinite(cc).any() else fl + 3.2
        width = ((j1 - j0) if axis == 'z' else (i1 - i0)) * S
        top = fl + (2.2 if width <= 1.3 else 2.4 if width <= 2.7 else 2.9)
        if ceil - top < 0.08: top = ceil - 0.08
        names = {zname(i, j) for i in range(i0, i1) for j in range(j0, j1) if ZID[i, j] >= 0}
        glass = bool(names & GLASSY)
        x0, x1, z0, z1 = cx(j0), cx(j1), cz(i0), cz(i1)
        fr = 0.06
        # overligger (fylder op til loftet) – synlig og kollision
        if ceil - top > 0.02:
            wm = B['wallmat_of'](i0, j0) if INDOOR[i0, j0] else 'facade'
            if wm == 'lux_wall': wm = 'walnut'
            box(VIS, x0, top, z0, x1, ceil if np.isfinite(ceil) else top + 1.0, z1, wm, 'nsewb' if True else '')
            box(COL, x0, top, z0, x1, ceil, z1, 'wall', 'b'); B['HEADERS'].append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), round(top, 3), round(ceil, 3)])
        # karm: sideprofiler i hele dybden + øverste profil
        if axis == 'z':
            box(VIS, x0, fl, z0 - 0.015, x0 + fr, top, z1 + 0.015, 'trim_metal', 'nsew'); box(VIS, x1 - fr, fl, z0 - 0.015, x1, top, z1 + 0.015, 'trim_metal', 'nsew')
            box(VIS, x0, top - fr, z0 - 0.015, x1, top, z1 + 0.015, 'trim_metal', 'nsb')
        else:
            box(VIS, x0 - 0.015, fl, z0, x1 + 0.015, top, z0 + fr, 'trim_metal', 'nsew'); box(VIS, x0 - 0.015, fl, z1 - fr, x1 + 0.015, top, z1, 'trim_metal', 'nsew')
            box(VIS, x0 - 0.015, top - fr, z0, x1 + 0.015, top, z1, 'trim_metal', 'ewb')
        # dørblad(e) slået op mod væggen ved den ene ende af åbningen (kun hvis der er mur at slå op imod)
        leaves = 0 if width > 2.7 else 2 if width > 1.4 else 1; lw = (width - 2 * fr) / max(1, leaves); th = 0.05
        end = rnd.choice((0, 1))
        for k in range(leaves):
            if axis == 'z':
                zf = z0 if end == 0 else z1; sgn = -1 if end == 0 else 1          # mod rummet foran åbningen
                xa, xb = (x0 + fr - lw, x0 + fr) if k == 0 else (x1 - fr, x1 - fr + lw)
                jj = [int((x / S) + B['CX']) for x in np.linspace(xa + 0.05, xb - 0.05, 4)]
                ib = (i0 - 1) if end == 0 else i1
                if not all(0 <= j < W and 0 <= ib < H and not WALK[ib - sgn * 0, j] for j in jj): continue
                za_, zb_ = sorted((zf + sgn * 0.01, zf + sgn * (0.01 + th)))
                box(VIS, xa, fl + 0.01, za_, xb, top - 0.02, zb_, 'glass_door' if glass else 'door_leaf')
                if not glass: box(VIS, xa, fl + 0.01, za_ - 0.003, xb, fl + 0.22, zb_ + 0.003, 'trim_metal', 'nst')
            else:
                xf = x0 if end == 0 else x1; sgn = -1 if end == 0 else 1
                za, zb = (z0 + fr - lw, z0 + fr) if k == 0 else (z1 - fr, z1 - fr + lw)
                ii = [int((z / S) + B['CY']) for z in np.linspace(za + 0.05, zb - 0.05, 4)]
                jb = (j0 - 1) if end == 0 else j1
                if not all(0 <= i < H and 0 <= jb < W and not WALK[i, jb] for i in ii): continue
                xa_, xb_ = sorted((xf + sgn * 0.01, xf + sgn * (0.01 + th)))
                box(VIS, xa_, fl + 0.01, za, xb_, top - 0.02, zb, 'glass_door' if glass else 'door_leaf')
                if not glass: box(VIS, xa_ - 0.003, fl + 0.01, za, xb_ + 0.003, fl + 0.22, zb, 'trim_metal', 'ewt')
        # exit-skilt over døren (grønt, lyser svagt i bagningen)
        if width <= 2.7 and np.isfinite(ceil) and ceil - top > 0.35 and rnd.random() < 0.6:
            sy = top + 0.18
            if axis == 'z':
                zf = z0 - 0.02; box(VIS, (x0 + x1) / 2 - 0.17, sy, zf - 0.03, (x0 + x1) / 2 + 0.17, sy + 0.14, zf, 'exit_sign')
                B['LIGHTS'].append(dict(x=round((x0 + x1) / 2, 2), y=round(sy + 0.07, 2), z=round(zf - 0.12, 2), kind='exit'))
            else:
                xf = x0 - 0.02; box(VIS, xf - 0.03, sy, (z0 + z1) / 2 - 0.17, xf, sy + 0.14, (z0 + z1) / 2 + 0.17, 'exit_sign')
                B['LIGHTS'].append(dict(x=round(xf - 0.12, 2), y=round(sy + 0.07, 2), z=round((z0 + z1) / 2, 2), kind='exit'))
        ndoors += 1
    print('[dress] døre', ndoors)

    # ------------------------------------------------------------ fodlister langs væggene (malede/beton-vægge inde)
    BASE_WALLS = {MI[m] for m in ('plaster', 'plaster_warm', 'lux_wall', 'arch_concrete', 'metal_panel') if m in MI}
    wm = B['wmat']; nb = 0
    for axis in ('x', 'z'):
        for sgn in (1, -1):
            if axis == 'x':
                A = (slice(None), slice(0, W - 1)) if sgn > 0 else (slice(None), slice(1, W)); Bn = (slice(None), slice(1, W)) if sgn > 0 else (slice(None), slice(0, W - 1))
            else:
                A = (slice(0, H - 1), slice(None)) if sgn > 0 else (slice(1, H), slice(None)); Bn = (slice(1, H), slice(None)) if sgn > 0 else (slice(0, H - 1), slice(None))
            m = WALK[A] & ~WALK[Bn] & INDOOR[A] & np.isin(wm[A], list(BASE_WALLS)) & (SLOPE[A] < 0)
            fa = np.round(np.nan_to_num(F[A]) * 100).astype(np.int64)
            oi, oj = A[0].start or 0, A[1].start or 0
            if axis == 'x':
                for jl in range(m.shape[1]):
                    col = m[:, jl]
                    if not col.any(): continue
                    j = jl + oj; xb = cx(j + 1) if sgn > 0 else cx(j); i = 0
                    while i < len(col):
                        if not col[i]: i += 1; continue
                        k = fa[i, jl]; s = i
                        while i < len(col) and col[i] and fa[i, jl] == k: i += 1
                        y = k / 100; x0, x1 = sorted((xb, xb - sgn * 0.014))
                        box(VIS, x0, y, cz(s + oi), x1, y + 0.1, cz(i + oi), 'baseboard', 'ewt'); nb += 1
            else:
                for il in range(m.shape[0]):
                    row = m[il]
                    if not row.any(): continue
                    ii = il + oi; zb = cz(ii + 1) if sgn > 0 else cz(ii); j = 0
                    while j < len(row):
                        if not row[j]: j += 1; continue
                        k = fa[il, j]; s = j
                        while j < len(row) and row[j] and fa[il, j] == k: j += 1
                        y = k / 100; z0, z1 = sorted((zb, zb - sgn * 0.014))
                        box(VIS, cx(s + oj), y, z0, cx(j + oj), y + 0.1, z1, 'baseboard', 'nst'); nb += 1
    print('[dress] fodlister', nb)

    # ------------------------------------------------------------ gelændere ved niveauspring (> 0,45 m) uden trappe imellem
    GLASS_RAIL = {'Top Mid', 'Balkonen', 'Heaven', 'Arch', 'Mid', 'Søjlegangen A', 'Long A', 'Long A top', 'Mid T', 'T Base', 'A Site', 'A Forplads'}
    nr = 0
    for axis in ('x', 'z'):
        for sgn in (1, -1):
            if axis == 'x':
                A = (slice(None), slice(0, W - 1)) if sgn > 0 else (slice(None), slice(1, W)); Bn = (slice(None), slice(1, W)) if sgn > 0 else (slice(None), slice(0, W - 1))
            else:
                A = (slice(0, H - 1), slice(None)) if sgn > 0 else (slice(1, H), slice(None)); Bn = (slice(1, H), slice(None)) if sgn > 0 else (slice(0, H - 1), slice(None))
            fa, fb = np.nan_to_num(F[A], nan=-99), np.nan_to_num(F[Bn], nan=-99)
            same = (SLOPE[A] >= 0) & (SLOPE[A] == SLOPE[Bn])
            m = WALK[A] & WALK[Bn] & ((fa - fb > 0.6) | ((fa - fb > 0.3) & (SLOPE[A] >= 0))) & ~same   # trapper/ramper: brystning fra 0,3 m
            q = np.round(fa * 10).astype(np.int64)                                  # 10 cm trin langs trapper
            oi, oj = A[0].start or 0, A[1].start or 0
            def rail(x0, z0, x1, z1, y, ia, ja):
                nonlocal nr
                g = zname(ia, ja) in GLASS_RAIL; h = 1.05
                if SLOPE[ia, ja] >= 0 or (B['STEPS'][ia, ja]):                  # langs en trappe: kollision i trin – det synlige er den skrå brystning
                    box(COL, x0, y, z0, x1, y + h, z1, 'wall'); nr += 1
                    B['RAILS'].append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), round(y, 3), h]); return
                if g:
                    box(VIS, x0, y, z0, x1, y + h - 0.06, z1, 'glass')
                    box(VIS, x0 - 0.025, y + h - 0.07, z0 - 0.025, x1 + 0.025, y + h, z1 + 0.025, 'trim_metal')          # kraftig håndliste (tydelig om natten)
                    box(VIS, x0 - 0.008, y, z0 - 0.008, x1 + 0.008, y + 0.06, z1 + 0.008, 'trim_metal', 'nsewt')
                else:
                    box(VIS, x0, y + h - 0.045, z0, x1, y + h, z1, 'trim_metal'); box(VIS, x0, y + 0.5, z0, x1, y + 0.53, z1, 'trim_metal')
                    L = max(abs(x1 - x0), abs(z1 - z0)); nposts = max(2, int(L / 1.2) + 1)
                    for t in np.linspace(0, 1, nposts):
                        px = min(max(x0 + (x1 - x0) * t, x0 + 0.02), x1 - 0.02); pz = min(max(z0 + (z1 - z0) * t, z0 + 0.02), z1 - 0.02)
                        box(VIS, px - 0.02, y, pz - 0.02, px + 0.02, y + h, pz + 0.02, 'trim_metal', 'nsew')
                box(COL, x0, y, z0, x1, y + h, z1, 'wall'); nr += 1
                B['RAILS'].append([round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3), round(y, 3), h])
            if axis == 'x':
                for jl in range(m.shape[1]):
                    col = m[:, jl]
                    if not col.any(): continue
                    j = jl + oj; xb = cx(j + 1) if sgn > 0 else cx(j); i = 0
                    while i < len(col):
                        if not col[i]: i += 1; continue
                        k = q[i, jl]; s = i
                        while i < len(col) and col[i] and q[i, jl] == k: i += 1
                        x0, x1 = sorted((xb, xb - sgn * 0.05)); rail(x0, cz(s + oi), x1, cz(i + oi), float(fa[s, jl]), s + oi, j)
            else:
                for il in range(m.shape[0]):
                    row = m[il]
                    if not row.any(): continue
                    ii = il + oi; zb = cz(ii + 1) if sgn > 0 else cz(ii); j = 0
                    while j < len(row):
                        if not row[j]: j += 1; continue
                        k = q[il, j]; s = j
                        while j < len(row) and row[j] and q[il, j] == k: j += 1
                        z0, z1 = sorted((zb, zb - sgn * 0.05)); rail(cx(s + oj), z0, cx(j + oj), z1, float(fa[il, s]), ii, s + oj)
    print('[dress] gelænderstykker', nr)
    # ------------------------------------------------------------ skrå brystninger langs trapper/ramper (følger hældningen – ingen savtakker)
    FC = B['FC']; nb2 = 0
    def slope_wall(a0, a1, ha0, ha1, lo, axis, e, sgn, mat):
        """brystning fra a0 til a1 langs aksen, i linjen e (tværs), overkant ha0→ha1, underkant lo; tykkelse 0,08 m ud mod det lave rum"""
        t0, t1 = (e, e + sgn * 0.08)
        def P(a, y, t): return (t, y, a) if axis == 'z' else (a, y, t)
        top = 1.0
        A0 = [P(a0, lo, t0), P(a1, lo, t0), P(a1, ha1 + top, t0), P(a0, ha0 + top, t0)]
        A1 = [P(a0, lo, t1), P(a1, lo, t1), P(a1, ha1 + top, t1), P(a0, ha0 + top, t1)]
        uvs = lambda q: [((p[2] if axis == 'z' else p[0]), p[1]) for p in q]
        ctr = np.mean(np.array(A0 + A1), axis=0)
        def oq(q, want=None):                                                    # forsiden udad (væk fra midten) – eller i retningen want
            q = [np.array(v, float) for v in q]; n = np.cross(q[1] - q[0], q[2] - q[1]); d = want if want is not None else np.mean(q, axis=0) - ctr
            return [tuple(v) for v in (q if np.dot(n, d) >= 0 else q[::-1])]
        for q in (A0, A1): q2 = oq(q); VIS.quad(q2, mat, uvs(q2))
        for q in ([A0[0], A0[3], A1[3], A1[0]], [A0[1], A1[1], A1[2], A0[2]]): q2 = oq(q); VIS.quad(q2, mat, [(0, p[1]) for p in q2])
        cap = [P(a0, ha0 + top + 0.05, t0 - sgn * 0.02), P(a1, ha1 + top + 0.05, t0 - sgn * 0.02), P(a1, ha1 + top + 0.05, t1 + sgn * 0.02), P(a0, ha0 + top + 0.05, t1 + sgn * 0.02)]
        q2 = oq(cap, np.array([0, 1.0, 0])); VIS.quad(q2, 'trim_metal', [((p[2] if axis == 'z' else p[0]), p[0] if axis == 'z' else p[2]) for p in q2])
        for (u0, u1) in ((0, 1), (2, 3)):                                        # afdækningens forkanter (5 cm)
            e2 = [cap[u0], cap[u1], (cap[u1][0], cap[u1][1] - 0.05, cap[u1][2]), (cap[u0][0], cap[u0][1] - 0.05, cap[u0][2])]
            q2 = oq(e2, np.array(e2[0]) - np.mean(np.array(cap), axis=0)); VIS.quad(q2, 'trim_metal', uvs(q2))
    for k_, t_ in enumerate(B['TR']):
        x0r, y0r, x1r, y1r = t_['r']
        for side in (-1, 1):
            # cellerne langs trappens side og nabocellen udenfor (lavere gulv)
            if t_['axis'] == 'z':
                cells = [(i, x0r if side < 0 else x1r - 1, i, x0r - 1 if side < 0 else x1r) for i in range(y0r, y1r)]
            else:
                cells = [(y0r if side < 0 else y1r - 1, j, y0r - 1 if side < 0 else y1r, j) for j in range(x0r, x1r)]
            run = []
            def flush(run):
                nonlocal nb2
                if len(run) < 3: return
                (i_a, j_a, oi_a, oj_a), (i_b, j_b, oi_b, oj_b) = run[0], run[-1]
                lo = min(float(F[oi, oj]) for (_, _, oi, oj) in run) - 0.02
                if t_['axis'] == 'z': a0, a1, e = cz(i_a), cz(i_b + 1), (cx(x0r) if side < 0 else cx(x1r))
                else: a0, a1, e = cx(j_a), cx(j_b + 1), (cz(y0r) if side < 0 else cz(y1r))
                mat = 'walnut' if zname(i_a, j_a) in GLASS_RAIL else 'block_wall'
                slope_wall(a0, a1, float(FC[i_a, j_a]), float(FC[i_b, j_b]), lo, t_['axis'], e, side, mat); nb2 += 1
            for (i, j, oi, oj) in cells:
                ok = 0 <= oi < H and 0 <= oj < W and WALK[i, j] and WALK[oi, oj] and SLOPE[oi, oj] != k_ and FC[i, j] - F[oi, oj] > 0.3
                if ok: run.append((i, j, oi, oj))
                else: flush(run); run = []
            flush(run)
    print('[dress] skrå trappebrystninger', nb2)

    # ------------------------------------------------------------ indretning: dækningsfelter → inventar
    CUSTOM = 'res://assets/models/custom/%s.glb'; PH = 'res://assets/models/%s/%s.gltf'
    ph = lambda n: PH % (n, n)
    DIMS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'model_dims.json')))
    # v26: solide møbler får kollision efter deres egen form (målt i Blender, gen/modeldims_blender.py) – aldrig overblikkets felter
    SOLID = {'desk_pair', 'reception_desk', 'sofa_02', 'sofa_03', 'weapon_locker', 'server_rack', 'steel_frame_shelves_02', 'steel_frame_shelves_03',
             'wooden_military_crate', 'old_military_crate', 'concrete_road_barrier', 'metal_tool_chest', 'industrial_pastic_container', 'portable_generator',
             'tool_cart', 'covered_car', 'potted_plant_04', 'planter_large', 'plinth', 'coffee_bar', 'flight_case', 'flight_case_s', 'drawer_cabinet', 'bookshelf',
             'modern_coffee_table_01', 'cardboard_box_01', 'propane_tank'}
    def auto_coll(model, x, y, z, yaw):
        nm = model.split('/')[-1].rsplit('.', 1)[0]; d = DIMS.get(nm)
        if nm not in SOLID or not d: return None
        mn, mx = d['min'], d['max']; a = math.radians(yaw); c, s_ = math.cos(a), math.sin(a)
        xs, zs = [], []
        for px in (mn[0], mx[0]):
            for pz in (mn[2], mx[2]): xs.append(px * c + pz * s_); zs.append(-px * s_ + pz * c)
        x0, x1, z0, z1 = x + min(xs), x + max(xs), z + min(zs), z + max(zs)
        y0 = y if '/custom/' not in model else y + mn[1]; h = mx[1] - mn[1]
        if h < 0.25: return None                                                # tæpper, papir o.l.: ingen kollision
        return [(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0]
    def put(model, x, y, z, yaw=0.0, coll=None):
        if coll is None: coll = auto_coll(model, x, y, z, yaw)
        e = dict(m=model, p=[round(x, 3), round(y, 3), round(z, 3)], yaw=round(yaw, 1))
        if coll:
            # for lidt loftshøjde til at stå oven på (< 1,95 m): kollisionen går helt op til loftet – ingen fastklemning mellem bord og loft
            cxp_, cyp_, czp_, sx_, sy_, sz_ = coll; i_, j_ = int(czp_ / S + B['CY']), int(cxp_ / S + B['CX'])
            if 0 <= i_ < H and 0 <= j_ < W and np.isfinite(C[i_, j_]):
                top_, ce_ = cyp_ + sy_ / 2, float(C[i_, j_])
                if 0 < ce_ - top_ < 1.95: bot_ = cyp_ - sy_ / 2; coll = [cxp_, (bot_ + ce_) / 2, czp_, sx_, ce_ - bot_, sz_]
            e['c'] = [round(v, 3) for v in coll]
        props.append(e)
    def floor_at(x, z):
        i, j = int(z / S + B['CY']), int(x / S + B['CX'])
        return float(F[i, j]) if 0 <= i < H and 0 <= j < W and WALK[i, j] else None
    # passager (døråbninger, trapper/ramper) + 1,8 m: her står intet inventar – aldrig spærrede indgange
    FREE = (SLOPE >= 0).copy()
    for ax_, (i0, j0, i1, j1) in doors: FREE[max(0, i0):i1, max(0, j0):j1] = True
    FREE_D = FREE.copy()
    for _ in range(3):                                                         # 0,35 m: selve åbningen + lidt luft (dækning nær døre er ok)
        n_ = FREE_D.copy(); n_[1:] |= FREE_D[:-1]; n_[:-1] |= FREE_D[1:]; n_[:, 1:] |= FREE_D[:, :-1]; n_[:, :-1] |= FREE_D[:, 1:]; FREE_D = n_
    for _ in range(15):
        n_ = FREE.copy(); n_[1:] |= FREE[:-1]; n_[:-1] |= FREE[1:]; n_[:, 1:] |= FREE[:, :-1]; n_[:, :-1] |= FREE[:, 1:]; FREE = n_
    nskip = 0
    for (x0p, y0p, x1p, y1p, h) in M['cover']:
        if FREE_D[y0p:y1p, x0p:x1p].any():                                    # i en passage: flyt feltet væk (op til 1,7 m) i stedet for at droppe det
            fl0 = F[(y0p + y1p) // 2, (x0p + x1p) // 2]; best = None
            for r in range(2, 15):
                for (di, dj) in ((r, 0), (-r, 0), (0, r), (0, -r), (r, r), (r, -r), (-r, r), (-r, -r)):
                    a0, a1, b0, b1 = y0p + di, y1p + di, x0p + dj, x1p + dj
                    if a0 < 0 or b0 < 0 or a1 > H or b1 > W: continue
                    blk = WALK[a0:a1, b0:b1]
                    if blk.all() and not FREE_D[a0:a1, b0:b1].any() and np.nanmax(np.abs(F[a0:a1, b0:b1] - fl0)) < 0.05 and (SLOPE[a0:a1, b0:b1] < 0).all():
                        best = (a0, b0, a1, b1); break
                if best: break
            if not best: nskip += 1; continue
            y0p, x0p, y1p, x1p = best
        x0, z0, x1, z1 = cx(x0p), cz(y0p), cx(x1p), cz(y1p); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
        i, j = (y0p + y1p) // 2, (x0p + x1p) // 2; room = zname(i, j)
        if room is None: continue
        y = floor_at(xc, zc) or 0.0
        lx, lz = x1 - x0, z1 - z0; along_x = lx >= lz; L = max(lx, lz); Wd = min(lx, lz)
        yaw_long = 90.0 if along_x else 0.0                                  # modellens længde (x) langs feltets lange akse
        hh = h
        if room in ('A Site', 'A Forplads', 'Heaven' if Wd > 1.5 else '_'):
            n = max(1, int(L / 0.6)); hh = 2.0
            for k in range(n):
                t = (k + 0.5) / n - 0.5
                px, pz = (xc + t * L, zc) if along_x else (xc, zc + t * L)
                put(CUSTOM % 'server_rack', px, y, pz, 0.0 if along_x else 90.0)
        elif room in ('Long A', 'Long A top', 'B Halls øst', 'B Halls vest', 'Connector', 'Søjlegangen A', 'Back B', 'Heaven'):
            n = max(1, int(round(L / 1.65))); hh = 1.21
            for k in range(n):
                t = (k + 0.5) / n - 0.5
                px, pz = (xc + t * L, zc) if along_x else (xc, zc + t * L)
                yaw = 0.0 if along_x else 90.0
                put(CUSTOM % 'desk_pair', px, y, pz, yaw)
                for s in (-1, 1):                                                  # skærme og stole på begge sider
                    ox, oz = (0.0, s * 0.42) if along_x else (s * 0.42, 0.0)
                    mon = rnd.choice(('monitor_code', 'monitor_cctv', 'monitor_map'))
                    fy = (0.0 if s > 0 else 180.0) + (0 if along_x else 90.0)
                    put(CUSTOM % mon, px + ox * 0.55, y + 0.74, pz + oz * 0.55, fy + 180.0)
                    # afbrudt midt i arbejdet: tastatur, kaffe, papirer, af og til en bærbar eller bordlampe
                    kx, kz = px + ox * 0.82, pz + oz * 0.82
                    put(CUSTOM % 'keyboard_mouse', kx, y + 0.74, kz, fy + rnd.uniform(-8, 8))
                    lat = (1.0, 0.0) if along_x else (0.0, 1.0)
                    if rnd.random() < 0.75: put(CUSTOM % 'coffee_cup', kx + lat[0] * rnd.uniform(0.35, 0.6), y + 0.74, kz + lat[1] * rnd.uniform(0.35, 0.6), rnd.uniform(0, 360))
                    if rnd.random() < 0.7: put(CUSTOM % 'paper_stack', kx - lat[0] * rnd.uniform(0.35, 0.6), y + 0.74, kz - lat[1] * rnd.uniform(0.35, 0.6), rnd.uniform(0, 360))
                    if rnd.random() < 0.25: put(ph('classic_laptop'), kx - lat[0] * 0.55, y + 0.74, kz - lat[1] * 0.55, fy + 180 + rnd.uniform(-20, 20))
                    elif rnd.random() < 0.2: put(ph('desk_lamp_arm_01'), px + ox * 0.6 + lat[0] * 0.7, y + 0.74, pz + oz * 0.6 + lat[1] * 0.7, rnd.uniform(0, 360))
                    if rnd.random() < 0.8:
                        put(CUSTOM % 'office_chair', px + ox * 2.1 + rnd.uniform(-0.2, 0.2), y, pz + oz * 2.1 + rnd.uniform(-0.2, 0.2), fy + rnd.uniform(-35, 35))
        elif room == 'Mid':
            if L > 4.0:
                put(CUSTOM % 'reception_desk', xc, y, zc, 0.0 if along_x else 90.0); hh = 1.12
            else:
                put(ph('potted_plant_04'), xc, y, zc, rnd.uniform(0, 360)); hh = max(h, 1.1)
        elif room in ('Mid T', 'Top Mid', 'Arch', 'Balkonen'):
            put(ph('sofa_02'), xc, y, zc, yaw_long); hh = 0.9
        elif room == 'B Site':
            n = max(1, int(L / 1.02))
            for k in range(n):
                t = ((k + 0.5) / n - 0.5) * (n * 1.02 / L)                       # tæt række (2 cm mellemrum), ikke spredt ud over feltet
                px, pz = (xc + t * L, zc) if along_x else (xc, zc + t * L)
                # v26.3: skabene står ryg mod ryg med gitterdørene udad (før drejet 90° – man så kun de glatte sider)
                base = 0.0 if along_x else 90.0                                    # modellens bredde (x) langs rækken, forside (+z) på tværs
                for off in ((-0.26, 0.26) if Wd >= 0.95 else (0.0,)):
                    ox, oz = (0.0, off) if along_x else (off, 0.0)
                    put(CUSTOM % 'weapon_locker', px + ox, y, pz + oz, base + (180.0 if off < 0 else 0.0))
            hh = 1.9
        elif room in ('Storage', 'Pillars B'):
            n = max(1, int(L / 1.6))
            for k in range(n):
                t = (k + 0.5) / n - 0.5
                px, pz = (xc + t * L, zc) if along_x else (xc, zc + t * L)
                put(ph(rnd.choice(('steel_frame_shelves_02', 'steel_frame_shelves_03'))), px, y, pz, yaw_long)
            hh = 2.0
        elif room in ('CT Forgård', 'CT Spawn'):
            n = max(1, int(L / 1.25))
            for k in range(n):
                t = (k + 0.5) / n - 0.5
                px, pz = (xc + t * L, zc) if along_x else (xc, zc + t * L)
                put(CUSTOM % 'pallet', px, y, pz, yaw_long)
                put(ph(rnd.choice(('wooden_military_crate', 'old_military_crate', 'plastic_crate_01'))), px, y + 0.144, pz, yaw_long + rnd.choice((0, 180)))
        elif room in ('T Ramp', 'T Spawn'):
            n = max(1, int(L / 2.0))
            for k in range(n):
                t = (k + 0.5) / n - 0.5
                px, pz = (xc + t * L, zc) if along_x else (xc, zc + t * L)
                put(ph('concrete_road_barrier'), px, y, pz, yaw_long)
        else:                                                                       # kælder/teknik: værkstedsting
            put(ph(rnd.choice(('metal_tool_chest', 'industrial_pastic_container', 'portable_generator', 'tool_cart'))), xc, y, zc, yaw_long)

    # ------------------------------------------------------------ småting langs væggene
    def straight(m, axis, r=5):
        """v26.3: kun lige vægstykker (± 0,6 m langs væggen) – ikke savtakken på en skrå mur (kunst/TV hang skævt dér)"""
        ax = 0 if axis == 'x' else 1; out = m.copy()
        for k in range(1, r + 1): out &= np.roll(m, k, ax) & np.roll(m, -k, ax)
        return out
    def wall_spots(room_mask, spacing, slope=False):
        """punkter lige foran vægge i rummet: (x, z, yaw mod rummet)"""
        out = []
        for axis in ('x', 'z'):
            for sgn in (1, -1):
                if axis == 'x':
                    A = (slice(None), slice(0, W - 1)) if sgn > 0 else (slice(None), slice(1, W)); Bn = (slice(None), slice(1, W)) if sgn > 0 else (slice(None), slice(0, W - 1))
                else:
                    A = (slice(0, H - 1), slice(None)) if sgn > 0 else (slice(1, H), slice(None)); Bn = (slice(1, H), slice(None)) if sgn > 0 else (slice(0, H - 1), slice(None))
                m = room_mask[A] & ~WALK[Bn] & ((SLOPE[A] < 0) | slope)
                m = straight(m, axis)
                ii, jj = np.nonzero(m); oi, oj = A[0].start or 0, A[1].start or 0
                step = int(spacing / S)
                for i, j in zip(ii, jj):
                    i += oi; j += oj
                    if (i if axis == 'x' else j) % step: continue
                    if axis == 'x': x = cx(j + 1) if sgn > 0 else cx(j); z = cz(i + 0.5); yaw = -90.0 * sgn
                    else: x = cx(j + 0.5); z = cz(i + 1) if sgn > 0 else cz(i); yaw = 180.0 if sgn > 0 else 0.0
                    out.append((x, z, yaw, i, j))
        return out
    for zi, n in enumerate(ZN):
        r = ROOMS[n]
        if r['h'] is None: continue
        mask = ZID == zi
        spots = wall_spots(mask, 7.0); rnd.shuffle(spots)
        for k, (x, z, yaw, i, j) in enumerate(spots[:6]):
            fl = float(F[i, j]); rad = math.radians(yaw); ox, oz = math.sin(rad) * 0.12, math.cos(rad) * 0.12
            if k == 0: put(ph('korean_fire_extinguisher_01'), x + ox, fl, z + oz, yaw)
            elif k == 1 and r['light'] != 'none': put(ph('security_camera_01'), x + ox, float(C[i, j]) - 0.3, z + oz, yaw)
            elif k == 2 and n in ('Long A', 'B Halls øst', 'Connector', 'Back B', 'Mid', 'Mid T', 'T Base', 'Søjlegangen A', 'Top Mid'):
                put(ph(rnd.choice(('potted_plant_01', 'potted_plant_04', 'calathea_orbifolia_01'))), x + ox * 3, fl, z + oz * 3, rnd.uniform(0, 360))
            elif k == 3 and n in ('Vent-gangen', 'Rampen', 'Kryptgangen', 'Lower B', 'Tunnels', 'Storage', 'CT Forgård', 'Trappehallen', 'Vestpassagen'):
                put(ph(rnd.choice(('power_box_01', 'utility_box_01', 'utility_box_02'))), x + ox * 0.5, fl + 1.3, z + oz * 0.5, yaw)
            elif k == 4 and n in ('Long A', 'Connector', 'B Halls øst', 'Mid T', 'T Base'):
                put(ph('wall_clock'), x + ox * 0.2, fl + 2.3, z + oz * 0.2, yaw)
            elif k == 5 and n in ('B Halls vest', 'Vent-gangen', 'Storage', 'Lower B'):
                put(ph('metal_trash_can'), x + ox * 2.5, fl, z + oz * 2.5, rnd.uniform(0, 360))
    print('[dress] dækningsfelter sprunget over (i passager): %d' % nskip)
    # serverhallen og forpladsen: racks i rækker langs væggene (forsiden ud mod rummet) – aldrig foran trapper, ramper og døre (FREE)
    for n in ('A Site', 'A Forplads'):
        zi = ZN.index(n)
        for (x, z, yaw, i, j) in wall_spots(ZID == zi, 0.62):
            rad = math.radians(yaw); ox, oz = math.sin(rad) * 0.62, math.cos(rad) * 0.62
            px, pz = x + ox, z + oz
            ci, cj = int(pz / S + B['CY']), int(px / S + B['CX'])
            if not (0 <= ci < H and 0 <= cj < W and ZID[ci, cj] == zi and SLOPE[ci, cj] < 0) or FREE[ci, cj]: continue
            put(CUSTOM % 'server_rack', px, float(F[ci, cj]), pz, yaw, [px, float(F[ci, cj]) + 1.0, pz, 0.62 if abs(ox) < 0.1 else 1.07, 2.0, 1.07 if abs(ox) < 0.1 else 0.62])
    # site-dækning (CS' "default"-kasser): flightcases med IT-/våbenudstyr – én dobbeltstabel og én enkelt pr. site, ud fra sitets rektangel
    #   (u, v) = brøkdel af sitet (vest→øst, nord→syd), stak = lille kasse ovenpå (2,05 m: kan ikke ses over, kun hoppes på fra den lave)
    COVER = {'A': [(0.30, 0.52, 0.0, True), (0.76, 0.24, 90.0, False)], 'B': [(0.36, 0.45, 90.0, True), (0.78, 0.78, 0.0, False)]}
    for k_, lst in COVER.items():
        r_ = M['sites'][k_]; x0s, z0s, x1s, z1s = cx(r_[0]), cz(r_[1]), cx(r_[2]), cz(r_[3])
        for (u, v, yw, stack) in lst:
            px, pz = x0s + (x1s - x0s) * u, z0s + (z1s - z0s) * v
            i_, j_ = int(pz / S + B['CY']), int(px / S + B['CX']); fl = float(F[i_, j_])
            put(CUSTOM % 'flight_case', px, fl, pz, yw, [px, fl + 0.525, pz, 1.2, 1.05, 1.2])
            if stack:
                ex, ez = (0.9, 0.6) if yw % 180 == 0 else (0.6, 0.9)
                put(CUSTOM % 'flight_case_s', px - 0.08, fl + 1.05, pz + 0.1, yw + 4.0, [px - 0.08, fl + 1.35, pz + 0.1, ex, 0.6, ez])
    # ------------------------------------------------------------ v26: atriets midtpunkt – hængende lysring over en lounge-ø med skulptur
    def obox(mesh, cxp, y0, czp, ang, L, Wd, Hh, mat):
        """roteret kasse (om y): længde L langs vinklen ang, bredde Wd, højde Hh fra y0 – forsider udad"""
        ca, sa = math.cos(ang), math.sin(ang); ux, uz = ca * L / 2, sa * L / 2; vx, vz = -sa * Wd / 2, ca * Wd / 2
        P = [(cxp - ux - vx, y0, czp - uz - vz), (cxp + ux - vx, y0, czp + uz - vz), (cxp + ux + vx, y0, czp + uz + vz), (cxp - ux + vx, y0, czp - uz + vz)]
        T = [(x, y0 + Hh, z) for (x, _, z) in P]; ctr = np.array([cxp, y0 + Hh / 2, czp])
        for q in ([P[0], P[1], P[2], P[3]], [T[0], T[1], T[2], T[3]], [P[0], P[1], T[1], T[0]], [P[1], P[2], T[2], T[1]], [P[2], P[3], T[3], T[2]], [P[3], P[0], T[0], T[3]]):
            a = [np.array(v, float) for v in q]; n = np.cross(a[1] - a[0], a[2] - a[1])
            if np.dot(n, np.mean(a, axis=0) - ctr) < 0: q = q[::-1]
            mesh.quad(q, mat, [(v[0] + v[2], v[1]) for v in q])
    zi_mid = ZN.index('Mid'); ii_, jj_ = np.nonzero(ZID == zi_mid)
    acx, acz = float(cx((jj_.min() + jj_.max()) / 2 + 0.5)), float(cz((ii_.min() + ii_.max()) / 2 + 0.5)) + 1.0
    ai, aj = int(acz / S + B['CY']), int(acx / S + B['CX']); afl = float(F[ai, aj]); acl = float(C[ai, aj])
    RR, NS, ry = 3.4, 32, min(acl - 2.2, afl + 5.4)
    for k in range(NS):
        a = (k + 0.5) / NS * 2 * math.pi
        px, pz = acx + math.cos(a) * RR, acz + math.sin(a) * RR; tang = a + math.pi / 2; Ls = 2 * math.pi * RR / NS + 0.03
        obox(VIS, px, ry, pz, tang, Ls, 0.34, 0.16, 'trim_metal')                         # mørk metalring
        obox(VIS, px, ry - 0.025, pz, tang, Ls, 0.22, 0.03, 'light_strip')                  # lysbåndet på undersiden
    for k in range(4):                                                                     # wirerne op til loftet
        a = k * math.pi / 2 + math.pi / 4; px, pz = acx + math.cos(a) * RR, acz + math.sin(a) * RR
        obox(VIS, px, ry + 0.16, pz, 0, 0.022, 0.022, acl - ry - 0.16, 'trim_metal')
    for k in range(12):
        a = k / 12 * 2 * math.pi; B['LIGHTS'].append(dict(x=round(acx + math.cos(a) * RR, 2), y=round(ry - 0.12, 2), z=round(acz + math.sin(a) * RR, 2), kind='ring', room='Mid'))
    # lounge-øen under ringen: tæppe, to sofaer over for hinanden, sofabord, skulptur på sokkel, plantekummer i hjørnerne
    put(CUSTOM % 'rug', acx, afl, acz, 0.0)
    put(ph('sofa_03'), acx, afl, acz - 1.9, 0.0); put(ph('sofa_03'), acx, afl, acz + 1.9, 180.0)
    put(ph('modern_coffee_table_01'), acx, afl, acz, 0.0)
    put(CUSTOM % 'plinth', acx + 3.6, afl, acz, 0.0); put(ph('bronze_shark_statue'), acx + 3.6, afl + 1.0, acz, 90.0)
    put(CUSTOM % 'plinth', acx - 3.6, afl, acz, 0.0); put(ph('marble_bust_01'), acx - 3.6, afl + 1.0, acz, -90.0)
    for (dx_, dz_) in ((-2.6, -3.0), (2.6, -3.0), (-2.6, 3.0), (2.6, 3.0)): put(ph('potted_plant_04'), acx + dx_, afl, acz + dz_, rnd.uniform(0, 360))
    print('[dress] atriets lysring og lounge-ø ved (%.1f, %.1f), ring i %.1f m' % (acx, acz, ry))
    # ------------------------------------------------------------ v26: kunst og skærme på væggene i de lange gange (også på skrå gulve)
    nart = 0
    for n_ in ('Long A', 'Long A top', 'Søjlegangen A', 'B Halls vest', 'B Halls øst', 'Rampen', 'Connector', 'Back B'):
        if n_ not in ZN: continue
        for k_, (x, z, yaw, i, j) in enumerate(wall_spots(ZID == ZN.index(n_), 4.5, slope=True)):
            if FREE[i, j] and SLOPE[i, j] < 0: continue
            rad = math.radians(yaw); ox, oz = math.sin(rad) * 0.03, math.cos(rad) * 0.03
            if k_ % 5 == 2: put(CUSTOM % 'wall_tv', x + ox, float(F[i, j]) + 1.7, z + oz, yaw)
            else: put(CUSTOM % ('wall_art_%d' % (k_ % 4)), x + ox, float(F[i, j]) + 1.45, z + oz, yaw)
            nart += 1
    print('[dress] vægkunst/skærme i gangene', nart)
    # elevatorer i elevatorlobbyen, adgangsgates og metaldetektor i sikkerhedsslusen
    for n, model, cnt in (('Mid T', 'elevator_doors', 2),):
        zi = ZN.index(n); spots = sorted(wall_spots(ZID == zi, 2.8), key=lambda s: s[1])[:cnt]
        for (x, z, yaw, i, j) in spots: put(CUSTOM % model, x, float(F[i, j]), z, yaw)
    # ============================================================ levende indretning (CS2 Agency: luksus, kunst, liv – afbrudt hverdag)
    OCC = np.zeros((H, W), bool)
    for p_ in props:
        if 'c' in p_:
            x, y, z, sx, sy, sz = p_['c']; j0, j1 = int((x - sx / 2) / S + B['CX']) - 7, int((x + sx / 2) / S + B['CX']) + 7; i0, i1 = int((z - sz / 2) / S + B['CY']) - 7, int((z + sz / 2) / S + B['CY']) + 7
            OCC[max(0, i0):i1, max(0, j0):j1] = True
    for ax_, (i0, j0, i1, j1) in doors:                                     # foran døre og åbninger: altid frit
        OCC[max(0, i0 - 14):i1 + 14, max(0, j0 - 14):j1 + 14] = True
    OCC |= SLOPE >= 0
    for r_ in B['M']['spawns'].values():                                     # spawn-områderne: altid frie (ingen biler/kasser i spawn)
        OCC[max(0, r_[1] - 10):r_[3] + 10, max(0, r_[0] - 10):r_[2] + 10] = True
    def spots(zi, spacing, want_window=None):
        """vægpunkter i rummet: (x, z, yaw, i, j, axis, sgn, vindue?)"""
        out = []
        for axis in ('x', 'z'):
            for sgn in (1, -1):
                eb = B['ext_behind'](axis, sgn) & B['OPEN'][(axis, sgn)] & B['WIN']
                if axis == 'x':
                    A = (slice(None), slice(0, W - 1)) if sgn > 0 else (slice(None), slice(1, W)); Bn = (slice(None), slice(1, W)) if sgn > 0 else (slice(None), slice(0, W - 1))
                else:
                    A = (slice(0, H - 1), slice(None)) if sgn > 0 else (slice(1, H), slice(None)); Bn = (slice(1, H), slice(None)) if sgn > 0 else (slice(0, H - 1), slice(None))
                m = straight((ZID[A] == zi) & ~WALK[Bn] & (SLOPE[A] < 0), axis)
                ii, jj = np.nonzero(m); oi, oj = A[0].start or 0, A[1].start or 0
                st = max(1, int(spacing / S))
                for i, j in zip(ii, jj):
                    i += oi; j += oj
                    if (i if axis == 'x' else j) % st: continue
                    win = bool(eb[i, j])
                    if want_window is not None and win != want_window: continue
                    if axis == 'x': x = cx(j + 1) if sgn > 0 else cx(j); z = cz(i + 0.5); yaw = -90.0 * sgn
                    else: x = cx(j + 0.5); z = cz(i + 1) if sgn > 0 else cz(i); yaw = 180.0 if sgn > 0 else 0.0
                    out.append((x, z, yaw, i, j, axis, sgn, win))
        rnd.shuffle(out); return out
    def free_rect(x, z, yaw, w, d):
        """celler i fodaftrykket (bredde w langs væggen, dybde d ud i rummet) – frie, gangbare, samme gulvhøjde"""
        rad = math.radians(yaw); fx, fz = math.sin(rad), math.cos(rad); lx, lz = fz, -fx
        cells = []
        for a in np.linspace(-w / 2, w / 2, max(2, int(w / S / 2))):
            for b in np.linspace(0.05, d, max(2, int(d / S / 2))):
                px, pz = x + fx * b + lx * a, z + fz * b + lz * a
                i, j = int(pz / S + B['CY']), int(px / S + B['CX'])
                if not (0 <= i < H and 0 <= j < W) or not WALK[i, j] or OCC[i, j]: return None
                cells.append((i, j))
        fl = [float(F[i, j]) for i, j in cells]
        if max(fl) - min(fl) > 0.02: return None
        # der skal være mindst 1,6 m fri passage foran (aldrig spærre en gang eller indgang)
        for a in np.linspace(-w / 2, w / 2, max(2, int(w / S / 3))):
            for b in np.linspace(d + 0.1, d + 1.6, 6):
                px, pz = x + fx * b + lx * a, z + fz * b + lz * a
                i, j = int(pz / S + B['CY']), int(px / S + B['CX'])
                if not (0 <= i < H and 0 <= j < W) or not WALK[i, j] or OCC[i, j] or abs(float(F[i, j]) - fl[0]) > 0.3: return None
        return cells, fl[0]
    def mark(cells, pad=7):                                             # mindst 0,84 m mellem inventar – ingen smalle sprækker man klemmes i
        for i, j in cells: OCC[max(0, i - pad):i + pad, max(0, j - pad):j + pad] = True
    def against(zi, model, w, d, h, count, yaw_off=0.0, spacing=1.2, window=None, extra=None):
        """stil `count` stk. op ad væggene i rummet (forside ud i rummet) med kollision"""
        n = 0
        for (x, z, yaw, i, j, axis, sgn, win) in spots(zi, spacing, window):
            if n >= count: break
            r = free_rect(x, z, yaw, w, d)
            if not r: continue
            cells, fl = r; rad = math.radians(yaw); fx, fz = math.sin(rad), math.cos(rad)
            cxp, czp = x + fx * (d / 2 + 0.02), z + fz * (d / 2 + 0.02)
            ex, ez = (abs(fz) * w + abs(fx) * d), (abs(fx) * w + abs(fz) * d)
            put(model, cxp, fl, czp, yaw + yaw_off, [cxp, fl + h / 2, czp, ex, h, ez] if h > 0 else None)
            if extra: extra(cxp, fl, czp, yaw, fx, fz)
            mark(cells); n += 1
        return n
    def hang(zi, model, y, count, spacing=2.0):
        """på væggen (ikke vinduer, ikke over døre)"""
        n = 0
        for (x, z, yaw, i, j, axis, sgn, win) in spots(zi, spacing, False):
            if n >= count: break
            if OCC[i, j]: continue
            fl = float(F[i, j]); ci = float(C[i, j]) if np.isfinite(C[i, j]) else fl + 3.0
            if fl + y + 1.3 > ci: continue
            rad = math.radians(yaw)
            put(model, x + math.sin(rad) * 0.005, fl + y, z + math.cos(rad) * 0.005, yaw)
            OCC[max(0, i - 10):i + 10, max(0, j - 10):j + 10] |= False; n += 1
        return n
    OFFICE = [n for n in ZN if ROOMS[n].get('light') == 'panel']
    LUXR = [n for n in ZN if ROOMS[n].get('lux') and ROOMS[n]['h'] is not None]
    for n in ZN:
        zi = ZN.index(n); r = ROOMS[n]
        if n in OFFICE or n == 'Heaven':
            hang(zi, CUSTOM % 'whiteboard', 0.0, 1 + rnd.randint(0, 1), 4.0)
            hang(zi, CUSTOM % ('wall_art_%d' % rnd.randint(0, 3)), 0.0, 2, 5.0)
            hang(zi, CUSTOM % 'wall_tv', 0.0, 3 if n == 'Heaven' else 1, 6.0)
            hang(zi, ph('wall_clock'), 2.25, 1, 6.0)
            against(zi, CUSTOM % 'bookshelf', 0.9, 0.36, 2.0, 3, spacing=1.0)
            against(zi, ph('drawer_cabinet'), 0.6, 0.6, 1.1, 3, spacing=1.0)
            against(zi, ph('potted_plant_04'), 0.7, 0.7, 1.6, 2, spacing=3.0)
            against(zi, ph('metal_trash_can'), 0.35, 0.35, 0.6, 2, spacing=2.0)
            if n == 'Long A top':                                              # v26.3: venteplads øverst på Long A (var helt tom)
                against(zi, ph('mid_century_lounge_chair'), 0.8, 0.8, 0.9, 3, spacing=1.4)
                against(zi, ph('side_table_01'), 0.5, 0.5, 0.6, 2, spacing=2.0)
                against(zi, ph('potted_plant_01'), 0.7, 0.7, 1.4, 3, spacing=2.5)
                hang(zi, CUSTOM % 'wall_tv', 0.0, 2, 4.0)
        elif n in LUXR:
            big = n in ('Mid', 'Arch', 'Top Mid', 'T Base', 'Mid T', 'Balkonen')
            def lounge(cxp, fl, czp, yaw, fx, fz):
                lx, lz = fz, -fx
                put(CUSTOM % 'rug', cxp + fx * 0.9, fl, czp + fz * 0.9, yaw)
                put(ph('modern_coffee_table_01'), cxp + fx * 1.2, fl, czp + fz * 1.2, yaw, [cxp + fx * 1.2, fl + 0.22, czp + fz * 1.2, 1.0, 0.45, 1.0])
                for s_ in (-1, 1):
                    put(ph('modern_arm_chair_01'), cxp + fx * 1.4 + lx * s_ * 1.25, fl, czp + fz * 1.4 + lz * s_ * 1.25, yaw - s_ * 70 + 180, [cxp + fx * 1.4 + lx * s_ * 1.25, fl + 0.45, czp + fz * 1.4 + lz * s_ * 1.25, 0.8, 0.9, 0.8])
            against(zi, ph(rnd.choice(('sofa_02', 'sofa_03'))), 2.2, 2.4, 0.85, 2 if big else 1, spacing=1.5, window=None, extra=lounge)
            def statue(cxp, fl, czp, yaw, fx, fz):
                put(ph(rnd.choice(('bronze_shark_statue', 'horse_statue_01', 'marble_bust_01'))), cxp, fl + 1.0, czp, yaw)
            against(zi, CUSTOM % 'plinth', 0.7, 0.7, 1.0, 2 if big else 1, spacing=4.0, extra=statue)
            def plant(cxp, fl, czp, yaw, fx, fz):
                put(ph('potted_plant_01'), cxp, fl + 0.6, czp, rnd.uniform(0, 360))
            against(zi, CUSTOM % 'planter_large', 0.9, 0.9, 0.62, 3 if big else 1, spacing=3.0, extra=plant)
            hang(zi, CUSTOM % ('wall_art_%d' % rnd.randint(0, 3)), 0.0, 3 if big else 2, 4.0)
            if n == 'Connector':
                def stools(cxp, fl, czp, yaw, fx, fz):
                    lx, lz = fz, -fx
                    for k in (-0.8, 0.0, 0.8): put(ph('bar_chair_round_01'), cxp + fx * 0.75 + lx * k, fl, czp + fz * 0.75 + lz * k, rnd.uniform(0, 360))
                against(zi, CUSTOM % 'coffee_bar', 2.4, 0.65, 1.05, 1, spacing=1.0, extra=stools)
        elif n in ('A Site', 'A Forplads'):
            pass
        elif n in ('CT Spawn', 'CT Forgård'):
            against(zi, ph('covered_car'), 2.2, 4.8, 1.5, 2 if n == 'CT Forgård' else 1, yaw_off=90.0, spacing=2.0)
            hang(zi, ph('rollershutter_door'), 0.0, 2, 6.0)
            against(zi, ph('concrete_road_barrier'), 1.9, 0.6, 0.8, 3, spacing=3.0)
            against(zi, ph('industrial_storage_cart'), 1.0, 0.6, 1.0, 1, spacing=3.0)
        elif n in ('Storage', 'Pillars B', 'B Site'):
            against(zi, ph('steel_frame_shelves_03'), 1.5, 0.6, 2.0, 3, spacing=1.0)
            against(zi, ph('cardboard_box_01'), 0.6, 0.6, 0.5, 4, spacing=1.0)
            against(zi, ph('hand_truck'), 0.6, 0.5, 1.2, 1, spacing=3.0)
            if n == 'B Site':
                against(zi, CUSTOM % 'weapon_locker', 1.0, 0.5, 1.9, 4, spacing=1.0)
                against(zi, ph('ammo_box'), 0.5, 0.3, 0.3, 4, spacing=1.0)
        elif n in ('Lower B', 'Tunnels', 'Tunnels vest', 'Tunnels hjørne', 'Kryptgangen', 'Trappehallen', 'Vent-gangen', 'Rampen', 'Dark', 'Dark-kammeret', 'Kryptnedgangen', 'Vestpassagen', 'Catwalk', 'Catwalk øst', 'Main B', 'A Rampe', 'Connector A'):
            hang(zi, ph(rnd.choice(('power_box_01', 'utility_box_01', 'utility_box_02'))), 1.2, 3, 3.0)
            against(zi, ph(rnd.choice(('metal_tool_chest', 'industrial_pastic_container', 'propane_tank', 'portable_generator'))), 0.8, 0.6, 1.0, 2, spacing=3.0)
            against(zi, ph('trashbag'), 0.5, 0.5, 0.5, 1, spacing=4.0)
    # kabelbakker under loftet i teknik og serverhal (langs gangene, c/c 2 m)
    for n in ('A Site', 'A Forplads', 'Vent-gangen', 'Rampen', 'Kryptgangen', 'Tunnels', 'Tunnels vest', 'Lower B', 'Vestpassagen', 'Trappehallen', 'Catwalk', 'Storage'):
        zi = ZN.index(n); k_ = 0
        for (x, z, yaw, i, j, axis, sgn, win) in spots(zi, 2.0, None):
            if k_ > 18: break
            rad = math.radians(yaw); ci = float(C[i, j]) if np.isfinite(C[i, j]) else None
            if ci is None: continue
            put(CUSTOM % 'cable_tray', x + math.sin(rad) * 0.5, ci - 0.45, z + math.cos(rad) * 0.5, yaw + 90.0); k_ += 1
    # tagterrassen: aircondition, lamper ved brystningen
    for n in ('T Spawn', 'T Ramp'):
        zi = ZN.index(n)
        against(zi, ph('exterior_aircon_unit'), 1.0, 0.8, 1.2, 3, spacing=3.0)
        against(zi, ph('street_lamp_01'), 0.4, 0.4, 3.0, 2, spacing=6.0)
    print('[dress] props', len(props))
    return props
