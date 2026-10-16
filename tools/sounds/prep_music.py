# v26.3 introens musik: "Race to Arms" (Grand_Project, Pixabay Content License) → public/assets/sounds/music_intro.mp3
#   Nummerets egen opbygning (0,25–13,8 s) – præcis introens længde (13 s) – med 2 s cos²-fade til sidst, så den lander når introen slutter.
#   Lydstyrken matches til menumusikken (gated RMS). Kræver macOS afconvert + lame.   Kør:  python3 tools/sounds/prep_music.py
import os, wave, subprocess, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'pixabay_raw', 'music_race_to_arms.mp3'); DST = os.path.join(ROOT, 'public', 'assets', 'sounds')
TMP = tempfile.mkdtemp(); SR = 44100

def rd(mp3):
    wav = os.path.join(TMP, os.path.basename(mp3) + '.wav')
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', '-c', '2', mp3, wav], check=True)
    w = wave.open(wav); return np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
def loud(x):
    b = int(0.4 * SR); r = np.array([np.sqrt(np.mean(x[i:i + b] ** 2)) for i in range(0, len(x) - b, b)]); r = np.sort(r)[int(len(r) * 0.3):]
    return 20 * np.log10(np.mean(r))

a = rd(SRC); menu = rd(os.path.join(DST, 'music_menu.mp3'))
t0, t1 = 0.25, 13.8
s = a[int(t0 * SR):int(t1 * SR)].copy(); n = len(s)
fi = int(0.03 * SR); s[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(2.0 * SR); s[n - fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]
s *= 10 ** ((loud(menu) - loud(a[int(3 * SR):int(13 * SR)])) / 20)
pk = np.abs(s).max()
if pk > 0.97: s *= 0.97 / pk
wav = os.path.join(TMP, 'music_intro.wav'); w = wave.open(wav, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(s, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
subprocess.run(['lame', '--quiet', '-b', '192', '-m', 'j', wav, os.path.join(DST, 'music_intro.mp3')], check=True)
print('music_intro.mp3  %.2f s' % (n / SR))
