/**
 * Everything the game SAYS, in three languages.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS IN HERE AND WHAT IS NOT
 *
 * Narration only: the Time Sage's speech, the folk history behind each boss,
 * the labels on the answers the player picks. Item names, creature names, map
 * names and the interface itself stay in English and are NOT keyed here.
 *
 * That line is drawn on purpose. A Polish player reads the story of Hermitage
 * in Polish and still carries a "Blood-Dyed Cap" in a "Backpack", exactly as a
 * Polish player of Tibia always has. Translating the other half means several
 * hundred more strings and a pass over every panel's width — the shop, the
 * forge and the task board are all laid out against the English word that is
 * in them today — and that is a stage of its own, not a side effect of this
 * one. The narration is the part that is worth nothing if it is not understood.
 *
 * ---------------------------------------------------------------------------
 * SHAPE
 *
 * One key, three strings, no nesting. A blank line inside a string is a PAGE
 * BREAK in the dialogue box; everything else is wrapped and paginated at the
 * width the box actually has (see `paginate` in ui/dialogue.ts). Nothing here
 * is split into lines by hand, because Polish runs about 15% longer than
 * English and Spanish about 25%, so hand-cut lines would fit one language and
 * spill in the other two.
 *
 * `{name}` is substituted from the caller's vars. There is no plural or gender
 * machinery and there should not be until a string needs it.
 *
 * A missing translation falls back to English rather than throwing — but the
 * smoke suite fails on any key that is not complete in all three, so the
 * fallback should never actually run.
 */

export type Lang = "en" | "pl" | "es";

/** Display order in the dialogue box's language strip. */
export const LANGS: readonly Lang[] = ["en", "pl", "es"];

/** What a player who has never touched the strip reads. */
export const DEFAULT_LANG: Lang = "en";

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

type Bundle = Readonly<Record<Lang, string>>;

/* ==========================================================================
 *  CHRONOS
 *
 *  He is laconic and a little archaic, and he never explains himself twice.
 *  The Polish keeps the clipped rhythm rather than the literal words: a
 *  word-for-word rendering of his English comes out oddly polite.
 *
 *  He speaks about DOORS, never about "pads". A pad is what the code calls a
 *  portal tile and what a player calls the thing they stand on; in Polish it
 *  is also the word for a gamepad, so "twój pad płonie" reads as a hardware
 *  fault rather than as a rift in time. Chronos is a person and uses a
 *  person's word: door, wrota, puerta.
 * ========================================================================== */

