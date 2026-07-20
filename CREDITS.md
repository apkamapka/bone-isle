# Credits

## Player sprite — `public/hero.png`

Exported from the [Universal LPC Spritesheet Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)
and trimmed to the walk cycle plus the final death frame.

**Licence: CC-BY-SA 3.0** (the LPC art is dual-licensed CC-BY-SA 3.0 / GPL 3.0;
this project takes the CC-BY-SA option). That licence permits redistribution —
which is what makes it safe to commit into a public repository — but it is a
*share-alike* licence: this sheet and anything derived from it stay CC-BY-SA,
and **every contributing artist must be credited**.

> TODO — paste the credits the generator produced for this exact character
> here. The generator lists them under the preview; export them before
> changing the configuration, because the list depends on which body, hair,
> armour and weapon layers are selected.

Original collection: <https://opengameart.org/content/lpc-collection>

## Everything else

All other artwork in this game is procedural — baked at runtime from character
maps in `src/gfx/sprites.ts` and `src/gfx/adventurer.ts`. No external files.
