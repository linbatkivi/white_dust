# (udføres af layout.py i samme navnerum) – rekvisitter, mure, spawns, sites og callouts.
def ygr(z):                                  # højde på vinmarkens skråning ved z (ramp z 6..30: 0 → −3)
    return YM - (min(max(z, 6), 30) - 6) * (YM - YT) / 24.0

# ============================================================================================================================ BYGNINGER (visuel: facade op til tagfoden + tag)
building('villa', -40, -50, -6, -38, YE + 9.0, 'hip', 'ft_plaster_a', rise=3.2, ridge='x', floors=2, style='villa')
building('stalde', -46, -42, -36, -18, YE + 6.0, 'gable', 'ft_ochre_a', rise=2.8, ridge='z', floors=1, style='stable')
building('bibliotek', -8, -38, 2, -20, YE + 7.6, 'hip', 'ft_plaster_b', rise=2.8, ridge='z', floors=2, style='library')
building('frantoio', 22, 6, 36, 26, YM + 6.6, 'gable', 'ft_ochre_b', rise=2.8, ridge='z', floors=1, style='mill')
building('limonaia', 38, -46, 50, -37, YE + 5.2, 'gable', 'ft_plaster_b', rise=2.4, ridge='x', floors=1, style='orangery')
building('capanno', -3.5, 13, 3.5, 18.5, 2.4, 'gable', 'ft_ochre_a', rise=1.3, ridge='x', floors=1, style='shed')

# ============================================================================================================================ T-PIAZZALEN
cyl(-22, 40, 1.1, YT, YT + 1.0, 'well')
prop(14, 37, 3.4, 1.8, 1.3, YT, 'cart'); prop(-14, 35, 3.4, 1.8, 1.3, YT, 'cart'); prop(30, 42, 2.2, 2.2, 1.2, YT, 'crates'); prop(-32, 43, 2.2, 2.2, 1.2, YT, 'crates')
prop(-24, 44.5, 1.4, 1.4, 1.1, YT, 'barrels'); prop(-26.2, 44.9, 1.1, 1.1, 1.0, YT, 'barrels'); prop(24, 44.5, 1.4, 1.4, 1.1, YT, 'barrels')
for x in (-30, -18, 18, 30, 42, -42): cyl(x, 32.5, 0.35, YT, YT + 2.5, 'olive')
for x in (-46, 46): cyl(x, 40, 0.3, YT, YT + 2.5, 'cypress')
wall(-14, 31, -9, 32, YT + 1.2, 'stone'); wall(9, 31, 14, 32, YT + 1.2, 'stone')
wall(-56, 45, -48, 46, YT + 1.5, 'stone'); wall(48, 45, 56, 46, YT + 1.5, 'stone')
# muren på piazzaen (muro) med porte til hver vej – T må vælge port, og der er ingen lang sigtelinje fra spawn
for (a, b) in ((-56, -54), (-46, -34), (-24, -10), (10, 36), (46, 50)): wall(a, 31, b, 32, YT + 2.0, 'stone')

# ============================================================================================================================ VINMARKEN (MID)
for z in (9, 12, 15, 18, 21, 24, 27):
    for (a, b) in ((-20.5, -6), (6, 20.5)): rail(a, z - 0.2, b, z + 0.2, ygr(z), 1.6, 'vine')
for z in (10.5, 16.5, 22.5): rail(-3.0, z - 0.2, 3.0, z + 0.2, ygr(z), 1.6, 'vine')
wall(-3.5, 13, 3.5, 18.5, 2.4, 'plaster')
wall(-22, 19.6, -7, 20.4, ygr(20) + 1.7, 'stone'); wall(6, 13.6, 22, 14.4, ygr(14) + 1.7, 'stone'); wall(-22, 8.6, -12, 9.4, ygr(9) + 1.7, 'stone'); wall(10, 25.6, 22, 26.4, ygr(26) + 1.7, 'stone')                                                              # redskabsskuret (capanno) midt på skråningen
for (x, z) in ((-14, 7.5), (14, 7.5), (-16, 28.5), (16, 28.5)): cyl(x, z, 0.35, ygr(z), ygr(z) + 2.6, 'olive')

prop(-18, 7, 1.6, 1.0, 0.9, YM, 'crates'); prop(19, 7, 1.6, 1.0, 0.9, YM, 'crates')

# ============================================================================================================================ VINMARKENS TOP (y 0)
wall(22, 6, 36, 26, TOP, 'ochre')                                                                      # frantoio (olivenpresse) – massiv bygning mellem vinmarken og østvejen
prop(-10, 1, 2.0, 1.0, 0.9, YM, 'planter'); prop(12, 1, 2.0, 1.0, 0.9, YM, 'planter'); prop(42, 1, 1.6, 1.0, 1.0, YM, 'barrels'); prop(38, 4, 1.2, 1.2, 1.0, YM, 'crate')
wall(-22, -4, -12, -3, YM + 1.1, 'stone')