const SAGE: Readonly<Record<string, Bundle>> = {
  /* Level gate: the next link exists but the player is too green for it. */
  "sage.locked": {
    en: "Come back at level {lv}. History keeps.",
    pl: "Wróć na poziomie {lv}. Historia poczeka.",
    es: "Vuelve al nivel {lv}. La historia espera.",
  },
  /* Nothing left in the catalogue — for now, which is the part that matters.
   * The first draft of this read as a dead end ("every door I know is behind
   * you"), and a chain of ten missions that says that after the first one has
   * told the player the game is over when it is not. */
  "sage.cold": {
    en: "That is all I have opened so far. Come back later — I am still reading.",
    pl: "To wszystko, co dotąd otworzyłem. Wróć później — wciąż czytam.",
    es: "Eso es todo lo que he abierto hasta ahora. Vuelve más tarde: sigo leyendo.",
  },

  /* --- the answers the player picks ------------------------------------- */
  "sage.choice.what": {
    en: "What is in there?",
    pl: "Co tam jest?",
    es: "¿Qué hay ahí dentro?",
  },
  /* Two jobs: declining the errand, and the labelled way out of any other
   * conversation. Both are "I am done here", and one word covers both. */
  "sage.choice.notYet": {
    en: "Not now.",
    pl: "Nie teraz.",
    es: "Ahora no.",
  },

  /* --- mission 1: the redcap -------------------------------------------- */
  "sage.offer.redcap": {
    en: "The first door I have opened for you. The Anglo-Scottish border, "
      + "thirteen twenty — a wet valley with a castle in it that everyone "
      + "wanted and nobody enjoyed.",
    pl: "Pierwsze wrota, które dla ciebie otwieram. Pogranicze "
      + "angielsko-szkockie, rok tysiąc trzysta dwudziesty — mokra dolina z "
      + "zamkiem, którego wszyscy chcieli i którego nikt nie znosił.",
    es: "La primera puerta que te abro. La frontera anglo-escocesa, mil "
      + "trescientos veinte: un valle húmedo con un castillo que todos "
      + "querían y que nadie disfrutó.",
  },
  "sage.accept.redcap": {
    en: "A lord about to be boiled, a great many furious farmers, and one "
      + "small thing in iron boots that outlived every one of them.\n\n"
      + "Bring me its cap while the blood on it is still wet. The door below "
      + "is open, and the echo behind it holds as long as you do.",
    pl: "Pan na zamku, którego zaraz ugotują, bardzo wielu wściekłych chłopów "
      + "i jedna mała rzecz w żelaznych butach, która przeżyła ich "
      + "wszystkich.\n\n"
      + "Przynieś mi jej czapkę, póki krew na niej jest jeszcze mokra. Wrota "
      + "na dole stoją otworem, a echo za nimi trzyma się tak długo jak ty.",
    es: "Un señor a punto de ser hervido, muchísimos campesinos furiosos y "
      + "una cosa pequeña con botas de hierro que los sobrevivió a "
      + "todos.\n\n"
      + "Tráeme su gorro mientras la sangre siga húmeda. La puerta de abajo "
      + "está abierta, y el eco tras ella aguanta lo que aguantes tú.",
  },
  "sage.decline.redcap": {
    en: "Then it keeps. It has kept seven hundred years without you.",
    pl: "To poczeka. Czekało siedemset lat bez ciebie.",
    es: "Entonces esperará. Lleva setecientos años esperando sin ti.",
  },
  "sage.remind.redcap": {
    en: "The cap, and while the blood on it is still wet. Through the door, "
      + "across the valley, into the hole at the far end of it.",
    pl: "Czapka, i to póki krew na niej mokra. Przez wrota, przez dolinę, do "
      + "dziury na jej drugim końcu.",
    es: "El gorro, y con la sangre aún húmeda. Cruza la puerta, cruza el "
      + "valle y entra en el agujero del otro extremo.",
  },
  "sage.handIn.redcap": {
    en: "Still wet. Good — dry, it is only a hat.\n\n"
      + "The chronicles gave that castle four hundred years and nine owners. "
      + "They gave the thing in the boots nothing at all. I have some "
      + "sympathy.",
    pl: "Wciąż mokra. Dobrze — sucha byłaby tylko kapeluszem.\n\n"
      + "Kroniki dały temu zamkowi czterysta lat i dziewięciu właścicieli. "
      + "Rzeczy w butach nie dały nic. Mam dla niej pewne zrozumienie.",
    es: "Aún húmedo. Bien: seco no es más que un sombrero.\n\n"
      + "Las crónicas le dieron a ese castillo cuatrocientos años y nueve "
      + "dueños. A la cosa de las botas no le dieron nada. Le tengo cierta "
      + "simpatía.",
  },
  "sage.empty.redcap": {
    en: "Empty hands. Then I have opened the hole again, and you will take it "
      + "off him twice.\n\n"
      + "Do not lose it a second time. I am patient, not endless.",
    pl: "Puste ręce. Otworzyłem więc dziurę na nowo i zdejmiesz mu ją dwa "
      + "razy.\n\n"
      + "Nie zgub jej po raz drugi. Jestem cierpliwy, nie nieskończony.",
    es: "Manos vacías. He vuelto a abrir el agujero, y se lo quitarás dos "
      + "veces.\n\n"
      + "No lo pierdas una segunda vez. Soy paciente, no infinito.",
  },
};

/* ==========================================================================
 *  THE CHRONICLES
 *
 *  One per boss, shown once, on the pad that opens his hunting ground. Every
 *  one of them is real folklore or real record, and every one of them ends on
 *  the hole in the sources that the mission then walks into — which is the
 *  whole conceit of the chain: the sage collects what the chronicles left out.
 *
 *  Three paragraphs, therefore three pages. Proper nouns are NOT translated.
 * ========================================================================== */

