import numpy as np
from PIL import Image

img = Image.open(r"C:\Projects\xartisan-studio\tools\brand\assets\xartisan-mark.webp").convert("RGBA")
a = np.array(img)
rgb, alpha = a[..., :3].astype(int), a[..., 3]
dist = 255 - rgb.min(axis=2)
mask = (alpha > 40) & (dist > 24)
ys, xs = np.where(mask)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
mask = mask[y0:y1+1, x0:x1+1]
H, W = mask.shape

CASES = {1:[("L","T")],2:[("T","R")],3:[("L","R")],4:[("R","B")],6:[("T","B")],7:[("L","B")],
         8:[("B","L")],9:[("B","T")],11:[("B","R")],12:[("R","L")],13:[("R","T")],14:[("T","L")]}
segs=[]
for i in range(H-1):
    for j in range(W-1):
        idx=(1 if mask[i,j] else 0)|(2 if mask[i,j+1] else 0)|(4 if mask[i+1,j+1] else 0)|(8 if mask[i+1,j] else 0)
        if idx in (0,15): continue
        pts={"T":(j+.5,i),"R":(j+1,i+.5),"B":(j+.5,i+1),"L":(j,i+.5)}
        if idx in (5,10):
            s=[("L","T"),("R","B")] if mask[i,j+1] else [("T","R"),("B","L")]
        else: s=CASES[idx]
        for x in s: segs.append((pts[x[0]],pts[x[1]]))
print("segments", len(segs))
key=lambda p:(round(p[0]*2)/2, round(p[1]*2)/2)
starts={}
for n,(p,q) in enumerate(segs): starts.setdefault(key(p),[]).append(n)
used=[False]*len(segs); loops=[]
for n0 in range(len(segs)):
    if used[n0]: continue
    loop=[]; cur=n0
    while True:
        used[cur]=True; p,q=segs[cur]; loop.append(p)
        nxt=next((m for m in starts.get(key(q),[]) if not used[m]), None)
        if nxt is None:
            loop.append(q); break
        cur=nxt
    loops.append(loop)
print("loops", [len(l) for l in loops][:20], "total", len(loops))
for li,l in enumerate(loops[:6]):
    arr=np.array(l); ar=0.0
    for i in range(len(l)-1):
        x1,y1=l[i]; x2,y2=l[i+1]; ar+=x1*y2-x2*y1
    print(f" loop{li} n={len(l)} bbox=({arr[:,0].min():.0f},{arr[:,1].min():.0f})-({arr[:,0].max():.0f},{arr[:,1].max():.0f}) area={abs(ar/2):.0f}")
