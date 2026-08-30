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

## The human ranks — eighteen men and one woman of the road

`public/mob-beggar-walk.png`, `mob-vagrant-walk.png`, `mob-thief-walk.png`,
`mob-poacher-walk.png`, `mob-smuggler-walk.png`, `mob-cutthroat-walk.png`,
`mob-deserter-walk.png`, `mob-brigand-walk.png`, `mob-highwayman-walk.png`,
`mob-mercenary-walk.png`, `mob-corsair-walk.png`, `mob-amazon-walk.png`,
`mob-wildWarrior-walk.png`, `mob-hunter-walk.png`, `mob-gladiator-walk.png`,
`mob-barbarian-walk.png`, `mob-raider-walk.png`, `mob-warlord-walk.png`,
`mob-chieftain-walk.png`, and a body apiece:
`mob-beggar-dead.png`, `mob-vagrant-dead.png`, `mob-thief-dead.png`,
`mob-poacher-dead.png`, `mob-smuggler-dead.png`, `mob-cutthroat-dead.png`,
`mob-deserter-dead.png`, `mob-brigand-dead.png`, `mob-highwayman-dead.png`,
`mob-mercenary-dead.png`, `mob-corsair-dead.png`, `mob-amazon-dead.png`,
`mob-wildWarrior-dead.png`, `mob-hunter-dead.png`, `mob-gladiator-dead.png`,
`mob-barbarian-dead.png`, `mob-raider-dead.png`, `mob-warlord-dead.png`,
`mob-chieftain-dead.png`. Every human in the bestiary is here. The dragon was
the last creature on a procedural placeholder — LPC has no dragon to give it —
and it now has artwork of its own from a different source; see the dragon
section below.

All of them are composed from the same **Universal LPC Spritesheet Character
Generator** as the player and the bandit, under the same licences as the layers
listed above. Seventeen share one body base (`Body_Color_light`) and one head
(`Human_Male_light`) with the player himself — they are men of the same island,
and only the clothing, the beard and the weapon tell one rank from the next.
The mercenary and the barbarian are built on the `muscular` base and the amazon
on the female one.

Reproducible character configurations:

- Beggar —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&beard=Winter_Beard_gray&mustache=Big_Mustache_gray&hair=Buzzcut_gray&legs=Cuffed_Pants_maroon&shoes=Ghillies_walnut&clothes=Cardigan_leather&hat=Tricorne_leather>
- Vagrant —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&beard=Trimmed_Beard_light_brown&mustache=Chevron_Mustache_light_brown&hair=Buzzcut_gray&legs=Formal_Pants_gray&shoes=Basic_Shoes_black&clothes=Longsleeve_gray&bandana=Pirate_Bandana_brown>
- Thief —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Mop_light_brown&facial_eyes=Eyepatch_Ambidextrous_black&clothes=Shortsleeve_walnut&jacket=Frock_coat_black&legs=Leggings_red&shoes=Basic_Shoes_black&gloves=Gloves_bronze>
- Poacher —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Bob_chestnut&hat_accessory=Cavalier_feather_black&clothes=Shortsleeve_forest&jacket=Frock_coat_leather&legs=Leggings_forest&shoes=Basic_Shoes_forest&weapon=Slingshot_slingshot>
- Smuggler —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hairextl=Left_Braid_orange&hair=Halfmessy_orange&bandana=Bandana_green&backpack=Backpack_green&jacket=Frock_coat_green&legs=Pants_red&shoes=Basic_Boots_red&weapon=Dagger_dagger>
- Cutthroat —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=High_and_tight_dark_brown&bandana=Bordered_Bandana_purple&clothes=Sleeveless_2_red&legs=Leggings_gray&shoes=Basic_Boots_black&weapon=Hammer_iron>
- Deserter —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&beard=Trimmed_Beard_black&mustache=Handlebar_Mustache_black&shoes=Basic_Boots_black&legs=Leggings_black&jacket=Frock_coat_blue&armour=Leather_walnut&hair=Relm_Short_black&weapon=Dagger_dagger>
- Brigand —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Bedhead_gray&hat=Spangenhelm_steel&shoulders=Legion_steel&armour=Legion_steel&legs=Armour_steel&shoes=Armour_steel&weapon=Spear_medium>
- Highwayman —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Cowlick_dark_brown&facial_mask=Plain_Mask_leather&armour=Leather_brown&weapon=Dagger_dagger&shoes=Basic_Boots_leather&legs=Cuffed_Pants_leather>
- Mercenary —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=muscular&body=Body_Color_light&head=Human_Male_light&expression=Angry_light&hair=Messy1_raven&accessory=Crest_steel&earrings=Moon_earrings_silver&shoes=Armour_all.lpcr.emerald&weapon=Spear_steel&shoulders=Legion_all.lpcr.swamp&legs=Striped_Formal_Pants_forest>
- Corsair —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Bangslong_black&bandana=Pirate_Bandana_black&bandana_overlay=Skull_Bandana_Overlay_white&jacket=Frock_coat_black&legs=Pants_black&shoes=Basic_Boots_black&weapon=Saber_saber>
- Amazon —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=female&body=Body_Color_light&head=Human_Female_light&expression=Neutral_light&hair=Loose_red&earrings=Moon_earrings_copper&legs=Legion_skirt_orange&armour=Leather_orange&weapon=Slingshot_slingshot&eyes=Eye_Color_green>
- Wild Warrior —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Curly_long_dark_gray&shoulders=Legion_steel&armour=Legion_steel&legs=Armour_steel&shoes=Armour_steel&weapon=Arming_Sword_steel>
- Hunter —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Page2_raven&gloves=Gloves_all.lpcr.mustard&armour=Leather_green&shoes=Basic_Boots_forest&legs=Shorts_forest&weapon=Crossbow_crossbow>
- Gladiator —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hat=Greathelm_steel&armour=Plate_steel&arms=Armour_steel&legs=Armour_steel&shoes=Armour_steel&gloves=Gloves_steel&shield=Round_Shield_black&weapon=Halberd_halberd>
- Barbarian —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=muscular&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Dreadlocks_short_green&facial_mask=Plain_Mask_red&gloves=Gloves_all.lpcr.emerald&wrists=Cuffs_red&shoulders=Pauldrons_forest&legs=Legion_skirt_red&shoes=Sandals_green&shield=Heater_Shield_Base_all.lpcr.green&weapon=Spear_red>
- Raider —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Parted_2_black&hat=Barbarian_Viking_bronze&chainmail=Chainmail_bronze&gloves=Gloves_bronze&shoes=Armour_bronze&legs=Armour_bronze&shield=Spartan_Shield_spartan&weapon=Saber_saber>
- Warlord —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Parted_2_black&gloves=Gloves_silver&shoes=Armour_silver&legs=Armour_silver&weapon=Longsword_longsword&shield=Plus_shield_plus&armour=Plate_silver&arms=Armour_silver&shoulders=Mantal_tan&hat=Horned_helmet_silver>
- Chieftain —
  <https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Bedhead_red&hat=Close_helm_copper&visor=Horned_visor_silver&accessory=Centurion_Plumage_slate&shoes=Armour_copper&legs=Armour_silver&armour=Legion_copper&ring=Stud_Ring_red&arms=Armour_silver&bauldron=Bauldron_red&shoulders=Epaulets_red&gloves=Gloves_copper&weapon=Longsword_longsword&shield=Crusader_shield_crusader>