const LORE: Readonly<Record<string, Bundle>> = {
  "lore.title.redcap": {
    en: "Hermitage, Liddesdale — 1320",
    pl: "Hermitage, Liddesdale — 1320",
    es: "Hermitage, Liddesdale — 1320",
  },
  /*
   * REWRITTEN TWICE, and the second rewrite is the one that matters.
   *
   * Draft one was an encyclopedia entry: castle, date, owner, mob, shrug.
   * Draft two put the folklore back — the name, the bargain, the lead — and
   * was still a HISTORY LESSON. Radek walked the mission twice and came out
   * bored both times, which is the only review that counts.
   *
   * The fault was the register, not the facts. A chronicle read on the way
   * into a fight should tell the player what is about to try to kill them, and
   * every line of it should be something they will recognise ten minutes later
   * with a pike in their face. So it is a BRIEFING now: one paragraph of who
   * he is, then three things, each of which is true in the folklore AND true
   * in this build.
   *
   *   the cap    his life is in it and only while the blood is wet — which is
   *              why the errand is "bring it wet" and not "bring it"
   *   the iron   every other thing of that kind flees cold iron; he wears it,
   *              boots and pike, and you hear him coming
   *   the speed  the iron does not slow him — `speed: 79`, the fastest thing
   *              in the bestiary, and a smoke test pins it there
   *
   * The hoard closes it, because the hoard is the one-time chest at the bottom
   * of the echo. Every promise the page makes is one the map keeps.
   */
  "lore.redcap": {
    en: "Robin Redcap. He kept a lord once — William de Soulis of Hermitage, "
      + "who sold what was left of himself for a life no blade could end. His "
      + "tenants found the hole in it: no rope would bind him, so they used "
      + "lead, and boiled him in it inside the stone ring above his own "
      + "castle. The lord has been cold seven hundred years. The thing he "
      + "bought is still down there.\n\n"
      + "Three things, and I will not repeat them.\n\n"
      + "The cap. It is not a hat, it is where he keeps his life, and it holds "
      + "only while the blood on it is wet. Let it dry and he dies and it goes "
      + "to dust in your hand. You take it wet or you take nothing.\n\n"
      + "The iron. Everything else of that kind runs from cold iron. He wears "
      + "it — boots shod in it, a pike made of it — and you will hear him "
      + "coming across stone long before the dark gives him up.\n\n"
      + "The speed. The iron does not slow him. Nothing on two legs has ever "
      + "outrun a redcap, so do not plan on it: stand, or do not go down at "
      + "all.\n\n"
      + "One more thing. He buried what he took from that valley and never "
      + "came back for it. That part I would like tested.",
    pl: "Robin Redcap. Miał kiedyś pana — Williama de Soulis z Hermitage, "
      + "który sprzedał resztki siebie za życie, którego nie kończy żadne "
      + "ostrze. Jego poddani znaleźli w tym dziurę: skoro sznur go nie "
      + "wiązał, wzięli ołów i ugotowali go w nim w kamiennym kręgu nad jego "
      + "własnym zamkiem. Pan stygnie od siedmiuset lat. To, co kupił, wciąż "
      + "tam siedzi.\n\n"
      + "Trzy rzeczy, i nie będę ich powtarzał.\n\n"
      + "Czapka. To nie nakrycie głowy, tylko miejsce, w którym trzyma życie, "
      + "i trzyma tylko póki krew na niej jest mokra. Pozwolisz jej wyschnąć — "
      + "on umiera, a ona rozsypuje ci się w dłoni w proch. Bierzesz ją mokrą "
      + "albo nie bierzesz nic.\n\n"
      + "Żelazo. Wszystko inne tego rodzaju ucieka od zimnego żelaza. On je "
      + "nosi — buty nim okute, pika z niego kuta — i usłyszysz go po kamieniu "
      + "na długo przedtem, nim ciemność ci go odda.\n\n"
      + "Szybkość. Żelazo go nie spowalnia. Nic na dwóch nogach nigdy nie "
      + "uciekło redcapowi, więc na to nie licz: stań, albo w ogóle tam nie "
      + "schodź.\n\n"
      + "Jeszcze jedno. Zakopał to, co zabrał tamtej dolinie, i nigdy po to "
      + "nie wrócił. Tę część chciałbym sprawdzić.",
    es: "Robin Redcap. Tuvo un señor una vez: William de Soulis de Hermitage, "
      + "que vendió lo que le quedaba de sí mismo por una vida que ninguna "
      + "hoja pudiera terminar. Sus arrendatarios le encontraron el agujero: "
      + "si la cuerda no lo ataba, usaron plomo, y lo hirvieron dentro del "
      + "círculo de piedras que hay sobre su propio castillo. El señor lleva "
      + "setecientos años frío. Lo que compró sigue ahí abajo.\n\n"
      + "Tres cosas, y no las repetiré.\n\n"
      + "El gorro. No es un sombrero, es donde guarda la vida, y sólo aguanta "
      + "mientras la sangre siga húmeda. Deja que se seque y él muere y el "
      + "gorro se te deshace en polvo en la mano. Lo tomas húmedo o no tomas "
      + "nada.\n\n"
      + "El hierro. Todo lo demás de esa clase huye del hierro frío. Él lo "
      + "lleva encima — botas herradas con él, una pica hecha de él — y lo "
      + "oirás venir sobre la piedra mucho antes de que la oscuridad te lo "
      + "entregue.\n\n"
      + "La velocidad. El hierro no lo frena. Nada que ande a dos piernas le "
      + "ha ganado nunca en carrera a un redcap, así que no cuentes con ello: "
      + "planta cara, o no bajes siquiera.\n\n"
      + "Una cosa más. Enterró lo que le quitó a aquel valle y nunca volvió a "
      + "por ello. Esa es la parte que me gustaría comprobar.",
  },
};

