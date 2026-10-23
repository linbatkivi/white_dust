#!/usr/bin/env python3
# bureau (v26.15 grafikløft) – henter ekstra CC0-teksturer fra Poly Haven (1k jpg: diffuse, normal GL, ARM) til tools/bureau/cache/tex/<vores navn>_{albedo,normal,orm}.jpg
#   python3 tools/bureau/fetch_tex2.py
import json, os, sys, urllib.request
op = urllib.request.build_opener(); op.addheaders = [('User-Agent', 'Mozilla/5.0 white-dust')]; urllib.request.install_opener(op)
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'cache', 'tex'); os.makedirs(TEX, exist_ok=True)
MAP = {   # vores navn → Poly Haven-id
    'ribbed_wall': 'ribbed_concrete_wall',          # gange: lodret rillet arkitektbeton (skyggelinjer i lyset)
    'slab_wall': 'concrete_slab_wall_02',           # garage/lager: brætformet beton
    'walnut_veneer': 'walnut_veneer',               # lobbyens vægge: valnødfiner
    'granite_deck': 'granite_tile_03',              # tagterrassen: granitfliser (våde i regnen)
    'panel_wood': 'dark_paneled_wood',              # kassetter (accentvægge i atriet)
}
def get(u, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 0: return
    urllib.request.urlretrieve(u, dst)
for ours, ph in MAP.items():
    f = json.load(urllib.request.urlopen('https://api.polyhaven.com/files/' + ph))
    for k, suf in (('Diffuse', 'albedo'), ('nor_gl', 'normal'), ('arm', 'orm')):
        try: get(f[k]['1k']['jpg']['url'], os.path.join(TEX, '%s_%s.jpg' % (ours, suf)))
        except Exception as e: print('mangler', ours, ph, k, e)
    print('ok', ours, '<-', ph, flush=True)
# våd granit: ARM-kortets ruhed (G) ned til en tredjedel → spejlende pytter af lys i regnen
import numpy as np
from PIL import Image
a = np.array(Image.open(os.path.join(TEX, 'granite_deck_orm.jpg')).convert('RGB')).astype(np.float32)
a[..., 1] = np.clip(a[..., 1] * 0.32, 30, 255); Image.fromarray(a.astype(np.uint8)).save(os.path.join(TEX, 'granite_deck_orm_wet.jpg'), quality=92)
