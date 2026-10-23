#!/usr/bin/env python3
# fattoria – henter CC0-teksturer (1k jpg: diffuse, normal GL, ARM), CC0-modeller (glTF 1k) og HDRI (2k) fra Poly Haven (polyhaven.com – alt er CC0).
#   python3 tools/fattoria/fetch_assets.py [tex] [models] [hdri]
import json, os, sys, urllib.request
op = urllib.request.build_opener(); op.addheaders = [('User-Agent', 'Mozilla/5.0 white-dust')]; urllib.request.install_opener(op)
HERE = os.path.dirname(os.path.abspath(__file__)); TEX = os.path.join(HERE, 'cache', 'tex'); MOD = os.path.join(HERE, 'cache', 'models'); SKY = os.path.join(HERE, 'cache', 'sky')
for d in (TEX, MOD, SKY): os.makedirs(d, exist_ok=True)
MAP = {   # vores navn → Poly Haven-id
    'ft_roof': 'clay_roof_tiles_02', 'ft_roof_old': 'roof_tiles', 'ft_plaster': 'beige_wall_002', 'ft_ochre': 'clay_plaster', 'ft_rubble': 'plaster_stone_wall_02', 'ft_stone': 'stone_wall',
    'ft_sand': 'yellow_stone_wall', 'ft_ashlar': 'sandstone_blocks_05', 'ft_oldstone': 'old_stone_wall_02', 'ft_marble': 'marble_tiles', 'ft_terra': 'terracotta_floor_tiles',
    'ft_brickf': 'brick_villa_floor', 'ft_cobble': 'cobblestone_floor_08', 'ft_cobble2': 'square_cobblestone', 'ft_gravel': 'bicolour_gravel', 'ft_soil': 'gravelly_sand',
    'ft_dirt': 'brown_mud_dry', 'ft_grass': 'withered_grass', 'ft_lawn': 'grass_ground', 'ft_vault': 'medieval_red_brick', 'ft_timber': 'dark_wooden_planks', 'ft_floor': 'wood_floor_worn',
    'ft_beam': 'wood_planks_dirt', 'ft_deck': 'old_wood_floor', 'ft_black': 'black_painted_planks', 'ft_fence': 'weathered_plank_siding', 'ft_bark': 'bark_brown_01', 'ft_rock': 'rock_pitted_mossy'}
MODELS = ['wine_barrel_01', 'Barrel_01', 'Barrel_02', 'barrel_03', 'wooden_barrels_01', 'wooden_crate_01', 'wooden_crate_02', 'planter_box_01', 'planter_box_02', 'planter_box_03', 'planter_pot_clay', 'ceramic_pot',
          'ceramic_vase_01', 'ceramic_vase_02', 'ceramic_vase_03', 'ceramic_vase_04', 'antique_ceramic_vase_01', 'wicker_basket_01', 'wicker_basket_02', 'wooden_bucket_01', 'wine_bottles_01',
          'wooden_display_shelves_01', 'wooden_picnic_table', 'painted_wooden_bench', 'wooden_stool_01', 'WoodenChair_01', 'WoodenTable_01', 'round_wooden_table_01', 'large_castle_door', 'large_iron_gate',
          'lantern_chandelier_01', 'Lantern_01', 'brass_vase_01', 'jug_01', 'marble_bust_01', 'potted_plant_01', 'potted_plant_02', 'shrub_01', 'shrub_02', 'shrub_03', 'shrub_04', 'pine_tree_01', 'tree_small_02',
          'lemon', 'grass_medium_01', 'grass_medium_02', 'fern_02', 'rock_07', 'rock_09', 'boulder_01', 'tree_stump_01', 'wooden_ladder', 'watering_can_metal_01', 'wooden_lantern_01', 'vintage_day_bed',
          'dining_table', 'dining_chair_02', 'ClassicConsole_01', 'vintage_wooden_drawer_01', 'stone_fire_pit', 'hand_truck', 'periwinkle_plant', 'flower_gazania', 'rusted_spade_01']
HDRI = 'kiara_7_late-afternoon'
def get(u, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 0: return
    urllib.request.urlretrieve(u, dst)
def tex():
    for ours, ph in MAP.items():
        if os.path.exists(os.path.join(TEX, ours + '_albedo.jpg')): continue
        f = json.load(urllib.request.urlopen('https://api.polyhaven.com/files/' + ph))
        for k, suf in (('Diffuse', 'albedo'), ('nor_gl', 'normal'), ('arm', 'orm')):
            try: get(f[k]['1k']['jpg']['url'], os.path.join(TEX, '%s_%s.jpg' % (ours, suf)))
            except Exception as e: print('mangler', ours, ph, k, e)
        print('ok tex', ours, '<-', ph, flush=True)
def models():
    rows = []
    for mid in MODELS:
        out = os.path.join(MOD, mid)
        if os.path.exists(os.path.join(out, mid + '.gltf')): continue
        try:
            files = json.load(urllib.request.urlopen('https://api.polyhaven.com/files/' + mid)); g = files['gltf'].get('1k') or files['gltf'][sorted(files['gltf'].keys())[0]]; g = g['gltf']
            os.makedirs(out, exist_ok=True); get(g['url'], os.path.join(out, mid + '.gltf'))
            for rel, ff in g.get('include', {}).items():
                p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True); get(ff['url'], p)
            info = json.load(urllib.request.urlopen('https://api.polyhaven.com/info/' + mid)); print('ok model', mid, info.get('polycount'), flush=True)
        except Exception as e: print('FEJL model', mid, e)
def hdri():
    dst = os.path.join(SKY, HDRI + '_2k.hdr')
    if os.path.exists(dst): return
    f = json.load(urllib.request.urlopen('https://api.polyhaven.com/files/' + HDRI)); get(f['hdri']['2k']['hdr']['url'], dst); print('ok hdri', HDRI)
if __name__ == '__main__':
    what = sys.argv[1:] or ['tex', 'models', 'hdri']
    if 'tex' in what: tex()
    if 'models' in what: models()
    if 'hdri' in what: hdri()
