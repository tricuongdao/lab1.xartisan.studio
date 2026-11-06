import os
from PIL import Image

os.makedirs("build-src/generated/brand", exist_ok=True)
icon = Image.open("build-src/icon.png").convert("RGB")

# apple touch icon
icon.resize((180, 180), Image.LANCZOS).save("build-src/generated/brand/apple-touch-icon.png", optimize=True)

# favicon: multi-resolution ICO
sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
frames = [icon.resize(s, Image.LANCZOS) for s in sizes]
frames[-1].save("build-src/generated/brand/favicon.ico", format="ICO", sizes=sizes)

# social card
og = Image.open("build-src/og.png").convert("RGB")
og.save("build-src/generated/brand/og-image.png", optimize=True)

for f in ["apple-touch-icon.png", "favicon.ico", "og-image.png"]:
    p = "build-src/generated/brand/" + f
    print(f, os.path.getsize(p))
