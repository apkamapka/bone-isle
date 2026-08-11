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

## Skeleton, goblin, ghoul and the five orc ranks

`public/mob-skeleton-walk.png`, `mob-goblin-walk.png`, `mob-ghoul-walk.png`,
`mob-orc-walk.png`, `mob-orc-warrior-walk.png`, `mob-orc-berserker-walk.png`,
`mob-orc-archer-walk.png`, `mob-orc-shaman-walk.png`, plus the bodies
`mob-skeleton-dead.png`, `mob-goblin-dead.png`, `mob-ghoul-dead.png` and
`mob-orc-dead.png`.

All eight are composed from the same **Universal LPC Spritesheet Character
Generator** as the player, the bandit and the minotaurs, under the same licences
as the layers listed above. The five orc ranks share one body base
(`Body_Color_dark_green`) and one head (`Orc_male_dark_green`); only the gear
differs.

Reproducible character configurations:

- Skeleton —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Skeleton_skeleton&head=Skeleton_skeleton&expression=Neutral_light>
- Goblin —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_pale_green&head=Goblin_pale_green&expression=Neutral_pale_green&legs=Shorts_black>
- Ghoul —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_zombie&head=Zombie_zombie&expression=Neutral_zombie&legs=Shorts_slate>
- Orc —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_dark_green&head=Orc_male_dark_green&expression=Neutral_dark_green&shoulders=Legion_iron&legs=Shorts_black>
- Orc Warrior —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_dark_green&head=Orc_male_dark_green&expression=Neutral_dark_green&shoulders=Legion_iron&legs=Armour_iron&arms=Armour_iron&gloves=Gloves_iron&shoes=Armour_iron&weapon=Dagger_dagger>
- Orc Berserker —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_dark_green&head=Orc_male_dark_green&expression=Neutral_dark_green&legs=Shorts_orange&arms=Armour_iron&gloves=Gloves_copper&shoes=Armour_copper&weapon=Mace_mace&armour=Plate_copper&shoulders=Epaulets_orange>
- Orc Archer —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_dark_green&head=Orc_male_dark_green&expression=Neutral_dark_green&legs=Shorts_forest&gloves=Gloves_steel&shoes=Armour_steel&shoulders=Epaulets_forest&weapon=Crossbow_crossbow>
- Orc Shaman —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_dark_green&head=Orc_male_dark_green&expression=Neutral_dark_green&weapon=Gnarled_staff_bronze&shoes=Sandals_tan&legs=Legion_skirt_tan&cape=Tattered_orange&earrings=Moon_earrings_copper>

Beyond the collections listed under the player, these characters draw on the
skeleton, goblin, zombie and orc bases and heads, and on the shorts, legion
shoulder, iron/copper/steel armour, dagger, mace, crossbow, gnarled-staff,
legion-skirt, sandal, tattered-cape and moon-earring layers of the ULPC project;
the generator's own credits export is authoritative for the per-layer author
list.

From each export only the walk block was kept — rows 8-11 (up, left, down,
right), nine frames each — repacked into a 9x4 grid and cropped to one rectangle
shared by every frame, symmetric about the source cell's centre line (see
`src/gfx/mobSheet.ts`). No pixel was repainted. Frame sizes: 32x47 skeleton,
32x49 goblin, 32x48 ghoul, 32x46 orc, 40x47 warrior, 52x47 berserker (the mace
held out sideways, the widest sprite in the game until the demon skeleton's
wings arrived), 44x47 archer, 38x46 shaman.

The bodies are the last frame of the hurt row (row 20, column 6) of each export,
cropped to the body. All five orc ranks share `mob-orc-dead.png`, taken from the
bare orc: the geared ranks' own death frames leave the dagger, mace, crossbow
and staff lying beside the corpse, which reads as loot the game will not let you
take, and stretches the archer's body to 60px against the bare corpse's 40px.

> **TODO before release:** download "Credits (CSV)" from the generator for each
> of these eight configurations and paste the per-layer author lists here. The
> URLs reproduce the characters, but a URL is not an attribution.

**ShareAlike:** these twelve files are derivative works of CC-BY-SA 3.0 artwork
and are themselves published under **CC-BY-SA 3.0**. They must stay publicly
available on those terms even if this repository is later made private.

## Skeleton Warrior and Demon Skeleton

`public/mob-skeleton-warrior-walk.png`, `public/mob-demon-skeleton-walk.png`.
Neither has a body file of its own — both reuse `public/mob-skeleton-dead.png`,
credited in the section above.

