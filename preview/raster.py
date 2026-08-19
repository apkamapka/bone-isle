import json, re, sys
from PIL import Image

rects = json.load(open("/tmp/rects.json"))

SCALE = 2
W, H = 450, 165
# grass, so the frame is judged against what it actually sits on in game
img = Image.new("RGBA", (W, H), (86, 128, 62, 255))

def parse(c):
    c = c.strip()
    m = re.match(r"rgba?\(([^)]+)\)", c)
    if m:
        p = [x.strip() for x in m.group(1).split(",")]
        r, g, b = int(p[0]), int(p[1]), int(p[2])
        a = float(p[3]) if len(p) > 3 else 1.0
        return (r, g, b, int(round(a * 255)))
    c = c.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)

for r in rects:
    x, y, w, h = int(r["x"]), int(r["y"]), int(r["w"]), int(r["h"])
    if w <= 0 or h <= 0:
        continue
    layer = Image.new("RGBA", (w, h), parse(r["c"]))
    img.alpha_composite(layer, (x, y))

img.resize((W * SCALE, H * SCALE), Image.NEAREST).save("/tmp/chrome.png")
print("wrote /tmp/chrome.png", W * SCALE, "x", H * SCALE, "from", len(rects), "rects")
