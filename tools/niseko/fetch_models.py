#!/usr/bin/env python3
# valkyrie – henter CC0-modeller (glTF, 1K) fra Poly Haven til cache/models/<id>/ (CREDITS.md i cache/models)
#   python3 tools/valkyrie/fetch_models.py covered_car painted_wooden_bench ...
# Poly Haven: alle modeller er CC0 (public domain) – https://polyhaven.com/license
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, 'cache', 'models')
CRED = os.path.join(DST, 'CREDITS.md')

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'wd-fps-asset-fetch/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r: return r.read()

def fetch(mid, res='1k'):
    out = os.path.join(DST, mid)
    if os.path.exists(os.path.join(out, mid + '.gltf')): print('  findes', mid); return None
    files = json.loads(get('https://api.polyhaven.com/files/' + mid))
    g = files['gltf'].get(res) or files['gltf'][sorted(files['gltf'].keys())[0]]
    g = g['gltf']
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, mid + '.gltf'), 'wb').write(get(g['url']))
    n = 0
    for rel, f in g.get('include', {}).items():
        p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(get(f['url'])); n += 1
    info = json.loads(get('https://api.polyhaven.com/info/' + mid))
    print('  hentet', mid, '·', n, 'filer ·', info.get('polycount'), 'trekanter')
    return info

if __name__ == '__main__':
    rows = []
    for mid in sys.argv[1:]:
        try:
            info = fetch(mid)
            if info: rows.append('| %s | %s | %s | (v14) |' % (mid, info.get('name', mid), '{:,}'.format(info.get('polycount', 0)).replace(',', '.')))
        except Exception as e: print('  FEJL', mid, e)
    if rows:
        with open(CRED, 'a') as f: f.write('\n'.join(rows) + '\n')