Beyond the collections listed under the player, these characters draw on the
beard, moustache and a long list of hair layers (buzzcut, mop, bob,
high-and-tight, Relm short, halfmessy with a left braid, bedhead, cowlick,
messy, bangslong, page, loose and curly long); the tricorne, spangenhelm,
pirate-, bordered- and plain-bandana with skull overlay, cavalier feather,
eyepatch, plain leather mask, steel crest and moon earrings; the cardigan,
longsleeve, shortsleeve, sleeveless, frock coat, backpack, legion armour and
shoulders, leather armour, legion skirt, cuffed, formal, striped formal and
plain trousers, shorts and leggings; the ghillie, basic shoe, basic boot and
armour footwear and sandals; the bronze, mustard, steel, silver, copper and
emerald gloves; the greathelm, close helm, horned helm, horned visor, viking
helm, centurion plumage, epaulets, bauldron, mantle, pauldrons, cuffs and stud
ring; the steel, silver and copper plate, legion and chainmail armour; the
round, heater, spartan, plus and crusader shields; and the dagger, iron hammer,
slingshot, medium, steel and red spear, saber, arming sword, longsword, halberd
and crossbow weapon layers of the ULPC project. The generator's own credits export is authoritative
for the per-layer author list.

From each export only the walk block was kept — rows 8-11 (up, left, down,
right), nine frames each — repacked into a 9x4 grid and cropped to one rectangle
shared by every frame, symmetric about the source cell's centre line (see
`src/gfx/mobSheet.ts`). No pixel was repainted in any walk frame. Frame sizes:
32x53 beggar, 32x49 vagrant, 32x52 thief, 46x56 poacher, 40x55 smuggler,
54x49 cutthroat, 40x50 deserter, 64x52 brigand, 40x50 highwayman,
64x54 mercenary, 50x53 corsair, 46x50 amazon, 58x51 wild warrior, 44x49 hunter,
64x51 gladiator, 64x52 barbarian, 50x53 raider, 64x56 warlord, 64x59 chieftain.
The widths are the weapons: a levelled spear fills the whole 64px cell, a hammer
held out sideways takes 54, and the poacher's height is his hat feather.

The bodies are the last frame of the hurt row (row 20, column 6) of each export,
cropped to the body — 34px wide for all but the wild warrior, whose hair spreads
to 40. Unlike the orc and minotaur ranks these are **not** shared: what tells one
man of the road from the next is his clothing, so a single anonymous heap would
have made the ladder unreadable on the ground.

These are the only files in the project with pixels deleted. LPC's death frame
lets a character drop what he was holding, and gear lying beside a corpse reads
as loot the game will not hand over, so a weapon thrown clear of the body was
cut: the deserter's and smuggler's and highwayman's daggers, the hunter's
crossbow, the ends of the brigand's and mercenary's spears. The corsair's saber
came to rest under his own hand, where a straight cut would have taken the hand
with it, so it was lifted out by colour instead — the two greys the blade is
painted in appear nowhere else on that frame. The last five ranks die holding
two things apiece, a weapon and a shield, and both fall beside them: all five
were cut back to the body's own edge. Nothing was added, and gear still tangled
with the body was left alone — the wild warrior's sword under his hand, the
length of spear the two spearmen came to rest on, and the few pixels of shield
and blade that overlap the outlines of the top five. Those five could not be
lifted by colour: their shields are painted in the same palette as their
armour, so a colour lift would have taken the corpse with it.

> **TODO before release:** download "Credits (CSV)" from the generator for each
> of these nineteen configurations and paste the per-layer author lists here.
> The URLs reproduce the characters, but a URL is not an attribution.

**ShareAlike:** these thirty-eight files are derivative works of CC-BY-SA 3.0
artwork and are themselves published under **CC-BY-SA 3.0**. They must stay
publicly available on those terms even if this repository is later made private.

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
`public/reach-terrain.png`, `public/orcdeep-terrain.png`,
`public/minodeep-terrain.png`, `public/deaddeep-terrain.png` and
`public/deaddeep2-terrain.png` are exported from Tiled maps painted with tile
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

## The dead's descent — `public/deaddeep-terrain.png`, `public/deaddeep2-terrain.png`

