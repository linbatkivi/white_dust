# ==========================================================================
# de_niseko · tagprofil (fælles for gen/layout.py og Blender-bygningen): tagets højde som funktion af den vinkelrette afstand s fra facadelinjen
#   s < 0 = udhæng mod gaden, s = 0 ved facaden, kam ved s = sr, bagslope falder igen med samme hældning.
# ==========================================================================
STYLE_ROOF = {'machiya': dict(pitch=0.5, sr=3.4, over=0.9), 'shop': dict(pitch=0.5, sr=3.4, over=0.9), 'inn': dict(pitch=0.5, sr=3.4, over=0.9),
              'house1': dict(pitch=0.5, sr=3.0, over=0.8), 'kura': dict(pitch=0.45, sr=4.0, over=1.2), 'shrine': dict(pitch=0.6, sr=3.6, over=1.3),
              'wall': dict(pitch=0.35, sr=1.0, over=0.3), 'hedge': dict(pitch=0.0, sr=1.0, over=0.0)}
def params(style, smax):
    d = dict(STYLE_ROOF[style])
    if style == 'wall': d['sr'] = max(0.6, smax / 2.0)
    return d
def roof_y(he, pr, s):
    pitch, sr, over = pr['pitch'], pr['sr'], pr['over']
    if s <= sr: return he + pitch * (max(s, -over) + over)
    return he + pitch * (sr + over) - pitch * (s - sr)
