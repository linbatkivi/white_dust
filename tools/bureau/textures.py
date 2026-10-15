#!/usr/bin/env python3
# de_bureau – materialernes teksturer → KTX2 (basisu) til spillet: public/assets/bureau/tex/<id>_{d,n,a}.ktx2
#   Læser world.json (materialer med 'files': albedo/normal/ORM – også modellernes egne teksturer). Springer eksisterende filer over.
import json, os, subprocess, concurrent.futures as cf
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DST = os.path.join(ROOT, 'public', 'assets', 'bureau', 'tex'); TMP = os.path.join(HERE, 'cache', 'tmp')
os.makedirs(DST, exist_ok=True); os.makedirs(TMP, exist_ok=True)
def enc(src, dst, kind, size):
    if os.path.exists(dst) and os.path.getsize(dst) > 0: return 0
    if not src or not os.path.exists(src):
        im = Image.new('RGB', (64, 64), {'n': (128, 128, 255), 'a': (255, 160, 0), 'd': (200, 200, 200)}[kind]); size = 64
    else: im = Image.open(src).convert('RGB')
    if im.size[0] > size: im = im.resize((size, size), Image.LANCZOS)
    elif im.size[0] != im.size[1] or (im.size[0] & (im.size[0] - 1)): im = im.resize((min(size, 1024), min(size, 1024)), Image.LANCZOS)
    tmp = os.path.join(TMP, os.path.basename(dst) + '.png'); im.save(tmp)
    args = {'d': ['-mipmap', '-srgb', '-q', '200'], 'n': ['-uastc', '-uastc_rdo_l', '2.0', '-mipmap', '-linear', '-normal_map'], 'a': ['-mipmap', '-linear', '-q', '160']}[kind]
    r = subprocess.run(['basisu', '-ktx2'] + args + ['-file', tmp, '-output_file', dst], capture_output=True, text=True); os.remove(tmp)
    if r.returncode != 0 or not os.path.exists(dst): raise RuntimeError('basisu: %s %s' % (src, r.stdout[-300:]))
    return os.path.getsize(dst)
if __name__ == '__main__':
    wj = json.load(open(os.path.join(ROOT, 'public', 'assets', 'bureau', 'world.json')))
    jobs, seen = [], set()
    for name, d in wj['materials'].items():
        f = d.get('files'); tid = d.get('tex')
        if not f or not tid or tid in seen: continue
        seen.add(tid); big = 2048 if not d.get('model') else 1024
        jobs.append((f.get('d'), os.path.join(DST, tid + '_d.ktx2'), 'd', big))
        if f.get('n'): jobs.append((f['n'], os.path.join(DST, tid + '_n.ktx2'), 'n', 1024))
        if f.get('a'): jobs.append((f['a'], os.path.join(DST, tid + '_a.ktx2'), 'a', 1024))
    with cf.ThreadPoolExecutor(3) as ex: list(ex.map(lambda a: enc(*a), jobs))
    print('KTX2: %d filer, %.1f MB i %s' % (len(os.listdir(DST)), sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST)) / 1e6, DST))
