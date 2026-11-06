import os
from PIL import Image
import numpy as np

a = np.array(Image.open("build-src/tex-xartisan.png").convert("RGB")).astype(int)
lum = a.max(axis=2)
rows = np.where(lum.max(axis=1) > 12)[0]
bands = []
start = rows[0]; prev = rows[0]
for r in rows[1:]:
    if r - prev > 8:
        bands.append((start, prev)); start = r
    prev = r
bands.append((start, prev))
for (y0, y1) in bands:
    ys2, xs2 = np.where(lum[y0:y1+1] > 12)
    print("band", y0, y1, "baseline", y1, "x", xs2.min(), xs2.max(), "w", xs2.max()-xs2.min()+1)

alpha = np.clip(lum, 0, 255).astype(np.uint8)
rgba = np.dstack([
    np.full_like(alpha, 255),
    np.full_like(alpha, 245),
    np.full_like(alpha, 237),
    alpha,
])
img = Image.fromarray(rgba, "RGBA")
d = "build-src/generated/home/hero/textures/desktop/texts"
m = "build-src/generated/home/hero/textures/mobile/texts"
os.makedirs(d, exist_ok=True); os.makedirs(m, exist_ok=True)
img.save(os.path.join(d, "text-name-xt.webp"), "WEBP", quality=92, method=6)
img.resize((2048, 512), Image.LANCZOS).save(os.path.join(m, "text-name-xt.webp"), "WEBP", quality=86, method=6)
for p in [os.path.join(d, "text-name-xt.webp"), os.path.join(m, "text-name-xt.webp")]:
    print(p, os.path.getsize(p), Image.open(p).size)

