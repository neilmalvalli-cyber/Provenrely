"""Opaque version of the small logo mark for light backgrounds -> public/brand/mark-160-solid.webp.

The mark's silhouette is drawn from its facet geometry (the same polygons the landing intro strokes, in the 1254px
artwork's coordinates), so the cut-out follows the real edges: no glow halo, no dark fringe. Inside it, the
artwork is composited over a deep indigo base so the glass facets become fully opaque.

  python scripts/solid-mark.py      # needs pillow; run from frontend/
"""
from PIL import Image, ImageDraw, ImageFilter
EDGES = [
 [(405,302),(625,168),(625,432),(405,548)],
 [(625,168),(857,300),(625,432)],
 [(405,548),(577,458),(577,655)],
 [(680,425),(852,530),(680,626)],
 [(400,785),(625,657),(625,912)],
 [(625,657),(852,529),(852,785),(625,912)],
]
src = Image.open("public/brand/mark-640.webp").convert("RGBA")
W, H = src.size
s = H / 830  # mark crop: x 339, y 120, 585x830 of the 1254 artwork
SS = 4
mask = Image.new("L", (W*SS, H*SS), 0)
d = ImageDraw.Draw(mask)
for poly in EDGES:
    d.polygon([((x-339)*s*SS, (y-120)*s*SS) for x, y in poly], fill=255)
GROW = 2  # px at 640 size: just covers the bright edge stroke
mask = mask.filter(ImageFilter.MaxFilter(GROW * SS*2+1)).resize((W, H), Image.LANCZOS)
base = Image.new("RGBA", (W, H), (26, 22, 84, 255))
base.alpha_composite(src)
base.putalpha(mask)
base.resize((round(W * 160 / H), 160), Image.LANCZOS).save("public/brand/mark-160-solid.webp", lossless=True, method=6)
