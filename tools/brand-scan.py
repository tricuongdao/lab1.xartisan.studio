from PIL import Image
import numpy as np

for f in [r"C:\Projects\xartisan-studio\tools\brand\assets\xartisan-mark.webp",
          r"C:\Projects\xartisan-studio\tools\brand\assets\logo512.png",
          r"C:\Projects\xartisan-studio\tools\brand\assets\loader-logo.png",
          r"C:\Projects\xartisan-studio\tools\brand\assets\logo.png"]:
    im = Image.open(f).convert("RGBA")
    a = np.array(im)
    rgb, al = a[..., :3].astype(int), a[..., 3]
    # ink = not near-white and not transparent
    dist = 255 - rgb.min(axis=2)
    ink = (al > 40) & (dist > 20)
    ys, xs = np.where(ink)
    print(f.split("\\")[-1], im.size, "mode", im.mode, "ink bbox", (xs.min(), ys.min(), xs.max(), ys.max()),
          "w", xs.max()-xs.min()+1, "h", ys.max()-ys.min()+1, "coverage", round(ink.mean(), 3))