A 1920 x 1920 export of `-1_szkielety.tmx` and a 960 x 960 export of
`-2_szkielety.tmx` — the project owner's own Tiled compositions of the maze
under the Bone Reach's northern descent and the dragon's hollow below it. The
layouts are his work; the tiles they are painted with are credited below.

Both ship **unmodified**, exactly as exported, at native tile resolution with
the object layers hidden. Nothing was resampled or recoloured. The dimensions
are load-bearing: `terrainImage.ts` refuses any image that is not exactly the
grid size in tiles times 32, rather than draw a map shifted against its own
collision.

### Tilesets

Both reference a single tileset, `MainLev2.0hhh` — the same **Szadi art.**
(szadiart) variant the other Tiled maps here are painted with, recorded under
"Terrain and props" above and under the same licence, with the same question of
which pack the variant was cut from still outstanding.

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

## Bandit Deep terrain — `public/banditdeep-terrain.png`, `public/banditdeep2-terrain.png`, `public/banditdeep3-terrain.png`

Exported from `piwnica_bandit.tmx`, `piwnica_bandit-2.tmx` and
`bandit_piwnica_-3.tmx`, which reference `MainLev2.0hhh` and
`32x32_DEMO` — both **Szadi art.** (szadiart) packs already recorded under
"Terrain and props" above, under the same licence and with the same pinning
still outstanding as the other Tiled exports here.

Native tile resolution, object layers hidden: 3360 x 3200 for the two 105 x 100
floors and 1280 x 1280 for the 40 x 40 cell. The -3 export arrived as a BMP and
was re-encoded to PNG unchanged, pixel for pixel.

`banditdeep2-terrain.png` is a second export of the same map: the first drawing
sealed a 297-square corridor in the west with no door in it, and the map was
redrawn with doorways at y=53-54 and y=80-82. The re-export changed exactly
those 297 squares and nothing else on the floor.

All three ship **unmodified**. An earlier pass resampled the two large floors,
because the wall tileset had been stamping its band half a tile off the grid —
a vertical band's rock measured x=16..47 across the two columns the TMX marked
as wall, one tile's worth of stone centred on the seam between them, so sealing
both columns put a whole phantom square of bare floor beyond reach. The maps
have since been redrawn with a second rock layer widening every band to fill
both squares (`sciany cd` on -1, `skaly cd` on -2, `scian cd` on -3), which
takes the maze walls from 0.41 ink per sealed square to 0.66 and makes the
resampling both unnecessary and harmful. It is gone.

## Gallows Coast buildings — `prop-barn.png`, `prop-house-a.png`, `prop-house-b.png`, `prop-smithy.png`, `prop-windmill.png`

Source: **CraftPix.net**, *Top-Down Simple Autumn Props* and *Top-Down Simple
Summer Props*, under the CraftPix standard licence — commercial use in a
released game is permitted; redistribution of the source files as source files
is not. What ships here are not those files. Each is a derivative cut down by
roughly a quarter in each dimension and re-quantised to a 28-colour palette,
which is what the game's tile size can carry.

| File | Source prop | Size | Footprint | Blocks |
| --- | --- | --- | --- | --- |
| `prop-barn.png` | Autumn — Barn | 128 x 160 | 4 x 5 | 4 x 2 |
| `prop-house-a.png` | Autumn — House | 128 x 160 | 4 x 5 | 4 x 2 |
| `prop-house-b.png` | Summer — House | 128 x 160 | 4 x 5 | 4 x 2 |
| `prop-smithy.png` | Autumn — Blacksmith Workshop | 128 x 128 | 4 x 4 | 4 x 2 |
| `prop-windmill.png` | Summer — Windmill | 160 x 160 | 5 x 5 | 5 x 2 |

### Cutting method

The originals are ~480 px cartoon illustrations with a flat drop shadow baked
in at `rgba(4,7,7,51)`. That shadow is stripped first — the engine draws its
own, and once prop art has loaded `artShadow` is a no-op, so the sprite has to
carry one itself. The remainder is cropped to its own bounds, resized with
Lanczos to fit the tile box, alpha-thresholded so the silhouette reads as
pixels instead of a soft smear, unsharp-masked to bring the black outline back
after the shrink, quantised to 28 colours, and given a soft elliptical ground
shadow sized to whatever part of the building actually meets the floor.

Sizes were chosen from each prop's own proportions rather than forced to one
box: the barn and both houses come out at 1.27-1.48 tall for every tile wide,
which lands on 4 x 5; the smithy is the squattest of the five and takes 4 x 4;
the windmill is wider than it is tall because of its sails, and cropping those
to four tiles left a shed with sticks on it, so it takes 5 x 5.

Like the Bone Reach objects, these are scenery rather than terrain: they stand
taller than the squares they occupy and the player walks behind the roof.

## Town buildings, stalls and windmills — `public/prop-town-*.png`

Source: **CraftPix.net**, standard (non-Enterprise) licence —
https://craftpix.net/file-licenses/

Same grant as the Home Isle buildings and the spell effects: commercial use and
sale of the game are permitted outright, attribution is a courtesy rather than
an obligation, and clause 3.1.1 forbids feeding these files to a model as
training data.

> **These files must not sit in a public repository.** 1.1.3 forbids
> distributing source files and 1.2.1 forbids redistributing the art in any
> form another end user could take and use; a public GitHub repo is exactly
> that. Serving them from Vercel as part of the running game is fine. Git keeps
> every blob it has ever stored, so a file that has been pushed once is not
> removed by deleting it in a later commit.

Thirty settlement props. They arrived as native pixel art cut to a whole
number of tiles and nothing was requantised or restyled, but **twenty-seven of
the thirty are now drawn at twice the size they shipped at** — a plain 2x
nearest-neighbour scale, so the pixels are square blocks and no colour was
invented. At the original scale a four-by-three manor stood barely two
player-heights and its doorway came up to the character's shoulder; a street of
them read as a row of models. The three market stalls were left alone, a stall
being the one thing in the set that was already person-sized.

