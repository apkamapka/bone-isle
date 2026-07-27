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

## Bandit — `public/mob-bandit.png`, `public/mob-bandit-walk.png`, `public/mob-bandit-dead.png`

The bandit is composed from the same **Universal LPC Spritesheet Character
Generator** as the player, under the same licences as the layers listed above.

Reproducible character configuration:

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&nose=Big_nose_light&hair=Spiked_dark_brown&hat=Tricorne_Lieutenant_brown&hat_trim=Tricorne_Stitching_blue&gloves=Gloves_ceramic&sleeves=Longsleeves_2_Overlay_gray&jacket=Frock_coat_black&legs=Formal_Pants_gray&shoes=Basic_Shoes_gray>

Beyond the collections listed under the player, this character also draws on
the hat, coat, gloves and formal-trouser layers of the ULPC project; the
generator's own credits export is authoritative for the per-layer author list.

From the generator's full export only the walk block was kept — rows 8-11
(up, left, down, right), nine frames each — repacked into a 9x4 grid and
cropped to one rectangle shared by every frame (see `src/gfx/mobSheet.ts`).
`mob-bandit.png` is the standing pose from that same grid, and
`mob-bandit-dead.png` is the last frame of the hurt row (row 20, column 6),
cropped to the body.

**ShareAlike:** these three files are derivative works of CC-BY-SA 3.0 artwork
and are themselves published under **CC-BY-SA 3.0**. They must stay publicly
available on those terms even if this repository is later made private.

## Minotaurs — `public/mob-minotaur-walk.png`, `public/mob-minotaur-archer-walk.png`, `public/mob-minotaur-guard-walk.png`, `public/mob-minotaur-mage-walk.png`, `public/mob-minotaur-dead.png`

All four minotaur ranks are composed from the same **Universal LPC Spritesheet
Character Generator** as the player and the bandit, under the same licences as
the layers listed above. They share one body (`muscular`, fur tan) and one head
(`Minotaur_fur_tan`); only the gear differs.

Reproducible character configurations:

- Minotaur —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=muscular&body=Body_Color_fur_tan&head=Minotaur_fur_tan&expression=Neutral_fur_tan&gloves=Gloves_iron&legs=Wide_pants_black>
- Minotaur Archer —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=muscular&body=Body_Color_fur_tan&head=Minotaur_fur_tan&expression=Neutral_fur_tan&weapon=Crossbow_crossbow&gloves=Gloves_iron&legs=Wide_pants_black>
- Minotaur Guard —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=muscular&body=Body_Color_fur_tan&head=Minotaur_fur_tan&expression=Neutral_fur_tan&gloves=Gloves_iron&legs=Wide_pants_black&weapon=Saber_saber&shield=Scutum_shield_scutum>
- Minotaur Mage —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=muscular&body=Body_Color_fur_tan&head=Minotaur_fur_tan&expression=Neutral_fur_tan&gloves=Gloves_iron&legs=Wide_pants_black&weapon=S_staff_iron&cape=Tattered_teal>

Beyond the collections listed under the player, these characters draw on the
minotaur head, the muscular body base, and the iron-glove, wide-trouser, saber,
crossbow, iron-staff, scutum-shield and tattered-cape layers of the ULPC
project; the generator's own credits export is authoritative for the per-layer
author list.

From each generator export only the walk block was kept — rows 8-11
(up, left, down, right), nine frames each — repacked into a 9x4 grid and
cropped to one rectangle shared by every frame, symmetric about the source
cell's centre line (see `src/gfx/mobSheet.ts`). No pixel was repainted.

`public/mob-minotaur-dead.png` is the last frame of the hurt row (row 20,
column 6) of the plain minotaur export, cropped to the body. All four ranks
share it: the archer's, guard's and mage's own death frames leave their gear
lying beside the corpse, which reads as loot the game will not let you take.

**ShareAlike:** these five files are derivative works of CC-BY-SA 3.0 artwork
and are themselves published under **CC-BY-SA 3.0**. They must stay publicly
available on those terms even if this repository is later made private.

## Borin the Smith — `public/npc-smith.png`

The town smith is composed from the same **Universal LPC Spritesheet Character
Generator** as the player and the bandit, under the same licences as the layers
listed above.

Reproducible character configuration:

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&beard=Medium_Beard_black&mustache=Mustache_black&hair=Bangs_black&shoulders=Epaulets_red&gloves=Gloves_brass&armour=Leather_red&legs=Armour_brass&shoes=Armour_brass&weapon=Mace_mace>

Beyond the collections listed under the player, this character also draws on the
beard, moustache, epaulet, brass-armour and mace layers of the ULPC project; the
generator's own credits export is authoritative for the per-layer author list.

Packed exactly like the bandit: only the walk block was kept — rows 8-11
(up, left, down, right), nine frames each — repacked into a 9x4 grid and cropped
to one rectangle shared by every frame, here 52x51 px. Column 0 of each row is
the standing pose the NPC shows while talking to you.

> **TODO before release:** download "Credits (CSV)" from the generator for this
> configuration and paste the per-layer author list here. The URL above
> reproduces the character, but a URL is not an attribution.

