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
 * ========================================================================== */

const SAGE: Readonly<Record<string, Bundle>> = {
  /* Level gate: the next link exists but the player is too green for it. */
  "sage.locked": {
    en: "Come back at level {lv}. History keeps.",
    pl: "Wróć na poziomie {lv}. Historia poczeka.",
    es: "Vuelve al nivel {lv}. La historia espera.",
  },
  /* Nothing left in the catalogue. */
  "sage.cold": {
    en: "The pads are cold. Every door I know is behind you.",
    pl: "Pady są zimne. Każde drzwi, które znam, są już za tobą.",
    es: "Las plataformas están frías. Todas las puertas que conozco quedan detrás de ti.",
  },

  /* --- the answers the player picks ------------------------------------- */
  "sage.choice.what": {
    en: "What is in there?",
    pl: "Co tam jest?",
    es: "¿Qué hay ahí dentro?",
  },
  "sage.choice.notYet": {
    en: "Not yet.",
    pl: "Jeszcze nie.",
    es: "Todavía no.",
  },
  "sage.choice.forget": {
    en: "Forget it all.",
    pl: "Zapomnij o wszystkim.",
    es: "Olvídalo todo.",
  },

  /* --- TEMP-ETAP42: the testing reset ----------------------------------- */
  "sage.forgot": {
    en: "…I have never seen you before. The pads are cold, and so am I.",
    pl: "…nigdy cię nie widziałem. Pady są zimne, i ja też.",
    es: "…no te he visto nunca. Las plataformas están frías, y yo también.",
  },

  /* --- mission 1: the redcap -------------------------------------------- */
  "sage.offer.redcap": {
    en: "The first pad. The Anglo-Scottish border, thirteen twenty — a wet "
      + "valley with a castle in it that everyone wanted and nobody enjoyed.",
    pl: "Pierwszy pad. Pogranicze angielsko-szkockie, rok tysiąc trzysta "
      + "dwudziesty — mokra dolina z zamkiem, którego wszyscy chcieli i "
      + "którego nikt nie znosił.",
    es: "La primera plataforma. La frontera anglo-escocesa, mil trescientos "
      + "veinte: un valle húmedo con un castillo que todos querían y que "
      + "nadie disfrutó.",
  },
  "sage.accept.redcap": {
    en: "A lord about to be boiled, a great many furious farmers, and one "
      + "small thing in iron boots that outlived every one of them.\n\n"
      + "Bring me its cap while the blood on it is still wet. Your pad is "
      + "lit, and the echo behind it holds as long as you do.",
    pl: "Pan na zamku, którego zaraz ugotują, bardzo wielu wściekłych chłopów "
      + "i jedna mała rzecz w żelaznych butach, która przeżyła ich "
      + "wszystkich.\n\n"
      + "Przynieś mi jej czapkę, póki krew na niej jest jeszcze mokra. Twój "
      + "pad płonie, a echo za nim trzyma się tak długo jak ty.",
    es: "Un señor a punto de ser hervido, muchísimos campesinos furiosos y "
      + "una cosa pequeña con botas de hierro que los sobrevivió a "
      + "todos.\n\n"
      + "Tráeme su gorro mientras la sangre siga húmeda. Tu plataforma está "
      + "encendida, y el eco tras ella aguanta lo que aguantes tú.",
  },
  "sage.decline.redcap": {
    en: "Then it keeps. It has kept seven hundred years without you.",
    pl: "To poczeka. Czekało siedemset lat bez ciebie.",
    es: "Entonces esperará. Lleva setecientos años esperando sin ti.",
  },
  "sage.remind.redcap": {
    en: "The cap, and while the blood on it is still wet. Down the pad, "
      + "across the valley, into the hole at the far end of it.",
    pl: "Czapka, i to póki krew na niej mokra. Padem w dół, przez dolinę, do "
      + "dziury na jej drugim końcu.",
    es: "El gorro, y con la sangre aún húmeda. Baja por la plataforma, cruza "
      + "el valle y entra en el agujero del otro extremo.",
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
  "lore.redcap": {
    en: "Hermitage Castle was raised in Liddesdale around 1240, on ground so "
      + "marshy that the bog was its only defence. The Borderers called it "
      + "the guardhouse of the bloodiest valley in Britain.\n\n"
      + "By 1320 it belonged to William de Soulis, accused of witchcraft and "
      + "of plotting the death of Robert the Bruce. His tenants swore that no "
      + "weapon of human making could touch him, and they blamed the thing "
      + "that lived with him: a short, thickset old creature in iron boots, a "
      + "pike in its left hand, and a cap it dyed in the blood of travellers, "
      + "because a redcap whose cap dries out dies.\n\n"
      + "The tenants took de Soulis up to Nine Stane Rig, a circle of "
      + "standing stones above the castle, wrapped him in lead and boiled him "
      + "alive in it. The records say something duller: that he died a "
      + "prisoner at Dumbarton, of nothing in particular. No record anywhere "
      + "says what became of the creature.",
    pl: "Zamek Hermitage wzniesiono w Liddesdale około 1240 roku, na gruncie "
      + "tak grząskim, że bagno było jego jedyną obroną. Ludzie pogranicza "
      + "nazywali go strażnicą najkrwawszej doliny Brytanii.\n\n"
      + "W 1320 roku należał do Williama de Soulis, oskarżonego o czary i o "
      + "spisek na życie Roberta Bruce'a. Jego poddani przysięgali, że żadna "
      + "broń ludzkiej roboty nie może go tknąć, i winili to, co z nim "
      + "mieszkało: niskiego, krępego starca w żelaznych butach, z piką w "
      + "lewej dłoni i w czapce, którą barwił krwią podróżnych, bo redcap, "
      + "któremu czapka wyschnie, umiera.\n\n"
      + "Poddani zabrali de Soulisa na Nine Stane Rig, krąg kamiennych słupów "
      + "nad zamkiem, owinęli go w ołów i ugotowali w nim żywcem. Zapiski "
      + "mówią coś nudniejszego: że umarł jako więzień w Dumbarton, ot tak. "
      + "Żaden zapis nigdzie nie mówi, co stało się ze stworem.",
    es: "El castillo de Hermitage se levantó en Liddesdale hacia 1240, sobre "
      + "un terreno tan pantanoso que la ciénaga era su única defensa. La "
      + "gente de la frontera lo llamaba la casa de guardia del valle más "
      + "sangriento de Gran Bretaña.\n\n"
      + "En 1320 pertenecía a William de Soulis, acusado de brujería y de "
      + "conspirar contra la vida de Robert the Bruce. Sus arrendatarios "
      + "juraban que ningún arma de factura humana podía tocarlo, y culpaban "
      + "a lo que vivía con él: un viejo bajo y recio con botas de hierro, "
      + "una pica en la mano izquierda y un gorro que teñía con la sangre de "
      + "los viajeros, porque un redcap al que se le seca el gorro muere.\n\n"
      + "Los arrendatarios llevaron a de Soulis a Nine Stane Rig, un círculo "
      + "de piedras erguidas sobre el castillo, lo envolvieron en plomo y lo "
      + "hirvieron vivo dentro. Los registros dicen algo más aburrido: que "
      + "murió preso en Dumbarton, sin más. Ningún registro dice en ninguna "
      + "parte qué fue de la criatura.",
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