# ============================================================================================================================ TERRAKOTTA-TERRASSEN
wall(9, -4.5, 18, -4, YP + 1.1, 'stone'); wall(24, -4.5, 28, -4, YP + 1.1, 'stone'); wall(36, -4.5, 46, -4, YP + 1.1, 'stone')
wall(6, ZE + 0.0, 12, ZE + 0.5, YP + 1.1, 'stone'); wall(22, ZE, 28, ZE + 0.5, YP + 1.1, 'stone'); wall(32, ZE, 36, ZE + 0.5, YP + 1.1, 'stone'); wall(42, ZE, 46, ZE + 0.5, YP + 1.1, 'stone')
dwall([(15.8, -9.0), (16.5, -8.4), (25.2, -16.9), (24.5, -17.5)], YP, YP + 1.55, 'stone')               # knækket stenmur (45°) bryder sigtelinjerne
prop(21, -6.4, 2.4, 1.0, 1.0, YP, 'barrel_side'); prop(11.5, -17, 1.0, 2.4, 1.0, YP, 'barrel_side'); prop(38, -9.2, 2.2, 1.0, 1.0, YP, 'barrel_side')
cyl(18, -19.5, 0.55, YP, YP + 1.1, 'barrel'); cyl(19.4, -20.4, 0.55, YP, YP + 1.1, 'barrel'); cyl(43, -20, 0.55, YP, YP + 1.1, 'barrel'); cyl(11, -21.5, 0.5, YP, YP + 1.0, 'barrel')
prop(30, -6.4, 1.4, 1.0, 0.9, YP, 'planter'); prop(12, -6.5, 1.4, 1.0, 0.9, YP, 'planter'); prop(44, -6.5, 1.4, 1.0, 0.9, YP, 'planter')
# pergolagangen (smal, 4 m) – åbne del af trappen (z −11…−5) har lave vægge og pergola-stolper
wall(3, -12, 4, -5, YP + 1.4, 'stone'); wall(8, -12, 9, -5, YP + 1.4, 'stone')
for zs in (-10, -7.5, -5.5): cyl(3.5, zs, 0.25, YP, YP + 3.1, 'pergola_post'); cyl(8.5, zs, 0.25, YP, YP + 3.1, 'pergola_post')
# lysskakter (små loftsvinduer) i dækket over kælderen – gelænder rundt om hullet; man kan kaste granater ned
for (x0, z0, x1, z1) in ((26, -15.5, 28.5, -13), (14, -11, 16.5, -8.5), (31, -11, 33.5, -8.5)):
    uncover(x0, z0, x1, z1)
    rail(x0 - 0.1, z0 - 0.1, x1 + 0.1, z0, YP, 1.0, 'iron'); rail(x0 - 0.1, z1, x1 + 0.1, z1 + 0.1, YP, 1.0, 'iron'); rail(x0 - 0.1, z0, x0, z1, YP, 1.0, 'iron'); rail(x1, z0, x1 + 0.1, z1, YP, 1.0, 'iron')
    deco('skylight', x0=x0, z0=z0, x1=x1, z1=z1, y=YP)

# ============================================================================================================================ VINKÆLDEREN (A)
cyl(18.5, -13, 2.0, YC, CEILC, 'foudre'); cyl(23, -9.5, 1.5, YC, CEILC, 'foudre'); cyl(26, -19, 1.6, YC, CEILC, 'foudre')           # enorme fødertønder op til loftet
for (x, z) in ((12, -14), (30, -19), (30, -8.5), (13, -8)): cyl(x, z, 0.5, YC, CEILC, 'pier')
prop(29, -21.3, 8.0, 1.0, 1.7, YC, 'rack'); prop(35.3, -17, 1.0, 5.0, 1.7, YC, 'rack'); prop(22, -6.6, 5.0, 1.0, 1.7, YC, 'rack')
prop(15, -19.4, 1.2, 1.2, 1.1, YC, 'barrels'); prop(33, -7, 2.0, 1.0, 1.1, YC, 'barrels_stack'); prop(27, -6.8, 1.2, 1.2, 1.0, YC, 'crate')
rail(8, -18.1, 20, -17.9, YB, 1.0, 'iron')                                                          # balkonens gelænder (mod kældergulvet)