Each file is exactly its footprint times 32 pixels, with the art seated flush
against the bottom edge — which is the contract `src/gfx/sceneryArt.ts` draws
against, and which the smoke suite checks file by file.

| File | Size | Footprint | Blocks |
| --- | --- | --- | --- |
| `prop-town-stall-grey.png` | 96 x 64 | 3 x 2 | 3 x 1 |
| `prop-town-stall-open.png` | 96 x 64 | 3 x 2 | 3 x 1 |
| `prop-town-stall-red.png` | 96 x 64 | 3 x 2 | 3 x 1 |
| `prop-town-shrine.png` | 128 x 128 | 4 x 4 | 4 x 2 |
| `prop-town-chapel.png` | 128 x 192 | 4 x 6 | 4 x 4 |
| `prop-town-shop.png` | 128 x 192 | 4 x 6 | 4 x 4 |
| `prop-town-shophouse.png` | 192 x 128 | 6 x 4 | 6 x 2 |
| `prop-town-shoprow.png` | 256 x 128 | 8 x 4 | 8 x 2 |
| `prop-town-storefront.png` | 256 x 128 | 8 x 4 | 8 x 2 |
| `prop-town-townhouse.png` | 128 x 256 | 4 x 8 | 4 x 4 |
| `prop-town-watchtower.png` | 128 x 256 | 4 x 8 | 4 x 4 |
| `prop-town-bank.png` | 192 x 192 | 6 x 6 | 6 x 4 |
| `prop-town-cottage.png` | 192 x 192 | 6 x 6 | 6 x 4 |
| `prop-town-market.png` | 320 x 128 | 10 x 4 | 10 x 2 |
| `prop-town-apothecary.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-guildhall.png` | 384 x 128 | 12 x 4 | 12 x 2 |
| `prop-town-inn.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-keep.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-manor.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-temple.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-warehouse.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-workshop.png` | 256 x 192 | 8 x 6 | 8 x 4 |
| `prop-town-observatory.png` | 192 x 320 | 6 x 10 | 6 x 4 |
| `prop-town-stonehouse.png` | 320 x 192 | 10 x 6 | 10 x 4 |
| `prop-town-tavern.png` | 320 x 192 | 10 x 6 | 10 x 4 |
| `prop-town-tradehouse.png` | 320 x 192 | 10 x 6 | 10 x 4 |
| `prop-town-towerhouse.png` | 256 x 256 | 8 x 8 | 8 x 4 |
| `prop-town-greattemple.png` | 320 x 320 | 10 x 10 | 10 x 4 |
| `prop-town-windmill-cloth.png` | 384 x 384 | 12 x 12 | 12 x 4 |
| `prop-town-windmill-lattice.png` | 384 x 384 | 12 x 12 | 12 x 4 |

The footprints in that table are read off the images rather than chosen: the
files were delivered pre-cut to a whole number of tiles, and the smoke suite
now checks that every one of them is exactly its footprint times 32 — so a file
re-exported at the wrong scale is caught rather than silently shifting the
building off its own plot. The block column is what ships in
`src/gfx/sceneryArt.ts`. `TOWN-BUILDINGS.md` says what each one is and where it
stands.

The three stalls block one row rather than two so a vendor can stand behind the
counter. The two windmills are 6 x 6 and are not the 5 x 5 Gallows Coast
`prop-windmill.png`; their mills are only about three tiles wide, so a 6 x 2
block seals bare ground either side — deliberate, matching what the 5 x 5
already does, and the reason they belong outside the walls.

### On the missing ground shadow

The Gallows Coast props carry a soft elliptical shadow baked in during their
cut. These do not, and none was added. Once prop art has loaded `artShadow` is
a no-op (`src/main.ts`), so nothing is drawn beneath them at all.

That was checked rather than assumed: composited onto `town-terrain.png` beside
`prop-house-a.png`, none of them floats. Every one is a flat elevation with a
hard dark outline along its bottom edge, and that outline does the seating a
shadow would otherwise do — while `prop-house-a`'s own baked ellipse is barely
visible on that ground anyway. A soft gradient under crisp pixel art would read
worse than nothing. The files are already at final size, so if a future terrain
proves otherwise the shadow can be baked in later in one pass.

## Black Knight — `public/mob-black-knight-walk.png`, `public/mob-black-knight-dead.png`

Source: **Universal LPC Spritesheet Character Generator**, CC-BY-SA 3.0 —
the same terms, and the same ShareAlike obligation, as every other LPC
creature in this project. See the LPC section above for the full attribution
list and the per-layer note.

Reproducible generator URL (paste it in and the exact character loads):

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_black&head=Human_Male_black&expression=Neutral_black&hair=Cowlick_black&hat=Flattop_all.lpcr.black&accessory=Short_Horns_all.lpcr.black&earring_left=Simple_Earring_Left_black&chainmail=Chainmail_all.lpcr.black&wrists=Lace_Cuffs_black&shoulders=Legion_all.lpcr.black&ring=Stud_Ring_black&arms=Armour_all.lpcr.black&cape_trim=Cape_Trim_black&cape=Solid_black&legs=Armour_all.lpcr.black&shoes=Armour_all.lpcr.black&shield=Kite_kite%20gray&weapon=Longsword_longsword>

Layers used: black body, human male head, neutral expression, cowlick hair,
flattop helm, short horns, simple left earring, chainmail, lace cuffs, legion
shoulders, stud ring, plate arms, cape with trim (solid black), plate legs,
plate shoes, grey kite shield, longsword.

### Cutting method

The standard recipe every LPC creature here uses, unchanged: rows 8-11 of the
full export are the walk (up, left, down, right, nine frames each) and row 20
is the death sequence, whose last frame is the corpse. One crop rectangle is
shared by all thirty-six walk frames and kept symmetric about the source cell's
centre line, x=32, so the body cannot drift as the cycle plays or as it turns.

