# Town buildings — `public/prop-town-*.png`

Fourteen city buildings, ready to place but **not yet wired into the game**.
They sit in `public/` and nothing references them. This file is the note that
tells whoever wires them up what each one is, how big it is, and what it is for.

Everything here is *scenery*, not *structure*. Structures are the Home Isle
things the player builds and hits (`build-*.png`, `src/gfx/buildingArt.ts`);
scenery is furniture the world is made of (`prop-*.png`,
`src/gfx/sceneryArt.ts`). A town building is furniture.

## The contract these files already satisfy

Scenery is drawn bottom-centre over its footprint block:

```ts
const bx = sc.tx * TILE + (fp.w * TILE) / 2;
const by = (sc.ty + fp.h) * TILE;
```

so the PNG must be **exactly `FOOTPRINT.w * 32` by `FOOTPRINT.h * 32` pixels**,
with the art seated flush against the bottom edge. Every file below is cut that
way already — the footprint is readable straight off the image (`width / 32` by
`height / 32`) and cannot drift out of sync with the code. Don't rescale them.

## The catalogue

`Blocks` is the *suggested* `BLOCK` entry: how many rows counted **up from the
bottom** stop a walker. The rest is overhang the player walks behind, exactly
like a tree's crown. Width always matches the footprint — a narrower block hugs
the left edge of the sprite instead of centring under it.

| File | Suggested kind | Tiles | Blocks | What it is |
| --- | --- | --- | --- | --- |
| `prop-town-chapel.png` | `chapel` | 2 x 3 | 2 x 2 | Small stone church, red spire, bell in the tower, cross on top. The one overtly religious building. |
| `prop-town-shop.png` | `shop` | 2 x 3 | 2 x 2 | Round stone turret with a conical roof and a **blank hanging shop sign**. The generic vendor front — put one at each merchant NPC. |
| `prop-town-townhouse.png` | `townhouse` | 2 x 4 | 2 x 3 | Three storeys, stone ground floor, timber above, tiered roof. Narrow — the building to line a street with. |
| `prop-town-watchtower.png` | `watchtower` | 2 x 4 | 2 x 3 | Plain stone tower, barred door, conical roof. Wall corners, gate flanks, town edge. |
| `prop-town-bank.png` | `bank` | 3 x 3 | 3 x 2 | Classical pediment, pilasters, barred metal gate. Reads as vault/depot. Sandstone, so it stands out from the grey ones. |
| `prop-town-keep.png` | `keep` | 4 x 3 | 4 x 2 | Heavy stone hall, arched entrance with steps running into the dark, corner turret. The biggest civic building in the set. |
| `prop-town-workshop.png` | `workshop` | 4 x 3 | 4 x 2 | Grey slate roof over an open timber loft, raised on a stone terrace, side annex. Utilitarian — craft quarter. |
| `prop-town-warehouse.png` | `warehouse` | 4 x 3 | 4 x 2 | Stone, arched stair entrance, **a cantilevered loading crane on the left**. Docks, or wherever goods move. |
| `prop-town-temple.png` | `temple` | 4 x 3 | 4 x 2 | Symmetrical, layered red roofs, blank name-board over double doors. Official rather than devotional — order hall, academy, courthouse. |
| `prop-town-apothecary.png` | `apothecary` | 4 x 3 | 4 x 2 | Warm plaster manor, cupola, hanging bottle sign, name-board. Fits the herbalist. |
| `prop-town-market.png` | `market` | 5 x 2 | 5 x 2 | Wide roof on posts over an open arcade, big double gate, stall canopy. Two tiles deep, so it is solid all through. |
| `prop-town-guildhall.png` | `guildhall` | 6 x 2 | 6 x 2 | Long half-timbered hall, central gabled porch, a run of windows. Widest piece in the set. |
| `prop-town-tavern.png` | `tavern` | 5 x 3 | 5 x 2 | Timber lodge, external stairs both sides, balcony, chimney. |
| `prop-town-tradehouse.png` | `tradehouse` | 5 x 3 | 5 x 2 | Broad stone-and-timber house, wide red roof, external stair, **hanging coin-purse sign**. The trade hub's anchor building. |

Kind names above are suggestions, but they are what the rest of this file
assumes; if they change, change them here too.

## Wiring one up

Five edits, all mechanical, all in two files:

1. `src/world/types.ts` — add the name to the `SceneryKind` union.
2. `src/gfx/sceneryArt.ts` — add an entry to each of `SRC`, `SCENERY_NAME`,
   `FOOTPRINT`, `BLOCK` and `FALLBACK`. `FALLBACK` for all of these is `"hut"`,
   same as the Gallows Coast buildings: wrong size, right idea, only ever seen
   if a PNG fails to load.
3. Give the map a glyph. In a `HandmadeSpec`, `scenery: { "H": "tavern" }` and
   then an `H` in the tile rows. **The glyph marks the top-left square of the
   footprint**, not the centre and not the door.

`loadSceneryArt()` and the smoke suite pick the new kind up on their own —
`SCENERY_KINDS` is derived from `SRC`.

## Placing them on a map

- The glyph is top-left, so a 6 x 2 guildhall placed at `(x, y)` eats columns
  `x..x+5` and rows `y..y+1`. Leave the row below it walkable or the door is
  unreachable.
- Two buildings may not overlap footprints, and the smoke suite checks
  pathfinding, not coordinates — if a placement walls a town off, the tests say
  so.
- Buildings three tiles deep leave the top row as overhang: the player walks
  behind the roof there and the y-sort hides him. Buildings two tiles deep
  (`market`, `guildhall`) have no overhang to give and are solid throughout.
- Don't crowd the doors. Every one of these has its entrance on the bottom row,
  centred or near it, and an NPC standing on the doorstep is the point of the
  building.

## Two things to check on first playtest

- **No baked ground shadow.** The Gallows Coast props had a soft ellipse added
  during their cut; these arrived without one, and `artShadow` is a no-op once
  prop art has loaded (`src/main.ts`), so nothing draws under them. On the town
  terrain they may read as floating. If they do, the fix is a shadow baked into
  the PNG, not code.
- **Palette.** These are native pixel art at final size — no downscale, no
  requantisation — so they are cleaner and slightly more saturated than
  `prop-house-a.png` and its neighbours, which were 480 px illustrations shrunk
  to fit. Standing next to each other in one town, that difference is visible.
  Keep the two families in different settlements if it jars.
