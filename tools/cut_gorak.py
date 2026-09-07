#!/usr/bin/env python3
"""Cut `public/mob-gorak-walk.png` and `public/mob-gorak-dead.png` out of a raw
Universal LPC Spritesheet Character Generator export, at 1.4x.

The house rules are `cut_asterion.py`'s, unchanged:
  * walk lives on rows 8..11 (up, left, down, right), 9 frames apiece
  * ONE crop rectangle for all 36 frames, or the arms' swing changes the width
    and the body jitters sideways as the cycle plays
  * that rectangle is SYMMETRIC about the 64px cell's centre line (x=32), so a
    wide prop on one side does not shove the body off the tile it stands on
  * the corpse is row 20's last frame, cropped tight to its own bounds

WHAT IS DIFFERENT HERE IS THE SCALE, and it is the whole point of the file.
Gorak is built out of the SAME generator parts as the five orc ranks he
commands — same dark-green body, same orc head — so at native size he cuts to
32x46, which is the plain orc's frame to the pixel. A warlord who is exactly
the size of his own rank and file is not a warlord. He is drawn 40% larger:
45x64 per frame, against the berserker's 52x47 (wider, because of the axes)
and the plain orc's 32x46 (the same silhouette, smaller).

THE STEEL DOES NOT CHANGE THE CROP, which is worth knowing before anybody
re-runs this after adding a layer. Etap 54 dressed him in legion shoulders,
bracers, gloves and wide trousers to make the chronicle's claim about his iron
true on screen, and the union bounding box came back identical: LPC's legion
shoulders sit INSIDE the arm silhouette rather than out past it, so the frame
is still 32x46 before scaling and the sheet is still 405x256. A pauldron set
that did spill would widen the crop, and the smoke suite's frame check is what
would say so.

WHY THE WHOLE SHEET IS RESIZED IN ONE CALL rather than frame by frame. The
target is chosen so both divisions are exact — 405 = 9 x 45 and 256 = 4 x 64 —
and NEAREST on the assembled sheet is then arithmetically identical to
NEAREST on each frame separately, because floor((c*45 + j) * 32/45) is
c*32 + floor(j * 32/45) for every column j of every frame c. One call, no
seams, and no chance of two frames rounding differently.

1.4 IS NOT AN INTEGER SCALE and pixel art usually wants one. Nearest-neighbour
at 1.4 makes some source pixels one screen pixel wide and some two, which is
visible if you go looking for it and is not at this size, on a creature this
big, on a top-down map. The alternative was 2x, which would have made him
taller than Kárr's howe is wide. Radek asked for 40% and 40% is what this is.

    python3 tools/cut_gorak.py <raw-export.png>
"""
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "character-spritesheet.png"
CELL, COLS, ROWS = 64, 9, (8, 9, 10, 11)
CORPSE_ROW, CORPSE_COL = 20, 5
SCALE = 1.4

im = Image.open(SRC).convert("RGBA")

x0, y0, x1, y1 = 64, 64, 0, 0
for r in ROWS:
    for c in range(COLS):
        b = im.crop((c*CELL, r*CELL, c*CELL+CELL, r*CELL+CELL)).getbbox()
        if not b: continue
        x0, y0 = min(x0, b[0]), min(y0, b[1])
        x1, y1 = max(x1, b[2]), max(y1, b[3])
hw = max(CELL//2 - x0, x1 - CELL//2)
cx0, cx1 = CELL//2 - hw, CELL//2 + hw
w, h = cx1 - cx0, y1 - y0
bw, bh = round(w * SCALE), round(h * SCALE)
print(f"walk union bbox x{x0}..{x1} y{y0}..{y1} -> symmetric crop x{cx0}..{cx1}")
print(f"frame {w}x{h} -> {bw}x{bh} at {SCALE}x")

out = Image.new("RGBA", (w*COLS, h*len(ROWS)), (0, 0, 0, 0))
for i, r in enumerate(ROWS):
    for c in range(COLS):
        out.paste(im.crop((c*CELL+cx0, r*CELL+y0, c*CELL+cx1, r*CELL+y1)), (c*w, i*h))
out = out.resize((bw*COLS, bh*len(ROWS)), Image.NEAREST)
out.save("public/mob-gorak-walk.png")
print(f"sheet {out.width}x{out.height} (9x4 grid of {bw}x{bh})")

cell = im.crop((CORPSE_COL*CELL, CORPSE_ROW*CELL, CORPSE_COL*CELL+CELL, CORPSE_ROW*CELL+CELL))
b = cell.getbbox()
body = cell.crop(b)
body = body.resize((round(body.width*SCALE), round(body.height*SCALE)), Image.NEAREST)
body.save("public/mob-gorak-dead.png")
print("corpse", b, "->", (body.width, body.height))