The drawn sword reaches both cell edges, so the crop comes out at the cell's
full width: 64 x 55 per frame, two tiles across. Nothing was recoloured,
rescaled or redrawn — the generator output is used as exported.

**ShareAlike applies.** This sheet is an adaptation of CC-BY-SA 3.0 artwork and
is itself CC-BY-SA 3.0; anyone may take it from this repository under those
terms. The per-layer CSV attribution still owed before release covers these
layers too.

## Redcap — `public/mob-redcap-walk.png`, `public/mob-redcap-dead.png`, `public/item-blood-cap.png`

Source: **Universal LPC Spritesheet Character Generator**, CC-BY-SA 3.0 — the
same terms and the same ShareAlike obligation as every other LPC creature here.
See the LPC section above for the full attribution list and the per-layer note.

Reproducible generator URL (paste it in and the exact character loads):

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_taupe&head=Troll_taupe&expression=Neutral_taupe&nose=Large_nose_taupe&beard=Winter_Beard_dark_gray&mustache=Mustache_gray&hair=Balding_gray&hat=Wizard_Hat_Base_base_red&hat_trim=Santa_Trim_red&neck=Scarf_red&legs=Shorts_leather&socks=High_Socks_brown&shoes=Basic_Boots_leather&weapon=Scythe_scythe>

Layers used: taupe body, troll head, neutral expression, large nose, dark grey
winter beard, grey moustache, grey balding hair, red wizard hat base, red santa
trim, red scarf, leather shorts, brown high socks, leather basic boots, scythe.

### Cutting method

The standard recipe, unchanged: rows 8-11 of the full export are the walk (up,
left, down, right, nine frames each) and row 20 is the death sequence, whose
last frame is the corpse. One crop rectangle is shared by all thirty-six walk
frames and kept symmetric about the source cell's centre line, x=32, so the body
cannot drift as the cycle plays or as it turns. The scythe reaches past the body
on both sides, so the crop comes out at 60 x 58 per frame; the corpse is 46 x 36,
cropped to the body. Nothing was recoloured, rescaled or redrawn.

### The cap icon

`item-blood-cap.png` is **not** cut out of the composed character — cropping the
head off a finished sprite would have taken face and hair pixels with it. It is
the two hat layers on their own, composited and cropped to their own bounds
(28 x 23) and centred in a 32 x 32 icon:

- `spritesheets/hat/magic/wizard/base/adult/walk/base_red.png`
- `spritesheets/hat/holiday/santa/adult/walk/red.png`

taken from the generator's own repository at the paths above, front-facing
standing frame (row 2, column 0). Same source, same licence, no repainting.

**ShareAlike applies.** These three files are adaptations of CC-BY-SA 3.0
artwork and are themselves CC-BY-SA 3.0; anyone may take them from this
repository under those terms. The per-layer CSV attribution still owed before
release covers these layers too.

## Liddesdale and the redcap's lair — map layouts

Two files: `public/liddesdale-terrain.png` (2560x2560) and
`public/hermitage-terrain.png` (960x960). Both are Tiled "Export as Image" of
maps authored by the project owner (`redcaplewyspa.tmx`, 80x80, and
`redcapleboss.tmx`, 30x30), at native tile size with object layers hidden, and
they are blitted straight into the world exactly like the other fourteen
terrain exports above.

The tilesets painted into them (`32x32_DEMO`, `MainLev2.0hhh`,
`Water_tafle_4A`) are commercial assets held under the project's own licences;
the `.tsx` files and source sheets are NOT in this repository, only the
flattened picture. Everything standing on top — dead trees, felled wood,
tents, skull poles — is the `prop-*` set already credited above.

## Draugr — `public/mob-draugr-walk.png`, `public/mob-draugr-dead.png`, `public/item-grave-helm.png`

Source: **Universal LPC Spritesheet Character Generator**, CC-BY-SA 3.0 — the
same terms and the same ShareAlike obligation as every other LPC creature here.
See the LPC section above for the full attribution list and the per-layer note.

Reproducible generator URL (paste it in and the exact character loads):

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Zombie_zombie&wound_brain=Brain_red&wound_mouth=Mouth_brown&wound_eye_left=Left_Eye_purple&wound_arm=Arm_brown&wound_ribs=Ribs_leather&head=Zombie_all.lpcr.heather&weapon=Axe_iron&shoes=Basic_Boots_walnut&legs=Shorts_walnut&jacket=Frock_coat_brown&hat=Barbarian_iron&eyebrows=Thick_Eyebrows_redhead>

Layers used: zombie body, zombie head (all.lpcr heather), red brain wound,
brown mouth wound, purple left-eye wound, brown arm wound, leather rib wound,
redhead thick eyebrows, brown frock coat, walnut shorts, walnut basic boots,
iron barbarian helmet, iron axe.

### Cutting method

The standard recipe, unchanged: rows 8-11 of the full export are the walk (up,
left, down, right, nine frames each) and row 20 is the death sequence, whose
last frame is the corpse. One crop rectangle is shared by all thirty-six walk
frames and kept symmetric about the source cell's centre line, x=32, so the body
cannot drift as the cycle plays or as it turns. The axe swings clear of the body
on both sides, so the crop comes out at 56 x 50 per frame; the corpse is 34 x 35,
cropped to the body. Nothing was recoloured, rescaled or redrawn.

### The helm icon

`item-grave-helm.png` is **not** a crop of the composed character — cutting the
head off a finished sprite takes face and hair pixels with it, which is the same
problem the redcap's cap had. It is lifted by MASK instead:

- the helmet layer's own file,
  `spritesheets/hat/helmet/barbarian/adult/walk.png`, is taken from the
  generator's repository and its alpha channel used as a stencil;
