# Piper-stemme fra espeak-ng-lydskrift (omgår piper-pakkens defekte indbyggede espeak) → wav
import sys, subprocess, unicodedata, wave, inspect
import numpy as np
from piper import PiperVoice
model, text, out = sys.argv[1], sys.argv[2], sys.argv[3]
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
v = PiperVoice.load(model)
ipa = subprocess.run(['espeak-ng', '-q', '--ipa=3', '-v', 'en-us', text], capture_output=True, text=True).stdout.strip()
ipa = ipa.replace('_', '').replace('\n', ' ').replace('\u200d', '')
ph = list(unicodedata.normalize('NFD', ipa))
ids = v.phonemes_to_ids(ph)
sig = inspect.signature(v.phoneme_ids_to_audio)
try:
    from piper import SynthesisConfig
    cfg = SynthesisConfig(length_scale=scale, noise_scale=0.5, noise_w_scale=0.6)
    a = v.phoneme_ids_to_audio(ids, cfg)
except Exception as e:
    a = v.phoneme_ids_to_audio(ids)
a = np.asarray(a, dtype=np.float32).ravel()
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(v.config.sample_rate); w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
print(out, ipa, round(len(a) / v.config.sample_rate, 2), 's')
