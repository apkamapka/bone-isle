# Credits

## Player character — `public/hero-*.png` (layered)

The player sprite is composed from the **Universal LPC Spritesheet Character
Generator** and trimmed to just the frames the game uses.

Reproducible character configuration (open in the generator to get the exact
same character):

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Plain_white&clothes=Shortsleeve_gray&legs=Long_Pants_gray&shoes=Basic_Shoes_black>

The generator's full export was repacked into a 9x5 grid of 64px cells
(see `src/gfx/heroSheet.ts`): the walk cycle for four facings, a two-frame
idle for four facings, and the last frame of the death animation used as the
on-ground corpse.

To let the in-game Wardrobe recolor the hero, the character is kept as separate
layers: `hero-base.png` (body + head + eyes, never dyed) plus grayscale
`hero-hair.png`, `hero-shirt.png`, `hero-pants.png` and `hero-shoes.png`, which
are tinted and composited at runtime. (The earlier single `public/hero.png` is
no longer used and may be deleted.) The attribution below covers exactly these
layers.

### Licence: OGA-BY 3.0

Every layer in this character is multi-licensed. Six of the seven layers offer
**OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0**; the **Long Pants** layer offers only
**OGA-BY 3.0 / GPL 3.0** (no CC-BY-SA). The single licence available for *every*
layer is **OGA-BY 3.0**, so the combined sheet — a derivative work — is
distributed under **OGA-BY 3.0**. Licence notice with links: `OGA-BY-3.0.txt`
in this repo; authoritative full text:
<https://static.opengameart.org/OGA-BY-3.0.txt> (FAQ:
<https://opengameart.org/content/oga-by-30-faq>).

OGA-BY 3.0 is CC-BY 3.0 with the anti-DRM clause removed. Practically:

- **Attribution is mandatory** — every artist listed below must be credited
  wherever the sheet is distributed, and this file must stay reachable from
  inside the game (the in-game Credits screen, plus this file in the repo).
- **No share-alike** — unlike CC-BY-SA, derivatives are not forced to stay
  under the same licence.
- **No anti-DRM clause** — safe for a future release on stores that mandate DRM
  (iOS App Store, consoles), where CC-BY-SA / CC-BY / GPL art would be a problem.

Attribution follows OpenGameArt's recommended form:
*"[Title]" by [authors], licensed OGA-BY 3.0, hosted by OpenGameArt.org.*

### Artists, per layer

**Base body — "Body Color" (male)**
bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert,
Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani,
Johannes Sjolund (wulax), Stephen Challener (Redshrike)
— OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0

**Head — "Human Male"**
bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike)
— OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0

**Expression — "Neutral"**
JaidynReiman, Eliza Wyatt (ElizaWy), Stephen Challener (Redshrike)
— OGA-BY 3.0

**Hair — "Plain"**
JaidynReiman, Manuel Riecke (MrBeast), Joe White
— OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0

**Shirt — "Shortsleeve" (male)**
bluecarrot16, Eliza Wyatt (ElizaWy), JaidynReiman,
Stephen Challener (Redshrike)
— OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0

**Legs — "Long Pants"**
JaidynReiman, Eliza Wyatt (ElizaWy), bluecarrot16, Johannes Sjolund (wulax),
Stephen Challener (Redshrike)
— OGA-BY 3.0 / GPL 3.0

**Shoes — "Basic Shoes"**
JaidynReiman, bluecarrot16, Johannes Sjolund (wulax)
— OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0

### Sources

All layers were authored for the Liberated Pixel Cup / Universal LPC project and
are hosted on OpenGameArt.org. Primary collections these layers draw from:

- LPC Base Assets — <https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles>
- LPC Medieval Fantasy Character Sprites — <https://opengameart.org/content/lpc-medieval-fantasy-character-sprites>
- LPC Character Bases — <https://opengameart.org/content/lpc-character-bases>
- LPC Revised Character Basics — <https://opengameart.org/content/lpc-revised-character-basics>
- ULPC Expanded Expressions — <https://opengameart.org/content/ulpc-expanded-expressions>
- Ponytail and Plain Hairstyles — <https://opengameart.org/content/ponytail-and-plain-hairstyles>
- LPC Expanded Hair — <https://opengameart.org/content/lpc-expanded-hair>
- LPC Expanded Simple Shirts — <https://opengameart.org/content/lpc-expanded-simple-shirts>
- LPC Expanded Pants — <https://opengameart.org/content/lpc-expanded-pants>
- LPC Expanded Socks & Shoes — <https://opengameart.org/content/lpc-expanded-socks-shoes>

## Everything else

All other artwork in this game is procedural — baked at runtime from character
maps in `src/gfx/sprites.ts` and `src/gfx/adventurer.ts`. No external files.
