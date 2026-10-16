# v26: speakerstemmen – Piper-TTS (stemme 'norman', public domain, LibriVox) + speaker-efterbehandling → public/assets/sounds/ann_*.mp3
#   Stemmen genereres med scratchpad/tts.py (espeak-ng-lydskrift → Piper); her: 44,1 kHz, HP 90 Hz, varme (lav-shelf), presence ~3 kHz,
#   blød kompression/mætning, kort mørk hal (syntetisk impulsrespons) og normalisering.   python3 tools/sounds/announcer.py <wav-mappe>
import os, sys, types, wave, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, 'prep.py')).read(); prep = types.ModuleType('prep'); prep.__file__ = os.path.join(HERE, 'prep.py'); _a = sys.argv; sys.argv = sys.argv[:1] + [os.path.join(HERE, 'pixabay_raw')]
exec(_src[:_src.index("gs = decode('gun_shot')")], prep.__dict__); sys.argv = _a
SRC = sys.argv[1]; SR = 44100
def load(p):
    w = wave.open(p); sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
    t = np.arange(int(len(a) * SR / sr)) * sr / SR; return np.interp(t, np.arange(len(a)), a)
def biquad(x, b, a):
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        y0 = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2, x1 = x1, x[i]; y2, y1 = y1, y0; y[i] = y0
    return y
def peq(f, q, g, kind):
    A = 10 ** (g / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); c = np.cos(w)
    if kind == 'peak': b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    elif kind == 'hp': b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(A) * al; b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]; a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
    b = np.array(b) / a[0]; a = np.array(a) / a[0]; return b, a
def process(x):
    x = x / (np.max(np.abs(x)) + 1e-9)
    for f, q, g, k in ((90, 0.7, 0, 'hp'), (180, 0.8, 3.0, 'lowshelf'), (3100, 1.1, 4.5, 'peak'), (7500, 0.9, 1.5, 'peak')): x = biquad(x, *peq(f, q, g, k))
    env = np.convolve(np.abs(x), np.ones(441) / 441, 'same'); gain = np.minimum(1.0, (0.35 / (env + 1e-4)) ** 0.55); x = x * gain   # kompressor
    x = np.tanh(x * 1.6) / np.tanh(1.6)                                                            # blød mætning
    n = int(0.55 * SR); rng = np.random.RandomState(3); ir = rng.randn(n) * np.exp(-np.arange(n) / (0.11 * SR))
    ir = biquad(ir, *peq(2500, 0.7, -9, 'peak')); ir[:int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
    dry = np.concatenate([x, np.zeros(n)]); wet = np.convolve(x, ir); wet = np.pad(wet, (0, max(0, len(dry) - len(wet))))[:len(dry)]
    y = dry + 0.16 * wet; y = np.concatenate([np.zeros(int(0.02 * SR)), y])
    fo = int(0.25 * SR); y[-fo:] *= np.linspace(1, 0, fo)
    return (y / np.max(np.abs(y)) * 0.95).astype(np.float32)
for k in ('swat_win', 'hij_win', 'planted', 'defused', 'switch'):
    p = os.path.join(SRC, 'ann_%s.wav' % k)
    if os.path.exists(p): prep.write('ann_' + k, process(load(p)), kbps=128)
