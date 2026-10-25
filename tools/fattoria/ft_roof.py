# ==========================================================================
# de_fattoria · tagprofil (fælles for gen/layout.py og Blender-bygningen): tagets højde som funktion af den vinkelrette afstand s fra facadelinjen
#   s < 0 = udhæng mod gaden, s = 0 ved facaden, kam ved s = sr, bagslope falder igen med samme hældning. Flade stilarter (mure, terrasser, hække) har pitch 0.
# ==========================================================================
STYLE_ROOF = {'villa': dict(pitch=0.40, sr=4.4, over=0.9), 'casa': dict(pitch=0.42, sr=3.5, over=0.75), 'casetta': dict(pitch=0.40, sr=2.9, over=0.65),
              'fienile': dict(pitch=0.44, sr=4.0, over=0.85), 'swall': dict(pitch=0.0, sr=1.0, over=0.0), 'terrace': dict(pitch=0.0, sr=1.0, over=0.0),
              'hedge': dict(pitch=0.0, sr=1.0, over=0.0), 'hallwall': dict(pitch=0.0, sr=1.0, over=0.0), 'twall': dict(pitch=0.0, sr=1.0, over=0.0)}
def params(style, smax):
    return dict(STYLE_ROOF[style])
def roof_y(he, pr, s):
    pitch, sr, over = pr['pitch'], pr['sr'], pr['over']
    if s <= sr: return he + pitch * (max(s, -over) + over)
    return he + pitch * (sr + over) - pitch * (s - sr)