- the pixels are then copied out of the composed export through that stencil,
  front-facing standing frame (row 2, column 0).

The helmet sits at zPos 130, above the head and hair, so every pixel inside its
own silhouette is the helmet and nothing else — the result is the layer exactly
as the generator recoloured it to iron, with no repainting and no neighbouring
layer bleeding in. Cropped to its own bounds (24 x 21) and centred in a 32 x 32
icon.

That layer is credited by the generator as *hat/helmet/barbarian*, "original
version by bluecarrot16, color reduction by Napsio (Vitruvian Studio)", authors
bluecarrot16, JaidynReiman and Napsio (Vitruvian Studio), offered under CC-BY
3.0 / CC-BY 4.0 / OGA-BY 3.0 / GPL 2.0 / GPL 3.0, from
<https://opengameart.org/content/lpc-helmets> and
<https://opengameart.org/content/lpc-expanded-hats-facial-helmets>. Those are
narrower terms than the sheet as a whole, but the icon is distributed as part of
the same CC-BY-SA 3.0 set and nothing here relies on the difference.

**ShareAlike applies.** These three files are adaptations of CC-BY-SA 3.0
artwork and are themselves CC-BY-SA 3.0; anyone may take them from this
repository under those terms. The per-layer CSV attribution still owed before
release covers these layers too.

## Viking — `public/mob-viking-walk.png`, `public/mob-viking-dead.png`

Source: **Universal LPC Spritesheet Character Generator**, CC-BY-SA 3.0 — the
same terms and the same ShareAlike obligation as every other LPC creature here.
See the LPC section above for the full attribution list and the per-layer note.

Reproducible generator URL (paste it in and the exact character loads):

<https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light&hair=Bangslong2_blonde&accessory=Short_Horns_copper&hat=Bascinet_copper&facial_eyes=Eyepatch_2_Left_brown&gloves=Gloves_bronze&chainmail=Chainmail_all.lpcr.honey&shield=Spartan_Shield_spartan&weapon=Axe_iron&legs=Armour_all.lpcr.fern&shoes=Armour_iron>

Layers used: light body, light human male head, neutral expression, blonde
long-bangs hair, copper short horns, copper bascinet, brown left eyepatch,
bronze gloves, honey chainmail, spartan round shield, iron axe, fern armour
legs, iron armour boots.

### Cutting method

The standard recipe, unchanged and identical to the draugr's: rows 8-11 of the
full export are the walk (up, left, down, right, nine frames each) and row 20 is
the death sequence, whose last frame is the corpse. One crop rectangle is shared
by all thirty-six walk frames and kept symmetric about the source cell's centre
line, x=32, so the body cannot drift as the cycle plays or as it turns. The
shield and the axe reach past the body on opposite sides, so the crop comes out
at 56 x 55 per frame; the corpse is 43 x 36, cropped to the body. Nothing was
recoloured, rescaled or redrawn.

**ShareAlike applies.** Both files are adaptations of CC-BY-SA 3.0 artwork and
are themselves CC-BY-SA 3.0.

## Haramsey and Kárr's howe — map layouts

Two files: `public/haramsey-terrain.png` (2560x2560) and
`public/haugr-terrain.png` (960x1280). Both are Tiled "Export as Image" of maps
authored by the project owner (`Draugr0.tmx`, 80x80, and `Draugr-1.tmx`, 30x40),
at native tile size with object layers hidden, and they are blitted straight
into the world exactly like the sixteen terrain exports above.

Same tilesets as Liddesdale (`MainLev2.0hhh`, `Water_tafle_4A`), the same
commercial licences, and the same rule: the `.tsx` files and source sheets are
NOT in this repository, only the flattened picture.

Worth writing down because it changed how the map was authored: unlike
Liddesdale's export, which carries mud, tracks and stonework, `Draugr0` has two
layers and nothing else — sea and land. Everything readable on that island is
therefore a `prop-*` object the glyph grid plants, already credited above, and
the scatter is correspondingly heavier: 3832 land squares carrying roughly two
hundred objects against Liddesdale's hundred and eighty-seven over 3923.

## Dragon — `public/mob-dragon-walk.png`, `public/mob-dragon-dead.png`

Source: **CraftPix.net**, standard (non-Enterprise) licence —
https://craftpix.net/file-licenses/

The same terms as the buildings below: commercial use granted outright, no
royalty, no attribution owed on a paid product, and the same clause 1.1.3 /
1.2.1 restriction on public source files. **The warning in the buildings
section applies to these two files in full.**

### What was changed

The pack ships nineteen 256 x 256 frames as separate PNGs — Attack x4,
Death x5, Hurt x2, Idle x3, Walk x5 — of a PURPLE dragon in side view. Three
things were done to them:

1. **Recoloured to green.** The art is a hard 31-colour palette with no
   anti-aliasing, so this is a palette map and not a filter: every source
   colour has exactly one destination colour, chosen by rotating hue and
   raising saturation while leaving value untouched, so the shading ladder
   survives intact. Only the purple family moved; the gold wing membrane, the
   pale belly plates and the red mouth are the pack's own colours.
2. **Scaled to 0.567 and re-centred, giving a 110 x 43 frame.** The animal
   inside it is 90 px wide — 2.8 tiles — and the surplus is transparent
   padding, for a reason worth writing down. The pack draws the dragon with its
   feet at x=147 while the source cell's centre is x=128, so a crop centred on
   the cell centres the BOUNDING BOX, which is mostly tail, and the body drew
   off to one side of the tile it stood on. Centring on the feet instead fixes
   the anchor but forces the padding: the tail reaches 97 px left of the feet
   and the snout only 61 px right, and the crop has to stay symmetric about the
   anchor or the creature jumps sideways every time it turns around.

   Downscaling is a majority vote over the source pixels behind each
   destination pixel, ties broken toward the darkest survivor. Plain nearest
   drops the one-pixel outline along the spine. Two earlier cuts were rejected
   in play: half scale (80 x 38) stood shorter than the player, whose own
   sprite is 64 x 80; full 1:1 (160 x 75) was five tiles wide on a one-tile
   creature and swallowed whatever it stood next to.
