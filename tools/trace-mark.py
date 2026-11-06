"""Trace the Xartisan Studio mark raster into clean polygons.

Moore-neighbour boundary tracing on the ink mask (outer contour + interior holes),
RDP simplification, then SVG (even-odd) + JSON polygons for the extruded 3D version.
The result is verified by re-rasterising the polygons and comparing with the source mask.

    python tools/trace-mark.py
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path(r"C:\Projects\xartisan-studio\tools\brand\assets\xartisan-mark.webp")
OUT_SVG = Path("build-src/generated/brand/logo-xartisan.svg")
OUT_JSON = Path("build-src/mark-polygons.json")

# ---------------------------------------------------------------- mask
img = Image.open(SRC).convert("RGBA")
arr = np.array(img)
rgb, alpha = arr[..., :3].astype(int), arr[..., 3]
dist = 255 - rgb.min(axis=2)
mask = (alpha > 40) & (dist > 24)
ys, xs = np.where(mask)
mask = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
H, W = mask.shape
print(f"mask {W}x{H} ink {mask.sum()} px")

# ---------------------------------------------------------------- components
def components(m):
    seen = np.zeros_like(m, bool)
    out = []
    h, w = m.shape
    for sy in range(h):
        for sx in range(w):
            if not m[sy, sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)])
            seen[sy, sx] = True
            px = []
            while q:
                y, x = q.popleft()
                px.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            out.append(px)
    return out

def outside_mask(m):
    """background pixels connected to the border"""
    h, w = m.shape
    bg = ~m
    out = np.zeros_like(m, bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg[y, x] and not out[y, x]:
                out[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg[y, x] and not out[y, x]:
                out[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out

# ---------------------------------------------------------------- Moore tracing
DIRS = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]  # clockwise
INDEX = {d: i for i, d in enumerate(DIRS)}

def trace(m):
    """returns the boundary of the first component in m as [(x, y), ...]"""
    h, w = m.shape
    start = None
    for y in range(h):
        for x in range(w):
            if m[y, x]:
                start = (y, x)
                break
        if start:
            break
    if start is None:
        return []
    # backtrack direction: we "came" from the west
    b = INDEX[(0, -1)]
    cur = start
    contour = []
    for _ in range(4 * h * w):
        contour.append((cur[1], cur[0]))
        found = None
        for k in range(1, 9):
            i = (b + k) % 8
            dy, dx = DIRS[i]
            ny, nx = cur[0] + dy, cur[1] + dx
            if 0 <= ny < h and 0 <= nx < w and m[ny, nx]:
                found = (ny, nx)
                b = (i + 4) % 8
                break
        if found is None:
            break
        cur = found
        if cur == start and len(contour) > 4:
            break
    return contour

def rdp(points, eps):
    pts = np.array(points, dtype=float)
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 <= i0 + 1:
            continue
        p0, p1 = pts[i0], pts[i1]
        line = p1 - p0
        n = float(np.linalg.norm(line))
        seg = pts[i0 + 1:i1] - p0
        d = np.linalg.norm(seg, axis=1) if n == 0 else np.abs(line[0] * seg[:, 1] - line[1] * seg[:, 0]) / n
        if len(d) == 0:
            continue
        k = int(np.argmax(d))
        if d[k] > eps:
            keep[i0 + 1 + k] = True
            stack.append((i0, i0 + 1 + k))
            stack.append((i0 + 1 + k, i1))
    return [tuple(p) for p in pts[keep]]

def signed_area(poly):
    s = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        s += x1 * y2 - x2 * y1
    return s / 2

# ---------------------------------------------------------------- collect polygons
polys = []
for comp in components(mask):
    m = np.zeros_like(mask)
    for y, x in comp:
        m[y, x] = True
    c = trace(m)
    if len(c) > 8:
        c.append(c[0])
        simp = rdp(c, 1.2)[:-1]
        if len(simp) >= 3:
            polys.append(simp)
print("outer polys:", [(len(p), round(abs(signed_area(p)))) for p in polys])

outside = outside_mask(mask)
holes = mask.copy()
holes[outside] = False  # nothing
holes = (~mask) & ~outside
for comp in components(holes):
    m = np.zeros_like(mask)
    for y, x in comp:
        m[y, x] = True
    c = trace(m)
    if len(c) > 8:
        c.append(c[0])
        simp = rdp(c, 1.2)[:-1]
        if len(simp) >= 3 and abs(signed_area(simp)) > 200:
            polys.append(simp)
print("all polys:", [(len(p), round(abs(signed_area(p)))) for p in polys])

# ---------------------------------------------------------------- verify by re-rasterising
canvas = Image.new("L", (W, H), 0)
drw = ImageDraw.Draw(canvas)
for p in polys:
    drw.polygon([(x, y) for x, y in p], fill=255)
# even-odd: repaint holes
for p in polys:
    if abs(signed_area(p)) < 3000:
        drw.polygon([(x, y) for x, y in p], fill=0)
recon = np.array(canvas) > 127
inter = (recon & mask).sum()
union = (recon | mask).sum()
print(f"IoU {inter / union:.4f}  (recon {recon.sum()} vs mask {mask.sum()})")

# ---------------------------------------------------------------- normalise + write
SCALE = 100.0 / W
VB_H = round(H * SCALE, 2)
fmt = lambda v: (f"{v:.2f}".rstrip("0").rstrip(".") or "0")
paths = []
for p in polys:
    coords = [(x * SCALE, y * SCALE) for x, y in p]
    paths.append("M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in coords) + "Z")

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="{round(512 * H / W, 2)}" '
    f'viewBox="0 0 100 {VB_H}"><path fill-rule="evenodd" d="{" ".join(paths)}"/></svg>\n'
)
OUT_SVG.parent.mkdir(parents=True, exist_ok=True)
OUT_SVG.write_text(svg, encoding="utf-8")
OUT_JSON.write_text(json.dumps({
    "width": 100, "height": VB_H,
    "polygons": [[[round(x * SCALE, 3), round(y * SCALE, 3)] for x, y in p] for p in polys],
}, indent=1), encoding="utf-8")
print("wrote", OUT_SVG, len(svg), "bytes; viewBox 0 0 100", VB_H)