/* ==========================================================================
 *  THE FEW INTERFACE WORDS THE BOX ITSELF NEEDS
 *
 *  Not a general UI translation — see the note at the top. These four exist
 *  because they are printed INSIDE the dialogue box, an inch under a Polish
 *  paragraph, where an English word would read as a rendering fault.
 * ========================================================================== */

const UI: Readonly<Record<string, Bundle>> = {
  "ui.continue": { en: "continue", pl: "dalej", es: "continuar" },
  "ui.close": { en: "close", pl: "zamknij", es: "cerrar" },
  "ui.chronicles": { en: "CHRONICLES", pl: "KRONIKI", es: "CRÓNICAS" },
  "ui.readAgain": { en: "read again", pl: "przeczytaj", es: "leer de nuevo" },
};

/* ==========================================================================
 *  MISSION TITLES AND OBJECTIVES
 *
 *  The title is what the log and the Chronicles list call the errand; the goal
 *  is the one line that says what to do. `MissionDef.title` keeps its English
 *  as the id-adjacent name used in code and tests.
 * ========================================================================== */

const MISSION: Readonly<Record<string, Bundle>> = {
  "mission.title.redcap": {
    en: "The Cap of Hermitage",
    pl: "Czapka z Hermitage",
    es: "El gorro de Hermitage",
  },
  "mission.goal.redcap": {
    en: "Kill the redcap in the echo of Hermitage and carry its cap back to "
      + "Chronos.",
    pl: "Zabij redcapa w echu Hermitage i przynieś jego czapkę Chronosowi.",
    es: "Mata al redcap en el eco de Hermitage y lleva su gorro a Chronos.",
  },
};

export const TEXT: Readonly<Record<string, Bundle>> = {
  ...SAGE, ...LORE, ...UI, ...MISSION,
};

/** Every key, for the completeness test. */
export function textKeys(): string[] {
  return Object.keys(TEXT);
}

export function hasText(key: string): boolean {
  return key in TEXT;
}

/**
 * One string, in one language, with `{name}` holes filled.
 *
 * An unknown key returns the key itself rather than an empty box: a visible
 * `sage.offer.wyrm` on screen is a bug report, and blank text is not.
 */
export function t(
  key: string, lang: Lang, vars?: Readonly<Record<string, string | number>>,
): string {
  const bundle = TEXT[key];
  if (!bundle) return key;
  let s = bundle[lang] || bundle[DEFAULT_LANG];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