3. **Packed into the engine's sheet layout.** One 6 x 4 grid: column 0 is
   `Idle1` (the standing pose), columns 1-5 are `Walk1`-`Walk5`. The crop
   rectangle is shared by all six frames and kept symmetric about the source
   cell's centre line, so the body cannot drift sideways as the cycle plays.
   Rows are up / left / down / right; the pack has only a right-facing view,
   so `left` is its mirror and the two vertical rows carry the side view — the
   snake's arrangement, for the snake's reason.

`Hurt1` and `Hurt2` are byte-for-byte duplicates of `Death1` and `Death2`, so
the pack has no hurt animation despite the filenames. The four attack frames
are unused: monsters have no attack animation in this engine yet. The corpse
is `Death5`, the last frame of the death sequence, cropped to its own bounds
and scaled by the same factor so the body matches.

## Fire field — `public/fx-fire-1-field.png`

Derived from `public/prop-campfire.png` — **Fire Animation** by **NYKNCK**. All
of that section's terms and its open question about redistribution apply here
unchanged; this is the same twelve frames, edited.

### What was changed

The campfire is the right animation with the wrong furniture. The three log
browns were deleted outright, each frame was slid down so the flame sits on the
tile's bottom edge instead of hovering where the logs used to be, and the three
flame colours were remapped onto the palette `fx-fire-1-wave.png` already uses
so that a field and a bolt read as the same element. A dark rim was added along
the silhouette edge, matching how the wave is drawn. Frame count and frame
order are untouched.

## Home Isle buildings — `public/build-*.png`

Source: **CraftPix.net**, standard (non-Enterprise) licence —
https://craftpix.net/file-licenses/

Commercial use is granted outright: unlimited free and commercial projects
(1.1.5), the right to sell and distribute games containing the art (1.1.4), no
royalty, and continued use of anything already downloaded after a subscription
ends (1.1.6). The licence imposes no attribution requirement on paid products,
so this section is a record of provenance rather than an obligation.

Clause 3.1.1 forbids using these assets to train, develop or improve AI or ML
systems. Editing them with an AI tool for use in this game is not that — it is
the adaptation right granted by 1.1.1 — but the distinction is worth keeping in
mind, since it is the assets as training data that the clause is about.

> **These files must not sit in a public repository.** Clause 1.1.3 —
> "Distribution of source files is NOT permitted" — and 1.2.1, which forbids
> redistributing the art "in a manner that would make some or all of the art
> files useable to another end user". A public GitHub repo hands the PNGs to
> anyone who clicks; the deployed game does not, and 1.2.1 says so explicitly:
> "An app that uses the art as part of the game is fine." Serving these from
> Vercel is fine. Hosting them in a public repo is not — and deleting them
> later does not help, because git keeps every blob it has ever seen.

Modifications made here (resizing, re-seating, Scale2x) are permitted by 1.1.1,
which grants the right to adapt and prepare derivative works.

| File | Structure | Tier | Size | Footprint |
| --- | --- | --- | --- | --- |
| `build-forge-1.png` | Forge | I — timber | 96 x 96 | 2 x 2 |
| `build-forge-2.png` | Forge | II — stone | 96 x 96 | 2 x 2 |
| `build-forge-3.png` | Forge | III — steel | 96 x 96 | 2 x 2 |
| `build-tower-1.png` | Alchemy Tower | I — timber | 64 x 96 | 2 x 2 |
| `build-tower-2.png` | Alchemy Tower | II — stone | 64 x 96 | 2 x 2 |
| `build-tower-3.png` | Alchemy Tower | III — amber | 64 x 96 | 2 x 2 |
| `build-dummy-1.png` | Training Dummy | I | 256 x 256 (4 x 4 cells of 64) | 1 x 1 |
| `build-dummy-2.png` | Training Dummy | II | 256 x 256 (4 x 4 cells of 64) | 1 x 1 |
| `build-dummy-3.png` | Training Dummy | III | 256 x 256 (4 x 4 cells of 64) | 1 x 1 |
| `build-range.png` | Archery Range | (single tier) | 32 x 32 | 1 x 1 |
| `build-chest-1.png` | Storage Chest | I | 64 x 64 | 2 x 2 |
| `build-chest-2.png` | Storage Chest | II | 64 x 64 | 2 x 2 |
| `build-chest-3.png` | Storage Chest | III | 64 x 64 | 2 x 2 |

Authored at world scale — TILE (32) px per tile — anchored bottom-centre, with
no painted ground shadow (the renderer draws its own, sized off the footprint
rather than the sprite: a two-tile forge is three tiles of roof, and a shadow
as wide as the roof would put the whole pad in shade).

The stills ship exactly as they were drawn. The three training-post sheets do
not: they arrived as 32 x 32 cells, which put the post at roughly waist height
beside the player, and were doubled to 64 with Scale2x (EPX) the same way the
chests were — so they too are twice the pixel size of the buildings around
them. Redrawing them at 64 at source would be sharper.

The same pass fixed the alignment. The generator placed the fourth facing seven
pixels left of the other three, which slid the plinth sideways whenever the post
changed which way it leaned; each row is now centred on its own plinth and
seated so the lowest pixel meets the edge the renderer anchors to. Frames are
composed one cell at a time rather than shifted in place, which is what keeps a
row's offset from bleeding a column into the frame beside it. Nothing was
recoloured or redrawn, and the small plinth wobble inside rows 1 and 2 is the
original animation, left alone.

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

## Spell effects — `public/fx-*.png`