Both are composed from the same **Universal LPC Spritesheet Character
Generator** as everything above, under the same licences as the layers listed
under the player. They share the plain skeleton's body and head
(`Skeleton_skeleton`) with the skeleton already in the game, so the three read
as one family; only the gear and the wings differ.

Reproducible character configurations:

- Skeleton Warrior —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Skeleton_skeleton&head=Skeleton_skeleton&expression=Neutral_light&hat=Barbarian_steel&gloves=Gloves_steel&legs=Armour_steel&weapon=Dagger_dagger>
- Demon Skeleton —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&head=Skeleton_skeleton&expression=Neutral_all.lpcr.red&gloves=Gloves_steel&legs=Armour_steel&body=Skeleton_skeleton&wings=Bat_Wings_fur_white&shoulders=Epaulets_gray>

Beyond the collections listed under the player, these two draw on the skeleton
base and head and on the barbarian-helm, steel-glove, steel-legplate, dagger,
grey-epaulet and bat-wing layers of the ULPC project; the generator's own
credits export is authoritative for the per-layer author list.

From each export only the walk block was kept — rows 8-11 (up, left, down,
right), nine frames each — repacked into a 9x4 grid and cropped to one rectangle
shared by every frame, symmetric about the source cell's centre line (see
`src/gfx/mobSheet.ts`). No pixel was repainted. Frame sizes: 40x49 warrior,
64x49 demon. The demon is the widest creature in the game and by some margin:
its spread wings fill the source cell edge to edge, so the crop could not be
narrowed without clipping them.

> **TODO before release:** download "Credits (CSV)" from the generator for both
> configurations and paste the per-layer author lists here. The URLs reproduce
> the characters, but a URL is not an attribution.

**ShareAlike:** both files are derivative works of CC-BY-SA 3.0 artwork and are
themselves published under **CC-BY-SA 3.0**. They must stay publicly available
on those terms even if this repository is later made private.

## Snake — `public/mob-snake-walk.png`, `public/mob-snake-dead.png`

The snake is **not** an LPC asset. It comes from the "Snake Sprites" pack by
**carysaurus**: <https://carysaurus.itch.io/snake-sprites>

### Licence: pack terms, attribution required

Verbatim from the pack: *"This asset pack can be used in both free and
commercial projects; you cannot redistribute or resell these assets. Credit must
be given."*

Three consequences worth spelling out, because they run the opposite way to the
LPC art above:

- **Attribution is mandatory** — carysaurus must be credited in this file and on
  the in-game Credits screen.
- **No redistribution.** Shipping the sprite inside a running game is ordinary
  licensed use; publishing the sheet as a standalone file where anyone can take
  it is not. That makes a *public* source repository the exposure, not the
  deployed game. This repo is to go private before commercial release.
- **No share-alike.** Unlike the LPC art, nothing here has to stay openly
  available, and nothing may.

### What was changed

Only the green snake of the six in the pack is used, and only its walk strip
(`SnakeGreen-Walk.png`, 224x32 — seven 32px frames in a single row).

The pack's four-colour palette was swapped for a cooler, deeper green so the
creature reads as its own animal rather than as the pack's stock sprite:
outline `#101c14`, body `#4f9e5a`, underside `#2f6b3c`, back `#1d3d26`. No
shape was altered — this is a palette substitution, pixel for pixel.

The strip was repacked into a 7x4 grid cropped to one 32x21 rectangle shared by
every frame. The pack contains a side view and nothing else, so row 3 (right) is
the source, row 1 (left) is its mirror, and rows 0 and 2 (up, down) carry the
side view too — a monster spawns facing "down" before it has taken a step. In
play a snake turns only on horizontal movement and holds its facing through a
vertical one, so a pose that was never drawn is never shown (`SIDE_ONLY` in
`src/gfx/mobSheet.ts`).

`mob-snake-dead.png` (30x7) is **original artwork drawn for this game**, not
part of the pack: the pack ships no death frame. It is a slack, uncoiled body in
the same four-colour palette, with a dark back, a lit flank, a pale underside, a
dead eye marked in outline and a lolling tongue. It contains no pixels from the
pack and carries no external obligation, but it is a recognisable derivative of
the pack's creature and should be treated as covered by the same terms.

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

`public/home-terrain.png`, `public/town-terrain.png`, `public/cellar-terrain.png`,
`public/reach-terrain.png`, `public/orcdeep-terrain.png` and
`public/minodeep-terrain.png` are exported from Tiled maps painted with tile
packs by **Szadi art.** (szadiart), some bought and some taken from his free
demo packs:

<https://szadiart.itch.io/>

