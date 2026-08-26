# Town buildings — `public/prop-town-*.png`

Thirty settlement props, **wired and standing**. All thirty are `SceneryKind`s
now (`src/world/types.ts`, `src/gfx/sceneryArt.ts`) and twenty-five of them are
placed on Bonetown (`src/world/townSpec.ts`). This file is the note that says
what each one is, how big it is, and what it is for.

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

`Blocks` is the `BLOCK` entry as it now ships: how many rows counted **up from
the bottom** stop a walker. The rest is overhang the player walks behind,
exactly like a tree's crown. Width always matches the footprint — a narrower
block hugs the left edge of the sprite instead of centring under it, which is a
trap worth remembering when a building's solid part is narrower than its art
(see the windmills).

**The depths changed when these were wired up, and the numbers below are the
ones in the code.** The suite has always held every prop to "seal no more than
half your own depth", and that bound rounded DOWN — which was free while every
building was four or five deep, because floor and ceil agree there. A
three-deep town house is a row of doorway, a row of wall and a row of roof, and
under the old bound it could seal only the doorway: the player stood in the
middle of the wall, drawn behind the building and therefore invisible. The
bound now rounds up. So two-deep props seal one row (the tent's rule),
three-deep seal two, four-deep seal two, and nothing seals its roof.

### Civic and grand

| File | Kind | Tiles | Blocks | What it is |
| --- | --- | --- | --- | --- |
| `prop-town-keep.png` | `keep` | 4 x 3 | 4 x 2 | Heavy stone hall, arched entrance with steps into the dark, corner turret. |
| `prop-town-temple.png` | `temple` | 4 x 3 | 4 x 2 | Symmetrical, layered red roofs, blank name-board over double doors. Official rather than devotional — order hall, courthouse. |
| `prop-town-greattemple.png` | `greatTemple` | 5 x 5 | 5 x 2 | The big one. Two tiers of sweeping roof over a gabled porch, stone plinths either side. Biggest piece in the set — give it a square, not a street. |
| `prop-town-observatory.png` | `observatory` | 3 x 5 | 3 x 2 | Round stone tower, external spiral stair climbing the right side, glazed lookout gallery under a red cap. Scholar's tower — mage guild, library, Time Sage. |
| `prop-town-chapel.png` | `chapel` | 2 x 3 | 2 x 2 | Small stone church, red spire, bell in the tower, cross on top. |
| `prop-town-shrine.png` | `shrine` | 2 x 2 | 2 x 1 | Brick shrine, barred arch, steep roof. Smallest building here — roadside, graveyard, courtyard corner. |
| `prop-town-bank.png` | `bank` | 3 x 3 | 3 x 2 | Classical pediment, pilasters, barred metal gate. Reads as vault/depot; sandstone, so it stands out from the grey ones. |
| `prop-town-guildhall.png` | `guildhall` | 6 x 2 | 6 x 1 | Long half-timbered hall, central gabled porch, a run of windows. Widest piece in the set. |
| `prop-town-watchtower.png` | `watchtower` | 2 x 4 | 2 x 2 | Plain stone tower, barred door, conical roof. Wall corners, gate flanks, town edge. |

### Trade

| File | Kind | Tiles | Blocks | What it is |
| --- | --- | --- | --- | --- |
| `prop-town-tradehouse.png` | `tradehouse` | 5 x 3 | 5 x 2 | Broad stone-and-timber house, wide red roof, external stair, hanging coin-purse sign. The trade hub's anchor building. |
| `prop-town-market.png` | `market` | 5 x 2 | 5 x 1 | Wide roof on posts over an open arcade, big double gate, stall canopy. |
| `prop-town-warehouse.png` | `warehouse` | 4 x 3 | 4 x 2 | Stone, arched stair entrance, cantilevered loading crane on the left. Docks, or wherever goods move. |
| `prop-town-shoprow.png` | `shoprow` | 4 x 2 | 4 x 1 | Two arched shop bays under side awnings flanking a gabled porch. Two vendors under one roof. |
| `prop-town-storefront.png` | `storefront` | 4 x 2 | 4 x 1 | Plain wide house, veranda posts, signed door. The cheapest way to fill a street with something that looks open for business. |
| `prop-town-shophouse.png` | `shophouse` | 3 x 2 | 3 x 1 | Narrow version of the same idea — deep overhanging roof on posts, one window, signed door. |
| `prop-town-shop.png` | `shop` | 2 x 3 | 2 x 2 | Round stone turret with a conical roof and a **blank hanging shop sign**. |
| `prop-town-apothecary.png` | `apothecary` | 4 x 3 | 4 x 2 | Warm plaster manor, cupola, hanging bottle sign, name-board. Fits the herbalist. |
| `prop-town-workshop.png` | `workshop` | 4 x 3 | 4 x 2 | Grey slate roof over an open timber loft, raised on a stone terrace, side annex. Craft quarter. |

Four shopfronts of four different widths (`shoprow` 4, `storefront` 4,
`shophouse` 3, `shop` 2) is deliberate: a market street reads as a street when
the frontages don't all measure the same.

### Lodging and homes

| File | Kind | Tiles | Blocks | What it is |
| --- | --- | --- | --- | --- |
| `prop-town-tavern.png` | `tavern` | 5 x 3 | 5 x 2 | Timber lodge, external stairs both sides, balcony, chimney. |
| `prop-town-inn.png` | `inn` | 4 x 3 | 4 x 2 | Two-storey sandstone manor, dormers, awnings over shop bays, hanging lantern. |
| `prop-town-manor.png` | `manor` | 4 x 3 | 4 x 2 | Sister to the inn — more chimneys, more dormers, a big blank name-board on the left. The grandest private house. |
| `prop-town-towerhouse.png` | `towerhouse` | 4 x 4 | 4 x 2 | Tall: stone ground floor, open timbered balcony, tiered roofs, hanging sign. Tallest non-tower building. |
| `prop-town-stonehouse.png` | `stonehouse` | 5 x 3 | 5 x 2 | Sprawling stone-and-timber house, upper bay window, stone terrace on the left, narrow door. |
| `prop-town-townhouse.png` | `townhouse` | 2 x 4 | 2 x 2 | Three storeys, stone ground floor, timber above. Narrow — the building to line a street with. |
| `prop-town-cottage.png` | `cottage` | 3 x 3 | 3 x 2 | Compact, steep hip roof, central chimney, dormer. **No door on the front** — this is scenery you look at, not enter. Filler. |

### Market stalls

| File | Kind | Tiles | Blocks | What it is |
| --- | --- | --- | --- | --- |
| `prop-town-stall-red.png` | `stallRed` | 3 x 2 | 3 x 1 | Scalloped dark-red awning on posts, counter and a crate beneath. |
| `prop-town-stall-grey.png` | `stallGrey` | 3 x 2 | 3 x 1 | Same frame, grey canvas. Ship both so a market row isn't one colour repeated. |
| `prop-town-stall-open.png` | `stallOpen` | 3 x 2 | 3 x 1 | Flat red roof, open trestle table, no canvas. |

Stalls block **one** row, not two, and that is the point: the back row stays
walkable so a vendor NPC can stand behind the counter while the player is
stopped in front of it. Everything between the posts is transparent, so terrain
shows through — put them on a paved square, not on the seam between two
textures.

### Windmills

| File | Kind | Tiles | Blocks | What it is |
| --- | --- | --- | --- | --- |
| `prop-town-windmill-cloth.png` | `windmillCloth` | 6 x 6 | 6 x 2 | Four sails dressed with pale canvas over a tapered tower on a stone base. |
| `prop-town-windmill-lattice.png` | `windmillLattice` | 6 x 6 | 6 x 2 | Same mill, bare lattice sails. |

**These are not the Gallows Coast windmill.** That one is `prop-windmill.png`,
5 x 5, from the earlier downscaled set. These are 6 x 6 and a different family.

Read the block column carefully here. The mill itself is only about three tiles
wide — measured, the bottom row of art is empty in column 0 and columns 4-5,
and solid in columns 2-3. Sealing 6 x 2 therefore walls off roughly three tiles
of bare ground either side. That is what the existing 5 x 5 windmill already
does on purpose ("the windmill seals its full five and you cannot duck beneath
its sails") and matching it is one line instead of a special case — but it means
a windmill needs its whole 6 x 6 plot clear. Put them outside the walls where
that costs nothing. If a tight map ever needs the real silhouette, paint the
base with a `solids` glyph instead and give the mill `BLOCK` of 6 x 1.

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

Thirty kinds is a lot to add at once. Add the ones a map actually places; an
unused `SceneryKind` is a name in five records that nothing renders.

## Placing them on a map

- The glyph is top-left, so a 6 x 2 guildhall placed at `(x, y)` eats columns
  `x..x+5` and rows `y..y+1`. Leave the row below it walkable or the door is
  unreachable.
- Two buildings may not overlap footprints, and the smoke suite checks
  pathfinding, not coordinates — if a placement walls a town off, the tests say
  so.
- Buildings three or more tiles deep leave the top rows as overhang: the player
  walks behind the roof there and the y-sort hides him. Buildings two tiles deep
  (`market`, `guildhall`, `shoprow`, `storefront`, `shophouse`, `shrine`) have
  no overhang to give and are solid throughout.
- Don't crowd the doors. Almost every one of these has its entrance on the
  bottom row, centred or near it, and an NPC standing on the doorstep is the
  point of the building. The exception is `cottage`, which has no door at all.

## Two notes on how they look

- **No ground shadow, and that is the decision.** The Gallows Coast props carry
  a soft elliptical shadow baked in during their cut, and `artShadow` is a no-op
  once prop art has loaded (`src/main.ts`), so nothing is drawn under these.
  Composited onto the town terrain they do not float: every one is a flat
  elevation with a hard dark outline along its bottom edge, and that outline
  seats it. A soft ellipse under crisp pixel art would read worse than nothing.
  If some future terrain proves otherwise, bake it into the PNG then — it is a
  one-pass job on files that are already at final size.
- **Palette.** These are native pixel art at final size — no downscale, no
  requantisation — so they are cleaner and slightly more saturated than
  `prop-house-a.png` and its neighbours, which were 480 px illustrations shrunk
  to fit. They are also drawn at a finer scale: a 4 x 5 Gallows Coast house has
  chunkier detail than a 4 x 3 building here. Standing side by side in one town
  that difference is visible. Keep the two families in different settlements.
