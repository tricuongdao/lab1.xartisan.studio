import sys
import numpy as np
from PIL import Image
a = np.array(Image.open("build-src/tex-xartisan.png").convert("RGB")).astype(int).max(axis=2)
rows = np.where(a.max(axis=1) > 12)[0]
bands = []
start = rows[0]; prev = rows[0]
for r in rows[1:]:
    if r - prev > 8:
        bands.append((start, prev)); start = r
    prev = r
bands.append((start, prev))
for (y0, y1) in bands:
    ys2, xs2 = np.where(a[y0:y1+1] > 12)
    print(y1, xs2.min(), xs2.max())
