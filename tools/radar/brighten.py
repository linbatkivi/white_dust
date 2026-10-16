# v20: CS2-radarer er mørke (gennemsnitlig luminans ≈ 0,23) og forsvinder på spillets mørke minimap.
# Løfter niveauerne (5–95 %-percentilerne → 0,45–0,92), bevarer farvetonerne (spawn-/site-farver) og tilføjer en mørk kontur.
#   python3 tools/radar/brighten.py tools/inferno_src/radar.webp public/assets/radar/inferno_0.png
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); a = np.array(im).astype(np.float32) / 255
rgb, al = a[..., :3], a[..., 3]
l = rgb @ np.array([0.2126, 0.7152, 0.0722]); m = al > 0.5
lo, hi = np.percentile(l[m], [5, 95])
ln = np.clip((l - lo) / max(1e-3, hi - lo), 0, 1.25) * 0.47 + 0.45
sat = rgb - l[..., None]                                                    # farveafvigelse (spawn grøn/blå, sites orange)
out = np.clip(ln[..., None] + sat * 1.8, 0, 1)
# kontur: mørk kant hvor alfa skifter (så gangene står skarpt)
edge = np.array(Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))).astype(np.float32) / 255
ring = np.clip(edge - al, 0, 1)
res = np.dstack([out * al[..., None] + 0.08 * ring[..., None], np.maximum(al, ring * 0.9)])
Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8)).save(dst)
print('radar lysnet', src, '→', dst, 'lum', round(float(lo), 3), round(float(hi), 3))