# ============================================================================================================================ VILLAEN: GÅRDSPLADS B
cyl(-21, -30.5, 2.5, YE, YE + 0.9, 'fountain')
for x in range(-33, -8, 3): cyl(x, -35.8, 0.3, YE, YE + HALL, 'column'); cyl(x, -26.2, 0.3, YE, YE + HALL, 'column')
for z in (-33.0, -30.5, -28.0): cyl(-31.7, z, 0.3, YE, YE + HALL, 'column'); cyl(-10.3, z, 0.3, YE, YE + HALL, 'column')
prop(-30, -36.5, 2.0, 0.9, 0.7, YE, 'bench'); prop(-12, -25, 2.0, 0.9, 0.7, YE, 'bench'); prop(-13, -36.5, 1.3, 1.3, 1.0, YE, 'planter'); prop(-32.5, -24.7, 1.2, 1.2, 1.0, YE, 'planter')
prop(-9.5, -33.5, 1.2, 1.2, 1.0, YE, 'planter')
cyl(-24.5, -46, 0.4, YE, YE + HALL, 'column'); cyl(-21.5, -46, 0.4, YE, YE + HALL, 'column')
for z in (-35.6, -31.2, -27.0): prop(-41, z, 4.4, 0.25, 1.5, YE, 'stall')
prop(-37.5, -35, 1.4, 1.0, 0.8, YE, 'hay'); prop(-43, -25, 1.6, 1.2, 0.9, YE, 'hay'); prop(-38.5, -25.2, 1.2, 1.2, 1.0, YE, 'barrels')
rail(-34, -35.6, -8, -35.4, YE + 3.7, 1.0, 'iron'); rail(-33.9, -38, -33.7, -35.5, YE + 3.7, 1.0, 'iron')
prop(-3, -36.3, 6.0, 0.7, 2.3, YE, 'shelf'); prop(-3, -21.7, 6.0, 0.7, 2.3, YE, 'shelf'); prop(-3, -30, 2.4, 1.2, 0.8, YE, 'table')

# ============================================================================================================================ ØSTHAVEN & CT-SPAWN (y 4,8)
tw = [(18.4, -31.0), (21.6, -31.0), (23.5, -29.1), (23.5, -25.9), (21.6, -24.0), (18.4, -24.0), (16.5, -25.9), (16.5, -29.1)]
dwall(tw, YE, TOP, 'ochre')                                                                              # colombaia (otte-kantet duetårn) – bryder sigtelinjen mellem T-piazzaen og CT's spawn
deco('tower', pts=tw, y=YE)
wall(20, -46, 28, -45.5, YE + 1.2, 'hedge'); wall(34, -36, 42, -35.5, YE + 1.2, 'hedge'); wall(42, -52, 42.5, -44, YE + 1.2, 'hedge'); wall(18, -34, 24, -33.5, YE + 1.2, 'hedge')
for (x, z) in ((24, -38), (34, -48), (50, -36), (18, -54)): cyl(x, z, 0.4, YE, YE + 2.8, 'lemon')
for x in range(20, 58, 5): cyl(x, -59.2, 0.35, YE, YE + 6.0, 'cypress')
prop(3, -50, 2.4, 1.4, 1.1, YE, 'crates'); prop(-3, -46, 3.4, 1.8, 1.3, YE, 'cart'); cyl(21, -48, 1.0, YE, YE + 1.0, 'well')
wall(54, -36, 58, -35, YE + 1.2, 'stone')

# ============================================================================================================================ SPAWNS, SITES, CALLOUTS
for (x, z) in ((-20, 40), (-16, 42), (-12, 39.5), (-8, 42), (-4, 40)): spawns['hij'].append((x, z, 0.0, YT))
for (x, z) in ((7, -44), (12, -46), (17, -44), (7, -49), (15, -50)): spawns['swat'].append((x, z, math.pi, YE))
sites['A'] = (14.0, -19.0, 32.0, -8.0, YC)
sites['B'] = (-30.0, -35.0, -12.0, -26.0, YE)
lab('T Spawn', 0, 40, YT, 'dirt'); lab('Piazzale', 0, 34, YT, 'dirt'); lab('Via Maestra', -29, 12, -0.5, 'dirt'); lab('Hulvejen', -50, 12, -0.5, 'dirt'); lab('Vinmarken', 0, 22, -2.0, 'dirt')
lab('Vinmarkens Top', 0, 1, YM, 'stone'); lab('Frantoio', 29, 2, YM, 'stone'); lab('Via del Frantoio', 41, 18, -1.5, 'dirt'); lab('Cypres-vejen', 54, 6, 0.5, 'dirt')
lab('Forgården', 42, 1, YM, 'stone'); lab('Presseriet', 32, -9, -0.8, 'cave'); lab('Terrassen', 28, -8, YP, 'stone'); lab('Pergolaen', 6, -9, YP, 'stone')
lab('Bibliotekstrappen', 6, -2, 1.3, 'stone'); lab('Vestterrassen', 10, -20, YP, 'stone'); lab('Kælderbalkonen', 14, -20, YB, 'cave'); lab('Flaskelageret', 11, -30, 2.5, 'cave')
lab('Hovedporten', -32, -18, YE, 'stone'); lab('Biblioteket', -3, -29, YE, 'wood'); lab('Stalden', -40, -30, YE, 'dirt'); lab('Hallen', -23, -44, YE, 'stone')
lab('Villa-gården', -30, -55, YE, 'dirt'); lab('Østhaven', 38, -44, YE, 'leaf'); lab('CT Spawn', 12, -47, YE, 'dirt')
lab('A', 23, -13.5, YC); lab('B', -21, -30.5, YE)
surf_of.update({'A': 'cave', 'B': 'stone'})
