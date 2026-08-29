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
   * REWRITTEN. The first version was an encyclopedia entry — castle, date,
   * owner, mob, shrug — and Radek walked the mission twice and came out
   * knowing nothing he wanted to know. Three things were wrong with it.
   *
   * It never gave the creature its NAME. The folklore calls him Robin Redcap
   * (Henderson has him as Redcap Sly), and a boss with a name is a character
   * while a boss with a species is a spawn.
   *
   * It skipped the BARGAIN, which is the whole engine of the story: no blade,
   * no lance, no arrow and no rope that would hold him — a list that exists so
   * that the lead and the cauldron can be the answer to it. Scott's Minstrelsy
   * has the king snapping "boil him, if you please, but let me hear no more of
   * him", and messengers arriving in time to watch. That is the beat the first
   * draft replaced with the word "boiled".
   *
   * And it ended on a shrug instead of on the HOARD. Robin is said to have
   * buried what he took and never come back for it, and people kept claiming
   * to see him at the ruin at dusk turning stones over — which is, to the
   * letter, the one-time chest at the bottom of the echo. The chronicle now
   * tells the player about a thing they will then find.
   */
  "lore.redcap": {
    en: "Robin Redcap. The chronicles record his master to the day and the "
      + "hour, and him not at all. A redcap is a squat old man with a pike in his fist and iron on his "
      + "feet, and nothing on two legs outruns him. The cap is dyed in the "
      + "blood of whoever he catches, and it has to stay wet: a redcap whose "
      + "cap dries out dies with it.\n\n"
      + "He came to Hermitage and offered William de Soulis a bargain — free "
      + "run of Liddesdale, and a charmed life in exchange. No blade, no "
      + "lance, no arrow, and no rope that would hold him. De Soulis spent it "
      + "on the valley, and on the valley's children, until his tenants "
      + "walked to Robert the Bruce and would not stop asking. The king, worn out by them, said: boil him then, and let me hear no "
      + "more of him. They took him at his word. Rope would not bind de "
      + "Soulis, so they wrapped him in lead and set a cauldron inside the "
      + "stone circle above the castle, at Nine Stane Rig. The king's "
      + "messengers followed to say he had not meant it, and arrived in time "
      + "to watch. The record is shorter and duller: condemned by parliament, died a "
      + "prisoner at Dumbarton, of nothing in particular.\n\n"
      + "Robin was not at the cauldron. Nobody saw him again — except the "
      + "people who kept insisting they had, at the ruin, at dusk, turning "
      + "stones over. He is said to have buried what he took from that valley "
      + "and never come back for it.",
    pl: "Robin Redcap. Kroniki zapisują jego pana co do dnia i godziny, a "
      + "jego nie zapisują wcale. Redcap to przysadzisty starzec z piką w garści i żelazem na stopach, "
      + "i nic na dwóch nogach mu nie ucieknie. Czapkę barwi krwią tego, kogo "
      + "dopadnie, i musi ona zostać mokra: redcap, któremu czapka wyschnie, "
      + "umiera razem z nią.\n\n"
      + "Przyszedł do Hermitage i złożył Williamowi de Soulis ofertę — wolna "
      + "ręka w Liddesdale, a w zamian życie zaklęte. Żadne ostrze, żadna "
      + "włócznia, żadna strzała i żaden sznur, który by go utrzymał. De "
      + "Soulis wydał to na dolinę, i na dzieci z tej doliny, aż jego poddani "
      + "poszli do Roberta Bruce'a i nie przestawali prosić. Król, zmęczony nimi, powiedział: to go ugotujcie, byle więcej o nim "
      + "nie słyszałem. Wzięli go za słowo. Sznur de Soulisa nie wiązał, więc "
      + "owinęli go w ołów i postawili kocioł w kamiennym kręgu nad zamkiem, "
      + "na Nine Stane Rig. Posłańcy króla ruszyli za nimi powiedzieć, że nie "
      + "tak to miało brzmieć, i zdążyli akurat popatrzeć. Zapis jest krótszy i nudniejszy: skazany przez parlament, umarł jako "
      + "więzień w Dumbarton, ot tak.\n\n"
      + "Robina przy kotle nie było. Nikt go już nie zobaczył — poza tymi, "
      + "którzy uparcie twierdzili, że owszem: przy ruinie, o zmierzchu, "
      + "przewracając kamienie. Podobno zakopał to, co zabrał tej dolinie, i "
      + "nigdy po to nie wrócił.",
    es: "Robin Redcap. Las crónicas anotan a su señor al día y a la hora, y a "
      + "él no lo anotan en absoluto. Un redcap es un viejo rechoncho con una pica en el puño y hierro en "
      + "los pies, y nada que ande a dos piernas le gana en carrera. Tiñe su "
      + "gorro con la sangre de quien atrapa, y tiene que seguir húmedo: al "
      + "redcap cuyo gorro se seca, se le seca la vida.\n\n"
      + "Llegó a Hermitage y le hizo una oferta a William de Soulis: mano "
      + "libre en Liddesdale y, a cambio, una vida encantada. Ninguna hoja, "
      + "ninguna lanza, ninguna flecha y ninguna cuerda capaz de sujetarlo. "
      + "De Soulis lo gastó en el valle, y en los niños del valle, hasta que "
      + "sus arrendatarios fueron a ver a Robert the Bruce y no dejaron de "
      + "pedir. El rey, harto de ellos, dijo: pues hervidlo, y que no vuelva a oír "
      + "hablar de él. Lo tomaron al pie de la letra. La cuerda no ataba a de "
      + "Soulis, así que lo envolvieron en plomo y pusieron un caldero dentro "
      + "del círculo de piedras que hay sobre el castillo, en Nine Stane Rig. "
      + "Los mensajeros del rey salieron detrás a decir que no lo había dicho "
      + "en serio, y llegaron a tiempo de mirar. El registro es más corto y más aburrido: condenado por el "
      + "parlamento, murió preso en Dumbarton, sin más.\n\n"
      + "Robin no estaba junto al caldero. Nadie volvió a verlo, salvo los "
      + "que insistían en que sí: junto a la ruina, al anochecer, levantando "
      + "piedras. Dicen que enterró lo que le quitó a aquel valle y que nunca "
      + "volvió a por ello.",
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
