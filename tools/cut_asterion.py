#!/usr/bin/env python3
"""Cut `public/mob-asterion-walk.png` and `public/mob-asterion-dead.png` out of
a raw Universal LPC Spritesheet Character Generator export.

The house rules, unchanged from every other mob sheet in the game:
  * walk lives on rows 8..11 (up, left, down, right), 9 frames apiece
  * ONE crop rectangle for all 36 frames, or the arms' swing changes the width
    and the body jitters sideways as the cycle plays
  * that rectangle is SYMMETRIC about the 64px cell's centre line (x=32), so a
    wide prop on one side does not shove the body off the tile it stands on
  * the corpse is row 20's last frame, cropped tight to its own bounds

    python3 tools/cut_asterion.py <raw-export.png>
"""
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "character-spritesheet.png"
CELL, COLS, ROWS = 64, 9, (8, 9, 10, 11)
CORPSE_ROW, CORPSE_COL = 20, 5

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
print(f"walk union bbox x{x0}..{x1} y{y0}..{y1} -> symmetric crop x{cx0}..{cx1}  frame {w}x{h}")

out = Image.new("RGBA", (w*COLS, h*len(ROWS)), (0, 0, 0, 0))
for i, r in enumerate(ROWS):
    for c in range(COLS):
        out.paste(im.crop((c*CELL+cx0, r*CELL+y0, c*CELL+cx1, r*CELL+y1)), (c*w, i*h))
out.save("public/mob-asterion-walk.png")

cell = im.crop((CORPSE_COL*CELL, CORPSE_ROW*CELL, CORPSE_COL*CELL+CELL, CORPSE_ROW*CELL+CELL))
b = cell.getbbox()
cell.crop(b).save("public/mob-asterion-dead.png")
print("corpse", b, "->", (b[2]-b[0], b[3]-b[1]))
