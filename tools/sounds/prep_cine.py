# v22 lyde til intro-cutscenen og MVP-filmen: Pixabay-lyde (Pixabay Content License, tools/sounds/pixabay.json)
#   hentes til tools/sounds/pixabay_raw/ og skæres/normaliseres hertil: public/assets/sounds/cine_*.mp3
#   Kræver macOS afconvert + lame.   Kør:  python3 tools/sounds/prep_cine.py
import os, sys, json, subprocess
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'pixabay_raw')
import types                                                       # decode/write/cut fra v20-pipelinen (kun funktionerne – ikke dens kørsel)
_src = open(os.path.join(HERE, 'prep.py')).read(); prep = types.ModuleType('prep'); prep.__file__ = os.path.join(HERE, 'prep.py'); sys.argv = sys.argv[:1] + [RAW]
exec(_src[:_src.index("gs = decode('gun_shot')")], prep.__dict__)
prep.SRC = RAW

def get(name):
    if not os.path.exists(os.path.join(RAW, name + '.mp3')):
        url = json.load(open(os.path.join(HERE, 'pixabay.json')))[name]
        subprocess.run(['curl', '-sSL', '-A', 'Mozilla/5.0', '-e', 'https://pixabay.com/', '-o', os.path.join(RAW, name + '.mp3'), url], check=True)
    return prep.decode(name)

def best(a, dur):
    """mest energiske vindue af længden dur (s)"""
    w = int(0.25 * 44100); env = np.array([np.sqrt(np.mean(a[i:i + w] ** 2)) for i in range(0, len(a) - w, w)])
    n = int(dur / 0.25); s = np.convolve(env, np.ones(n), 'valid'); i = int(np.argmax(s))
    return i * 0.25

C = prep.cut
os.makedirs(RAW, exist_ok=True)
J = {
  # intro – køretøjer
  'cine_truck_arrive': lambda: C(get('truck_pass'), 0.6, 6.4, 0.3, 0.6),
  'cine_truck_brake':  lambda: C(get('truck_brake'), 11.6, 16.6, 0.05, 0.8),
  'cine_air_hiss':     lambda: C(get('air_brake'), 0.0, 2.6, 0.005, 0.6),
  'cine_van_doors':    lambda: C(get('van_doors'), 6.7, 10.6, 0.01, 0.3),
  'cine_metal_door':   lambda: C(get('metal_door'), 19.9, 22.2, 0.01, 0.4),
  'cine_idle':         lambda: C(get('truck_idle'), 4.0, 10.0, 0.4, 0.8),
  'cine_rev':          lambda: C(get('truck_rev'), 3.0, 6.4, 0.02, 0.5),
  'cine_pickup':       lambda: (lambda a: C(a, best(a, 6.0), best(a, 6.0) + 6.0, 0.4, 0.8))(get('pickup_drive')),
  'cine_skid':         lambda: C(get('handbrake'), 5.4, 8.6, 0.02, 0.6),
  'cine_brake_squeal': lambda: C(get('car_brake'), 0.0, 2.1, 0.005, 0.4),
  'cine_car_door':     lambda: C(get('car_door'), 1.6, 3.2, 0.005, 0.3),
  # intro – folk og våben
  'cine_land':         lambda: C(get('land_grass'), 0.0, 0.7, 0.002, 0.15),
  'cine_steps':        lambda: C(get('boots_gravel'), 13.3, 15.6, 0.01, 0.2),
  'cine_gear':         lambda: C(get('leather'), 0.0, 4.6, 0.01, 0.3),
  'cine_cock':         lambda: C(get('gun_cock'), 5.45, 6.6, 0.003, 0.12),
  'cine_reload':       lambda: C(get('gun_reload'), 0.0, 1.5, 0.003, 0.1),
  'cine_radio':        lambda: C(get('radio1'), 0.2, 6.2, 0.05, 0.4),
  'cine_battlecry':    lambda: C(get('battle_cry'), 0.4, 3.9, 0.05, 0.6),
  'cine_arrive_fx':    lambda: C(get('arriving'), 0.0, 4.8, 0.05, 0.05),
  # MVP-film
  'cine_boom':         lambda: C(get('boom'), 0.0, 2.1, 0.002, 0.4),
  'cine_braam':        lambda: C(get('braam'), 0.0, 6.0, 0.002, 1.2),
  'cine_hit':          lambda: C(get('hit'), 0.0, 3.0, 0.002, 0.6),
  'cine_whoosh':       lambda: C(get('whoosh'), 0.0, 1.8, 0.002, 0.3),
  'cine_rise':         lambda: C(get('whoosh_rev'), 0.0, 1.5, 0.05, 0.05),
  'cine_slowmo':       lambda: C(get('slowmo'), 0.0, 2.6, 0.005, 0.4),
  'cine_heart':        lambda: C(get('heartbeat'), 0.0, 2.2, 0.01, 0.2),
  'cine_casings':      lambda: C(get('casings'), 16.5, 18.4, 0.003, 0.3),
  # v25: regn og torden (de_ascension)
  'cine_rain':         lambda: prep.loop(get('rain_stone'), 2.0, 38.0, 3.0),
  'cine_rain_in':      lambda: prep.loop(get('rain_indoor'), 3.0, 30.0, 3.0),
  'cine_gutter':       lambda: prep.loop(get('gutter'), 1.0, 26.0, 2.5),
  'cine_thunder1':     lambda: C(get('thunder_crack'), 1.9, 14.0, 0.01, 2.5),
  'cine_thunder2':     lambda: C(get('thunder_close'), 1.3, 14.5, 0.01, 2.5),
  'cine_thunder3':     lambda: C(get('thunder_roll'), 0.0, 13.6, 0.05, 2.5),
  'cine_thunder4':     lambda: C(get('thunder_far'), 3.8, 26.0, 0.3, 3.0),
  # v26: helikopteren (de_bureau – hijackerne lander ved tagterrassen)
  'cine_heli_in':      lambda: C(get('heli_approach'), 0.0, 9.5, 1.2, 0.8),
  'cine_heli_hover':   lambda: prep.loop(get('heli_blades'), 4.0, 26.0, 3.0),
  'cine_heli_out':     lambda: C(get('heli_flyby'), 2.2, 11.0, 0.3, 2.0),
}
ONLY = sys.argv[2:]
for name, fn in J.items():
    if ONLY and name not in ONLY: continue
    prep.write(name, fn(), kbps=96 if not name.startswith(('cine_rain', 'cine_gutter')) else 112)
