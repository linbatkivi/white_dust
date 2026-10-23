#!/usr/bin/env python3
# MVP-musik: finder det stærkeste, rytmisk rene udsnit i hvert Pixabay-nummer (tools/sounds/mvp_raw/*.mp3, Pixabay Content License),
# klipper det på taktgrænser (hele takter, start på et transient-slag) og eksporterer en kort, høj-energi 'sting' → public/assets/sounds/mvp_<kit>.mp3
#   python3 tools/sounds/mvp_cut.py            (kræver macOS afconvert + lame + numpy)
# Pr. kit vælges det bedste nummer ud fra: beat-klarhed (autokorrelation af onset-kurven), gennemsnitlig energi og en 'drop' (stille før → højt efter).
import os, sys, wave, subprocess, tempfile, json
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RAW = os.path.join(HERE, 'mvp_raw'); DST = os.path.join(ROOT, 'public', 'assets', 'sounds'); TMP = tempfile.mkdtemp(); SR = 44100
KITS = {  # kit → kandidater, ønsket længde (s), tempo-interval
  'funk': (['funk1', 'funk2', 'funk3'], 9.0), 'chiptune': (['chip1', 'chip2', 'chip3'], 9.0), 'synthwave': (['syn1', 'syn2', 'syn3'], 9.5),
  'trap': (['trap1', 'trap2', 'trap3'], 9.0), 'war': (['war1', 'war2', 'war3'], 9.5), 'bassdrop': (['dub1', 'dub2'], 9.0),
  'orchestra': (['orc1', 'orc2'], 9.5), 'dnb': (['dnb1', 'dnb2'], 9.0), 'hiphop': (['hh1'], 9.0), 'rock': (['rock1', 'rock2', 'rock3'], 9.0), 'techno': (['tech1', 'tech2'], 9.0)
}
def rd(mp3):
    wav = os.path.join(TMP, os.path.basename(mp3) + '.wav'); subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', '-c', '2', mp3, wav], check=True)
    w = wave.open(wav); return np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
HOP = 512
def onset_env(x):
    m = x.mean(1); n = (len(m) - 2048) // HOP; win = np.hanning(2048)
    S = np.abs(np.array([np.fft.rfft(m[i * HOP:i * HOP + 2048] * win) for i in range(n)]))
    S = np.log1p(S * 8); fl = np.maximum(0, S[1:] - S[:-1]).sum(1); fl = np.concatenate([[0], fl]); return fl / (fl.max() + 1e-9)
def tempo(env):
    fps = SR / HOP; e = env - env.mean(); ac = np.correlate(e, e, 'full')[len(e) - 1:]; ac /= ac[0] + 1e-9
    best = (0, 0)
    for bpm in range(78, 181):
        lag = fps * 60 / bpm; i0, i1 = int(lag) - 1, int(lag) + 2
        v = ac[i0:i1 + 1].max() + 0.5 * ac[int(2 * lag) - 1:int(2 * lag) + 2].max() + 0.3 * ac[int(4 * lag) - 2:int(4 * lag) + 3].max()
        if v > best[0]: best = (v, bpm)
    return best[1], best[0]
def refine(env, bpm):
    fps = SR / HOP; best = (0, bpm)
    for b in np.arange(bpm - 2, bpm + 2.01, 0.1):
        lag = fps * 60 / b; idx = np.arange(0, len(env), lag).astype(int); idx = idx[idx < len(env)]; v = env[idx].sum() if False else 0
        # phase-uafhængig: sum af env ved grid med bedste forskydning
        ph = max(env[np.clip((np.arange(0, len(env) - int(lag), lag) + p).astype(int), 0, len(env) - 1)].sum() for p in np.arange(0, lag, 2))
        if ph > best[0]: best = (ph, b)
    return best[1]
def grid_phase(env, bpm):
    fps = SR / HOP; lag = fps * 60 / bpm; best = (0, 0)
    for p in np.arange(0, lag, 1):
        idx = (np.arange(0, len(env) - int(lag), lag) + p).astype(int); v = env[idx].sum()
        if v > best[0]: best = (v, p)
    return best[1] / fps
def analyse(name, want):
    x = rd(os.path.join(RAW, name + '.mp3')); env = onset_env(x); bpm0, clarity = tempo(env); bpm = refine(env, bpm0)
    beat = 60 / bpm; ph = grid_phase(env, bpm); bar = 4 * beat; nb = max(2, int(round(want / bar))) ; L = nb * bar
    fps = SR / HOP; rms = np.sqrt((x ** 2).mean(1)); er = np.array([rms[i * HOP:(i + 1) * HOP].mean() for i in range(len(env))])
    best = None; t = ph
    while t + L + 0.6 < len(x) / SR:
        a = int(t * fps); b = int((t + L) * fps); seg = er[a:b]; sev = env[a:b]
        pre = er[max(0, a - int(2 * fps)):a].mean() if a > 10 else er[a:b].mean() * 0.6
        score = seg.mean() * 1.0 + 0.35 * sev.mean() + 0.25 * min(seg.min() / (seg.mean() + 1e-9), 1) + 0.3 * max(0, seg[:int(0.5 * fps)].mean() - pre)
        if best is None or score > best[0]: best = (score, t)
        t += bar
    return dict(name=name, bpm=bpm, clarity=clarity, L=L, t0=best[1], score=best[0], x=x, bar=bar)
def write(info, kit):
    x = info['x']; a = int(max(0, info['t0'] - 0.02) * SR); tail = 0.5; b = int((info['t0'] + info['L'] + tail) * SR); s = x[a:min(len(x), b)].copy(); n = len(s)
    # snap start til nærmeste transient (første 80 ms)
    fi = int(0.006 * SR); s[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(0.45 * SR); s[n - fo:] *= (np.cos(np.linspace(0, np.pi / 2, fo)) ** 2)[:, None]
    g = np.sqrt((s ** 2).mean()); s *= 0.2 / (g + 1e-9); pk = np.abs(s).max()
    if pk > 0.95: s *= 0.95 / pk
    wav = os.path.join(TMP, 'mvp_' + kit + '.wav'); w = wave.open(wav, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(s, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    subprocess.run(['lame', '--quiet', '-b', '160', '-m', 'j', wav, os.path.join(DST, 'mvp_' + kit + '.mp3')], check=True); return n / SR
meta = {}
only = sys.argv[1:]
for kit, (cands, want) in KITS.items():
    if only and kit not in only: continue
    res = []
    for c in cands:
        if not os.path.exists(os.path.join(RAW, c + '.mp3')): continue
        try: r = analyse(c, want); res.append(r); print(f"  {kit:10s} {c:6s} bpm {r['bpm']:.1f} klarhed {r['clarity']:.2f} t0 {r['t0']:.2f}s L {r['L']:.1f}s score {r['score']:.3f}")
        except Exception as e: print('  fejl', c, e)
    if not res: continue
    best = max(res, key=lambda r: r['score'] * (0.5 + r['clarity']))
    d = write(best, kit); meta[kit] = dict(src=best['name'], bpm=round(best['bpm'], 1), t0=round(best['t0'], 2), dur=round(d, 2)); print(f"→ {kit}: {best['name']} {d:.2f} s")
json.dump(meta, open(os.path.join(HERE, 'mvp_kits.json'), 'w'), indent=1)
