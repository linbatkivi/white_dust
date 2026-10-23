#!/usr/bin/env python3
# niseko – henter CC0-teksturer fra Poly Haven (1k jpg: diffuse, normal GL, ARM) til cache/tex/<navn>_{albedo,normal,orm}.jpg
import json, os, sys, urllib.request
op = urllib.request.build_opener(); op.addheaders = [('User-Agent', 'Mozilla/5.0 white-dust')]; urllib.request.install_opener(op)
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'cache', 'tex')
MAP = {
    'nk_roof': 'grey_roof_tiles_02', 'nk_roof2': 'roof_slates_03', 'nk_plaster': 'beige_wall_001', 'nk_plaster2': 'grey_plaster_03', 'nk_timber': 'dark_wooden_planks', 'nk_cedar': 'japanese_cedar_planks',
    'nk_hinoki': 'hinoki_planks', 'nk_stonebase': 'japanese_stone_wall', 'nk_street': 'cobblestone_floor_04', 'nk_pebbles': 'pebble_bricks', 'nk_gravel': 'raked_dirt', 'nk_mosscob': 'mossy_cobblestone',
    'nk_deck': 'old_wood_floor', 'nk_bank': 'mossy_stone_wall', 'nk_bamboo': 'bamboo_wall', 'nk_fence': 'weathered_plank_siding', 'nk_slate': 'slate_floor_02', 'nk_dirt': 'forest_ground_04',
    'nk_riverbed': 'ganges_river_pebbles', 'nk_rock': 'rock_pitted_mossy', 'nk_bark': 'bark_willow', 'nk_beam': 'wood_planks_dirt', 'nk_floor': 'wood_floor_worn', 'nk_black': 'black_painted_planks'}
def get(u, dst):
    if os.path.exists(dst): return
    urllib.request.urlretrieve(u, dst)
GAIN = {}
def post(ours):
    """v26.9: Poly Haven-teksturerne er lyse og blanke – dæmp lysstyrken (stenen skal ligne gammel, våd sten) og løft ruheden (ingen spejlende himmel på gulvene)"""
    from PIL import Image
    import numpy as np
    pa = os.path.join(TEX, ours + '_albedo.jpg'); po = os.path.join(TEX, ours + '_orm.jpg')
    if ours in GAIN and os.path.exists(pa):
        a = np.asarray(Image.open(pa).convert('RGB')).astype(np.float32) * np.array(GAIN[ours], np.float32); Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(pa, quality=93)
    if ours.startswith('rn_') and os.path.exists(po):
        o = np.asarray(Image.open(po).convert('RGB')).astype(np.float32); o[..., 1] = 255 * (0.55 + 0.45 * o[..., 1] / 255.0); Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(po, quality=93)
for ours, ph in MAP.items():
    fresh = not os.path.exists(os.path.join(TEX, ours + '_albedo.jpg'))
    f = json.load(urllib.request.urlopen('https://api.polyhaven.com/files/' + ph))
    for k, suf in (('Diffuse', 'albedo'), ('nor_gl', 'normal'), ('arm', 'orm')):
        try: get(f[k]['1k']['jpg']['url'], os.path.join(TEX, '%s_%s.jpg' % (ours, suf)))
        except Exception as e: print('mangler', ours, ph, k, e)
    print('ok', ours, '<-', ph)