Source: **CraftPix.net**, standard (non-Enterprise) licence —
https://craftpix.net/file-licenses/

Same licence, same grant and the same one hard limit as the Home Isle buildings
above: commercial use and sale of the game are permitted outright, attribution
is a courtesy rather than an obligation, and clause 3.1.1 still forbids feeding
these files to a model as training data.

> **These files must not sit in a public repository.** The warning on the
> buildings applies here word for word — 1.1.3 forbids distributing source
> files, 1.2.1 forbids redistributing the art in any form another end user
> could take and use, and a public GitHub repo is exactly that. Serving them
> from Vercel as part of the running game is explicitly fine. Note that git
> keeps every blob it has ever stored, so a file that has been pushed once is
> not removed by deleting it in a later commit.

Every sheet is a horizontal strip of 32 x 32 frames. The frame count is read
off the image at load time rather than declared anywhere, so a redrawn strip of
a different length needs no code change (`src/gfx/spellArt.ts`).

| Element | `bolt` — projectile | `burst` — tile bloom | Tier colours |
| --- | --- | --- | --- |
| Fire | comet, 8 fr | starburst, 9 fr | orange / blue / black |
| Ice | snowflake, 13 fr | rising spike, 12 fr | pale / blue / deep blue |
| Earth | tumbling rock, 12 fr | ground spikes, 11 fr | earth / slate / dark |
| Storm | arrowhead, 12 fr | starburst, 17 fr | yellow / violet / grey |
| Wind (`shadow`) | crescent scythe, 12 fr | tornado, 11 fr | violet / black / white |

Fire and Storm also ship a `wave` strip — a rising column and a starburst
respectively. The other three do not: `wave` falls back to `burst`, and `nova`
falls back through `wave` to the same place, so two files are a complete
element and a third is an element choosing to look different.

### What was changed

Nothing was recoloured or redrawn. Two edits, both permitted by 1.1.1:

**Bolts were mirrored where they faced the wrong way.** The renderer rotates a
projectile toward its target from a single convention — artwork points RIGHT,
and the rotation is the raw `atan2` with no correction term. Earth, Wind and
Storm arrived facing left and each frame was flipped horizontally, individually
rather than flipping the strip, so frame order survives. Fire and Ice were
already right-facing and ship untouched.

**Storm's sheets were renamed.** They arrived as `fx-storm-1-wave_png.png` and
so on; the doubled extension meant the loader never found them. The pixels are
unchanged. Storm's `nova` strip was byte-identical to its `wave` and is not
shipped at all, since the loader already falls back.

The anchor — whether a bloom stands on the tile or blooms around its centre —
is measured from the pixels, not stored here. Art whose weight sits low in the
frame (Fire's column at 0.68, Earth's spikes at 0.70) is seated on the tile's
bottom edge; art centred in its frame (Storm's starburst at 0.50) is centred on
the tile. See `GROUNDED_AT` in `src/gfx/spellArt.ts`.

The coloured halo behind every effect is code, not artwork
(`src/gfx/spellFx.ts`): a silhouette of each frame flooded with the element's
colour and spread outwards, baked once at load. It is what keeps Fire's
near-black tier III and Wind's black tier II legible against grass.

## Sidebar button icons — `public/icon-*.png`

The five buttons at the top of the docked sidebar — Build, Skills, Equipment,
Backpack and Quest — are 16x16 pixel icons: `icon-build.png`, `icon-skill.png`,
`icon-eq.png`, `icon-backpack.png`, `icon-quest.png`.

`icon-atk.png` joins them on the same 16x16 grid: the crossed-swords glyph on
the attack-nearest button, which replaced a procedurally drawn pair of blades.

Four more, on the same grid, for the combat controls:

- `icon-chase.png`, `icon-stand.png` — a running figure and a standing one, the
  two faces of the chase toggle. They replaced the words CHASE and STAND, which
  were the widest labels on the phone's utility row.
- `icon-skull-white.png`, `icon-skull-red.png` — the PvP marks. Both are drawn
  twice over: as the switch that says whether you mean to fight other players,
  and beside the head of somebody who already has.

The chase and stand figures are drawn in black and two greys, so on a button
face they are re-coloured at runtime — the alpha channel is used as a stencil
and flood-filled with the state's colour (`stencil()` in `src/ui/icons.ts`).
The shape is the file's; only the colour is the interface's. The skulls are
already coloured and are drawn as they were authored.

**Drawn by the project author.** Original work, no third-party licence attaches
to them, so they carry no attribution or redistribution conditions.

They are drawn at whole multiples of their 16px source only — 1x, 2x or 3x
depending on display and device pixel ratio — with image smoothing switched
off, so the pixels stay square. `ICON_SRC` in `src/ui/icons.ts` is the one
number that says what grid they are authored on.

If a file fails to load, the button falls back to a procedural glyph drawn with
plain rectangles (`GLYPHS` in the same file). An empty button would be worse
than a plain one, so those shapes are kept rather than deleted.

### Home-screen icons

`icon-192.png`, `icon-512.png` and `icon-maskable-512.png` are the icons the
launcher shows once Bone Isle is installed from the browser, listed in
`public/manifest.webmanifest`.

**Generated by the project author** with a short Pillow script — a bone across a
dark isle, in the game's own chrome palette. Original work, no third-party
licence attaches, so they carry no attribution or redistribution conditions.

The maskable variant keeps its art inside the middle 80% of the square, because
a launcher is free to crop a maskable icon to a circle, a squircle or a
rounded square depending on the platform, and anything outside that safe zone
may be cut off.

## Everything else

All remaining artwork is procedural — baked at runtime from character maps in
`src/gfx/sprites.ts` and `src/gfx/adventurer.ts`, with no external files. The
baked sprites also remain the fallback for every PNG above: if an image fails
to load, the game draws its procedural stand-in instead.