### Licence: Szadi art., one licence covering everything he publishes

The terms are posted on his profile page and are stated to govern all of his
assets, so the demo packs and the paid ones sit under the same rules. In
summary: the art may be edited, cut and modified for commercial purposes; work
made with it — games, animations, film — may be sold; and it may be published
on sites concerned with graphics and games. Two things are ruled out: using it
in a logo, trademark or service mark, and reselling it, whole or in part,
original or modified. He asks for no credit, though he appreciates it.

> **Correction.** An earlier version of this file summarised these terms as
> forbidding *redistribution* of the assets. That was stricter than what the
> licence actually says: the prohibition is on **reselling**, and publishing on
> game-related sites is expressly allowed. A public source repository is
> neither a resale nor a logo, so the terrain exports are not the problem this
> file previously implied they were. Reselling remains firmly out.

> **TODO before release:** name the individual packs. The licence question is
> settled; what is still missing is the inventory — which of Szadi's packs each
> map is painted with, paid or demo, and the purchase dates for the paid ones.
> The Tiled project for the Bone Reach references `Water_tafle_4A`,
> `32x32_DEMO`, `MainLev2.0`, `namiot`, `floor_and_deoratives` and `kosci`;
> the filenames alone do not say which storefront pack each came from, and
> whether every one of them is Szadi's has not been confirmed.

`public/prop-tree.png`, `prop-rock.png`, `prop-stump.png`, `prop-rubble.png`,
`prop-tree-dead.png` and `prop-tree-felled.png` were drawn from scratch for
this game in the palette of those packs. They contain no third-party pixels
and carry no external obligations.

The two dead trees are deliberately built to the same rules as the live tree
and the stump, both of which turned out to be clean 2x upscales of
half-resolution art: they are authored on a 26 x 40 logical grid and doubled,
they reuse the live tree's four-step bark ramp and its ground shadow (black at
alpha 77) without adding a single new colour, and they follow its lighting
convention of mid brown on the left edge, highlight inside, dark brown on the
right. `prop-tree-felled.png` is the same trunk and root flare as
`prop-tree-dead.png` taken off above the lower branch stub, capped with the
ringed end grain that `prop-stump.png` uses, so the pair reads as one tree
before and after the axe. Both are padded so the base of the trunk sits under
the centre of the image, which is where `drawSprite()` anchors.

## Chests — `public/prop-chest-red.png`, `prop-chest-purple.png`, `prop-chest-wood.png`

