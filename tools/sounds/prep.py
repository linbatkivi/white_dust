# v20 lyde: brugerens lydfiler (sounds_wd/ i projektroden) -> spil-klare filer i public/assets/sounds/
#   kort lyd skæres ud (genladningens tre trin, to knivstik), baggrunds-løkker får krydsfade, musik genkodes i stereo.
#   Kræver macOS afconvert + lame (brew).  Kør:  python3 tools/sounds/prep.py [kildemappe]
import os, sys, subprocess, wave, tempfile
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'sounds_wd')
DST = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'sounds')
os.makedirs(DST, exist_ok=True)
TMP = tempfile.mkdtemp()

def decode(name, ch=1):
    out = os.path.join(TMP, name.replace(' ', '_') + '_%d.wav' % ch)
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', '-c', str(ch), os.path.join(SRC, name + '.mp3'), out], check=True)
    w = wave.open(out); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a.reshape(-1, ch) if ch > 1 else a

def write(name, a, kbps=128, peak=0.95):
    a = np.asarray(a, dtype=np.float32)
    m = np.abs(a).max()
    if peak and m > 0: a = a * (peak / m)
    ch = 1 if a.ndim == 1 else a.shape[1]
    wav = os.path.join(TMP, name + '.wav')
    w = wave.open(wav, 'wb'); w.setnchannels(ch); w.setsampwidth(2); w.setframerate(44100)
    w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    mp3 = os.path.join(DST, name + '.mp3')
    subprocess.run(['lame', '--quiet', '-b', str(kbps), '-m', 'm' if ch == 1 else 'j', wav, mp3], check=True)
    print('%-22s %6.2f s  %5d KB' % (name, len(a) / 44100, os.path.getsize(mp3) // 1024))

def cut(a, t0, t1, fi=0.004, fo=0.03):
    s = a[int(t0 * 44100):int(t1 * 44100)].copy(); n = len(s)
    s[:int(fi * 44100)] *= np.linspace(0, 1, int(fi * 44100)); s[n - int(fo * 44100):] *= np.linspace(1, 0, int(fo * 44100))
    return s

def loop(a, t0, dur, cf=3.0):
    """sømløs løkke: slutningen krydsfades ind i starten"""
    s = a[int(t0 * 44100):int((t0 + dur + cf) * 44100)].copy(); c = int(cf * 44100)
    body = s[:-c].copy(); tail = s[-c:]
    k = np.linspace(0, 1, c)
    body[:c] = body[:c] * np.sqrt(k) + tail * np.sqrt(1 - k)
    return body

def best_window(a, dur, step=5.0):
    """roligste jævne udsnit (lav variation i niveau) til baggrundsløkker"""
    best, bt = 1e9, 0.0
    for t in np.arange(0, len(a) / 44100 - dur - 3, step):
        s = a[int(t * 44100):int((t + dur) * 44100)]
        e = np.sqrt(np.mean(s.reshape(-1, 4410)[:, :] ** 2, axis=1))
        sc = e.std() / (e.mean() + 1e-6) - 0.2 * np.log(e.mean() + 1e-6) * 0          # jævnhed
        if e.mean() > 0.004 and sc < best: best, bt = sc, t
    return bt

# --- våben / kniv / genladning
gs = decode('gun_shot'); write('gun_shot', cut(gs, 0.0, 1.05, 0.0005, 0.25))
rl = decode('reload')
write('reload_magout', cut(rl, 0.13, 0.46)); write('reload_magin', cut(rl, 1.10, 1.56)); write('reload_rack', cut(rl, 2.29, 2.66))
ka = decode('knife_hits_air_or_object'); write('knife_swing', cut(ka, 0.0, 0.46, 0.001, 0.08))
kp = decode('knife_hits_person'); write('knife_hit1', cut(kp, 0.58, 1.02, 0.002, 0.08)); write('knife_hit2', cut(kp, 1.12, 1.58, 0.002, 0.08))
# --- baggrund (mono, løkker)
bd = decode('birds_background'); t = best_window(bd, 80); write('amb_birds', loop(bd, t, 80), kbps=96, peak=0.6)
tr = decode('traffic_noise'); write('amb_traffic', loop(tr, 0.5, 36), kbps=96, peak=0.6)
# --- musik (stereo)
mm = decode('menu_music', 2); write('music_menu', mm, kbps=128, peak=0.9)
gw = decode('game win', 2); write('music_win', gw, kbps=128, peak=0.92)