**ShareAlike:** this file is a derivative work of CC-BY-SA 3.0 artwork and is
itself published under **CC-BY-SA 3.0**. It must stay publicly available on
those terms even if this repository is later made private.

## The other four townsfolk

`public/npc-herbalist.png`, `npc-elder.png`, `npc-taskmaster.png` and
`npc-tailor.png` come from the same **Universal LPC Spritesheet Character
Generator** under the same licences, and are packed identically to the smith:
walk rows 8-11 only, repacked into a 9x4 grid, cropped to one rectangle shared
by every frame of that sheet. Column 0 of each row is the standing pose.

Frame sizes differ because the outfits do — 34x51 for Mira, 34x50 for Oswin,
34x55 for Grizelda (cape and topknot), 32x51 for Vesper.

Reproducible character configurations:

- Mira the Herbalist —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=female&body=Body_Color_olive&head=Human_Male_olive&expression=Neutral_olive&neck=Scarf_brown&gloves=Gloves_cloth.gray&clothes=Tunic_slate&shoes=Sandals_gray&legs=Belle_skirt_green&ring=Stud_Ring_green&hair=Long_messy_light_brown>
- Elder Oswin —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Pixie_platinum&ring=Stud_Ring_sky&legs=Long_Pants_sky&shoes=Basic_Shoes_sky&jacket=Tabard_sky&headcover=Thick_Headband_sky&necklace=Necklace_gold>
- Grizelda the Huntress —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&bandana_overlay=Skull_Bandana_Overlay_green&hair=Long_Topknot_red&ring=Stud_Ring_red&gloves=Gloves_cloth.green&cape=Solid_forest&armour=Legion_all.lpcr.peach&legs=Armour_all.lpcr.peach&shoes=Armour_all.lpcr.ivory>
- Vesper the Tailor —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Messy1_gray&jacket=Frock_coat_blue&legs=Leggings_navy&shoes=Sara_Shoes_navy>

Between them these four add the scarf, tunic, belle-skirt, sandal, tabard,
headband, necklace, bandana-overlay, topknot, cape, Legion-armour, frock-coat,
leggings and stud-ring layers of the ULPC project to the collections already
listed above.

> **TODO before release:** download "Credits (CSV)" from the generator for each
> of these five configurations and paste the per-layer author lists here. The
> URLs reproduce the characters, but a URL is not an attribution.

**ShareAlike:** all four files are derivative works of CC-BY-SA 3.0 artwork and
are themselves published under **CC-BY-SA 3.0**. They must stay publicly
available on those terms even if this repository is later made private.

## Chronos the Time Sage

`public/npc-timesage.png` comes from the same **Universal LPC Spritesheet
Character Generator** under the same licences, packed the same way: walk rows
8-11 only, repacked into a 9x4 grid, cropped to one 38x58 rectangle shared by
every frame. Column 0 of each row is the standing pose. He appears twice in the
game — pacing the western plaza in Bonetown and rooted in his cellar — from
this single sheet.

Reproducible character configuration:

- Chronos the Time Sage —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_Elderly_light&expression=Neutral_light&beard=Winter_Beard_white&mustache=French_Mustache_white&hair=Long_messy2_white&hat=Celestial_Wizard_Moon_Hat_slate&earrings=Moon_earrings_steel&cape=Tattered_all.lpcr.ice&belt=Robe_Belt_white&clothes=Cardigan_all.lpcr.ice&legs=Long_Pants_all.lpcr.ice&shoes=Sandals_all.lpcr.ice&weapon=Diamond_staff_silver&eyes=Eye_Color_purple>

He adds the elderly-male head, winter beard, French moustache, celestial wizard
hat, moon earrings, tattered cape, robe belt, cardigan and diamond staff layers
of the ULPC project to the collections already listed above.

> **TODO before release:** download "Credits (CSV)" from the generator for this
> configuration and paste the per-layer author list here. The URL reproduces the
> character, but a URL is not an attribution.

**ShareAlike:** this file is a derivative work of CC-BY-SA 3.0 artwork and is
itself published under **CC-BY-SA 3.0**. It must stay publicly available on
those terms even if this repository is later made private.

## Terrain and props

`public/home-terrain.png`, `public/town-terrain.png` and
`public/cellar-terrain.png` are exported from Tiled
maps painted with commercially licensed tile packs. The pack licence permits
commercial use and modification, forbids redistributing the assets themselves
(original or modified) and forbids their use in a logo or trademark.

> **TODO before release:** record each pack's name, version, source URL and
> purchase date here. The licence text is identical for both the free and the
> paid pack, but the packs must still be named.

`public/prop-tree.png`, `prop-rock.png`, `prop-stump.png` and `prop-rubble.png`
were drawn from scratch for this game in the palette of those packs. They
contain no third-party pixels and carry no external obligations.

## Everything else

All remaining artwork is procedural — baked at runtime from character maps in
`src/gfx/sprites.ts` and `src/gfx/adventurer.ts`, with no external files. The
baked sprites also remain the fallback for every PNG above: if an image fails
to load, the game draws its procedural stand-in instead.