Cut from **Fantasy RPG Chests 32 x 32 px for RPG Maker** ("Fantasy RPG (Toony)
32x32.png") by **Francisco Téllez (franjatesa)**, a name-your-own-price asset
pack of eight animated chests:

<https://franjatesa.itch.io/free-rpgmaker-chests>

### Licence: author's own terms — attribution to `franjatesa`

The pack ships no separate licence file; the terms are stated on the download
page and permit use in any project, including commercial ones, on the single
condition that the author is credited as **franjatesa**. There is no
ShareAlike obligation and no anti-DRM clause, so unlike the LPC artwork above
these three files stay usable on storefronts that wrap the build in mandatory
DRM (iOS, consoles), and they place no licence requirement on this repository
or on the game's source.

The terms do not grant permission to redistribute the pack itself, so the
original sheet is deliberately **not** committed here — only the three single
frames the game draws.

### What was taken and how it was changed

The sheet uses the RPG Maker character layout: 12 x 8 cells of 32 px, read as
four chests per half, each chest occupying four consecutive rows. The three
identical columns in every group are the walk cycle, which a chest has no use
for; the four rows are the opening animation, frame 1 being the closed chest.

| File | Source cell (row, column) | Frame | Size after trim |
| --- | --- | --- | --- |
| `prop-chest-red.png` | row 1, column 2 | closed | 28 x 25 |
| `prop-chest-purple.png` | row 5, column 2 | closed | 28 x 21 |
| `prop-chest-wood.png` | row 5, column 5 | closed | 28 x 24 |

Each file is one 32 px cell trimmed to its opaque bounding box. The trim is
symmetric — two transparent columns fell away on each side — so the artwork
stays horizontally centred for `drawSprite()`, which anchors bottom-centre.
No pixel was recoloured, rescaled or redrawn. The remaining three frames of
each opening animation are still available in the source pack if the chests
are ever animated.

## Campfire — `public/prop-campfire.png`

Twelve 32 x 32 frames in one 384 x 32 strip, packed here from the twelve
separate PNGs of **Fire Animation** by **NYKNCK**, bought by the project owner
from itch.io:

<https://nyknck.itch.io/fire-animation>

### Licence: purchased asset, no published terms

The store page carries no licence text — it states what the pack contains and
what it costs, and nothing about attribution, commercial use or
redistribution. So no credit is contractually owed here; this entry exists as
the project's own record of where the art came from and on what footing.

> **Open question before release:** because the pack ships no terms, there is
> also no written permission to redistribute the frames. This repository is
> public and serves the PNG unencrypted, which is redistribution in every
> sense that matters. Two things settle it: whether
> `fire_animation_nyknck.zip` contains a readme or licence file, and failing
> that, one line in writing from the artist. The purchase receipt is the only
> proof of licence that exists — keep it.

### What was changed

The source files are 512 x 512 but are a clean 16x nearest-neighbour upscale
of 32 x 32 art, verified block by block, so they were taken back down to their
native 32 x 32 rather than being resampled. Beyond that the pack was shifted
one pixel right — as a whole, so the frames stay registered to each other —
because the logs sat a pixel left of the cell centre and `drawSprite()`
anchors bottom-centre. No pixel was recoloured or redrawn; the pack's six
colours are intact and its frame order is untouched.

The twelve frames are drawn as a loop: the jump from the last frame back to
the first is no larger than any step inside the cycle, so they play straight
through with no seam to hide.

## Skull totem — `public/prop-skullpole.png`

The drawn version of `SPR.skullPole`, the baked pole the wilderness camps
already plant. Supplied by the project owner as a 32 x 64 file (`totem-czaszka
.png`, the same name as a tileset in the island's Tiled project) and trimmed
here to its opaque bounds, 22 x 49, with the base centred under the image so
`drawSprite()` plants it on the tile it owns. Native resolution, 30 colours,
no pixel changed.

At 49 px it is a tile and a half tall, which is the point: it owns one solid
tile and overhangs the one above, so the depth-sorted draw list puts it in
front of anyone standing north of it.

> **TODO before release:** record the author, pack and licence. Like the first
> campfire, this arrived without provenance, so it is the one asset in the repo
> whose terms are unknown.

## The Bone Reach terrain — `public/reach-terrain.png`

A 3200 x 3200 export of `mapa_srednia.tmx`, the project owner's own Tiled
composition of the island behind the Time Sage's fourth pad. The layout is his
work; the tiles it is painted with are credited below.

The file is committed exactly as exported; nothing was resampled or recoloured.
Its dimensions are load-bearing — `terrainImage.ts` drops any export that is
not exactly the grid size in tiles times 32, and falls back to the procedural
bake.

### Tilesets

The Tiled project references `Water_tafle_4A`, `32x32_DEMO`, `MainLev2.0`,
`namiot`, `floor_and_deoratives` and `kosci`. `32x32_DEMO` is one of **Szadi
art.**'s demo packs, covered by the licence recorded under "Terrain and props"
above — which permits exactly this: modified tiles composed into a commercial
game and published on a game-related site. The remaining five still need
pinning to specific packs.

## The floors under the Bone Reach — `public/orcdeep-terrain.png`, `public/minodeep-terrain.png`

A 1280 x 1600 export of `-1_orki_srednia_mapa.tmx` and a 1920 x 1600 export of
`-1_minotaury_srednia_mapa.tmx` — the project owner's own Tiled compositions of
the pit under the Bone Reach's southern descent and the labyrinth under its
western one. The layouts are his work; the tiles they are painted with are
credited below.

The file is committed exactly as exported; nothing was resampled or recoloured.
As with every other export, its dimensions are load-bearing — `terrainImage.ts`
drops anything that is not exactly the grid size in tiles times 32.

### Tilesets

Both Tiled projects reference a single tileset, `MainLev2.0hhh` — a variant of
the `MainLev2.0` pack already recorded under "Terrain and props" above, by
**Szadi art.** (szadiart). The exact pack this variant was cut from still needs
pinning, same as the other five listed for the Bone Reach.

## Bone Reach objects — `prop-tent.png`, `prop-well.png`, `prop-boulder-a.png`, `prop-boulder-b.png`

Cut from the same **Szadi art.** sheets the island's terrain is painted with,
under the licence recorded above, which permits cutting and modifying the art
for commercial use.

| File | Source sheet | Size | Footprint |
| --- | --- | --- | --- |
| `prop-tent.png` | `namiot.png` | 53 x 59 | 2 x 2 |
| `prop-well.png` | `floor_and_deoratives.png` | 52 x 48 | 2 x 2 |
| `prop-boulder-a.png` | `32x32_DEMO.png` | 60 x 44 | 2 x 1 |
| `prop-boulder-b.png` | `32x32_DEMO.png` | 60 x 44 | 2 x 1 |

Each was lifted as a single connected component rather than as a rectangle, so
no fragment of a neighbouring object on the sheet came with it, and each was
trimmed to its own bounds. No pixel was recoloured or rescaled.

The two boulders are the same size and carry the same colours in the same
proportions, which is why they look like one sprite stamped twice; they are
not. They differ on 1528 pixels, so both were taken and the island alternates
between them.

These are drawn as scenery rather than baked into the terrain export: they
stand taller than the square they occupy, and the player has to be able to walk
behind them.

## Home Isle buildings — `public/build-*.png`

> **TODO before this repo goes public / before release: fill in the source and
> licence below.** Nothing else in this file is unresolved. If these came from
> **CraftPix**, the files must NOT be committed while the repository is public —
> the subscription licence forbids redistributing the source files, and a public
> repo is redistribution. If they are **PixelLab** generations they are yours
> outright and only need naming here.

| File | Structure | Tier | Size | Footprint |
| --- | --- | --- | --- | --- |
| `build-forge-1.png` | Forge | I — timber | 96 x 96 | 2 x 2 |
| `build-forge-2.png` | Forge | II — stone | 96 x 96 | 2 x 2 |
| `build-forge-3.png` | Forge | III — steel | 96 x 96 | 2 x 2 |
| `build-tower-1.png` | Alchemy Tower | I — timber | 64 x 96 | 2 x 2 |
| `build-tower-2.png` | Alchemy Tower | II — stone | 64 x 96 | 2 x 2 |
| `build-tower-3.png` | Alchemy Tower | III — amber | 64 x 96 | 2 x 2 |
| `build-dummy-1.png` | Training Dummy | I | 128 x 128 (4 x 4 cells) | 1 x 1 |
| `build-dummy-2.png` | Training Dummy | II | 128 x 128 (4 x 4 cells) | 1 x 1 |
| `build-dummy-3.png` | Training Dummy | III | 128 x 128 (4 x 4 cells) | 1 x 1 |
| `build-range.png` | Archery Range | (single tier) | 32 x 32 | 1 x 1 |
| `build-chest-1.png` | Storage Chest | I | 64 x 64 | 2 x 2 |
| `build-chest-2.png` | Storage Chest | II | 64 x 64 | 2 x 2 |
| `build-chest-3.png` | Storage Chest | III | 64 x 64 | 2 x 2 |

Authored at world scale — TILE (32) px per tile — anchored bottom-centre, with
no painted ground shadow (the renderer draws its own, sized off the footprint
rather than the sprite: a two-tile forge is three tiles of roof, and a shadow
as wide as the roof would put the whole pad in shade).

The stills ship exactly as they were drawn. The three training-post sheets are
the one exception: the generator placed the fourth facing seven pixels left of
the other three, which slid the plinth sideways whenever the post changed which
way it leaned. Each row was shifted so its plinth centres on the cell, and the
whole sheet moved two pixels down so the plinth meets the edge the renderer
anchors to. No pixel was recoloured, rescaled or redrawn.

The post's sheet is four facings down the rows — north, east, west, south — by
four frames across: column 0 is the rest pose, columns 1-3 are the lean. It is
the only building that animates, and it plays once per blow rather than looping;
see `src/gfx/buildingArt.ts`.

The forge and the tower are stills that the renderer animates on top of:
firelight and embers in the hearth, smoke off the flue, and motes lifting from
the basin in that tier's colour. Those effects are code, not artwork
(`src/gfx/buildingFx.ts`), but their anchor points were measured off these
files — the hearth mouth, the chimney and the middle of the pool — so replacing
an image means re-measuring them.

The three Storage Chests are the one set that is not shipped as drawn. They
arrived at 32 x 32 — a single tile, on a structure that occupies four — and were
enlarged to fill the plot with Scale2x (EPX), the pixel-art doubling that
rounds a diagonal instead of stepping it. That makes them derivative works of
the originals: same provenance, same licence, and they are twice the pixel size
of every other building here, which is visible if you look for it. Redrawing
them at 64 x 64 at source would be sharper. Each was then trimmed and seated on
the anchor line so the box sits on the ground rather than hovering over its own
shadow.

## Everything else

All remaining artwork is procedural — baked at runtime from character maps in
`src/gfx/sprites.ts` and `src/gfx/adventurer.ts`, with no external files. The
baked sprites also remain the fallback for every PNG above: if an image fails
to load, the game draws its procedural stand-in instead.
