import re
p = "tools/trace-mark.py"
s = open(p, encoding="utf-8").read()
s = s.replace('print(f"{len(SEGMENTS)} segments -> {len(loops)} loops")', '''print(f"{len(SEGMENTS)} segments -> {len(loops)} loops")
for li, lp in enumerate(loops):
    arr = np.array(lp)
    a_raw = 0.0
    for i in range(len(lp) - 1):
        x1, y1 = lp[i]; x2, y2 = lp[i + 1]
        a_raw += x1 * y2 - x2 * y1
    print(f"  loop {li}: {len(lp)} pts bbox x{arr[:,0].min():.0f}-{arr[:,0].max():.0f} y{arr[:,1].min():.0f}-{arr[:,1].max():.0f} area {abs(a_raw/2):.0f}")''')
open(p, "w", encoding="utf-8").write(s)
print("patched")
