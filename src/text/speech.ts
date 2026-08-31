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

  /* --- mission 2: Kárr the Old ------------------------------------------
   * He is warmer here than he was about the redcap, and only by a degree: the
   * cap was a curiosity and this is a NAME, which is the thing he actually
   * collects. Everything he asks for in these six strings is the helm, and
   * every time he says why, he says the same thing — the man is on it. */
  "sage.offer.draugr": {
    en: "The second door. An island off the Norwegian coast, about the year "
      + "one thousand — a green hump of a place with one farm on it and one "
      + "grave.",
    pl: "Drugie wrota. Wyspa u wybrzeży Norwegii, około roku tysięcznego — "
      + "zielony garb z jednym gospodarstwem i jednym grobem.",
    es: "La segunda puerta. Una isla frente a la costa noruega, hacia el año "
      + "mil: un promontorio verde con una sola granja y una sola tumba.",
  },
  "sage.accept.draugr": {
    en: "They buried a man there with his gold and his helm, and he has been "
      + "getting up ever since. The farm is empty. The grave is not.\n\n"
      + "Bring me the helm off his head. There is a name cut inside the brow "
      + "band, and a name is a record, and records are my business.",
    pl: "Pochowali tam człowieka ze złotem i hełmem, a on od tamtej pory "
      + "wstaje. Gospodarstwo jest puste. Grób nie.\n\n"
      + "Przynieś mi hełm z jego głowy. W otoku jest wycięte imię, a imię to "
      + "zapis, a zapisy to moja robota.",
    es: "Allí enterraron a un hombre con su oro y su yelmo, y desde entonces "
      + "se levanta. La granja está vacía. La tumba no.\n\n"
      + "Tráeme el yelmo de su cabeza. Hay un nombre grabado por dentro de la "
      + "banda, y un nombre es un registro, y los registros son lo mío.",
  },
  "sage.decline.draugr": {
    en: "Then he keeps getting up, and I keep not knowing who he was.",
    pl: "To będzie wstawał dalej, a ja dalej nie będę wiedział, kim był.",
    es: "Entonces seguirá levantándose, y yo seguiré sin saber quién fue.",
  },
  "sage.remind.draugr": {
    en: "The helm, off his head, out of the mound. Through the door, across "
      + "the moor, down the hole at the far end of it.",
    pl: "Hełm, z jego głowy, z kurhanu. Przez wrota, przez wrzosowisko, w "
      + "dziurę na jego drugim końcu.",
    es: "El yelmo, de su cabeza, fuera del túmulo. Cruza la puerta, cruza el "
      + "páramo y baja por el agujero del otro extremo.",
  },
  "sage.handIn.draugr": {
    en: "Kárr. Kárr inn gamli — Kárr the Old.\n\n"
      + "The saga gives him nine words and then goes back to the man who "
      + "robbed him. He held that island alone for eighty years and nobody "
      + "wrote down a thing he said. Now I have his name, and he can stop.",
    pl: "Kárr. Kárr inn gamli — Kárr Stary.\n\n"
      + "Saga daje mu dziewięć słów i wraca do człowieka, który go okradł. "
      + "Trzymał tę wyspę sam przez osiemdziesiąt lat i nikt nie zapisał ani "
      + "jednego jego słowa. Teraz mam jego imię, a on może przestać.",
    es: "Kárr. Kárr inn gamli: Kárr el Viejo.\n\n"
      + "La saga le dedica nueve palabras y vuelve al hombre que lo robó. "
      + "Guardó esa isla solo durante ochenta años y nadie anotó nada de lo "
      + "que dijo. Ahora tengo su nombre, y puede parar.",
  },
  "sage.empty.draugr": {
    en: "Empty hands, and he has it back on. I have opened the mound again.\n\n"
      + "He does not tire and he does not wander. He will be exactly where "
      + "you left him.",
    pl: "Puste ręce, a on ma go z powrotem na głowie. Otworzyłem kurhan na "
      + "nowo.\n\n"
      + "On się nie męczy i nie chodzi po świecie. Będzie dokładnie tam, "
      + "gdzie go zostawiłeś.",
    es: "Manos vacías, y él vuelve a llevarlo puesto. He abierto el túmulo de "
      + "nuevo.\n\n"
      + "No se cansa y no vaga. Estará exactamente donde lo dejaste.",
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

  "lore.title.draugr": {
    en: "Haramsey — c. 1000",
    pl: "Haramsey — ok. 1000",
    es: "Haramsey — h. 1000",
  },
  /*
   * WRITTEN TO THE REDCAP'S SHAPE, because that shape was the one that
   * worked: a paragraph of who he is, then THREE THINGS, each of which is
   * true in the sagas AND true in this build, and each pinned by a smoke
   * test against the creature's own stats.
   *
   *   the weight  Þórólfr swelled to the size of an ox and could not be
   *               lifted without levers — `speed: 40`, the slowest thing in
   *               the game. You can walk away from him. That is the exact
   *               inverse of the redcap and the page says so out loud,
   *               because a player who learned "stand or do not go" last
   *               mission needs telling that this one is different.
   *   the armour  grave-iron on dead meat swollen tight — `armor: 26`.
   *               Flat reduction is rolled per hit, so twenty light blows
   *               are worth less than four heavy ones. This is the fact
   *               that decides whether the fight is winnable.
   *   the fire    iron wounds a draugr and does not finish it; burning is
   *               what the sagas do about one — `resist.fire: 1.5`. PASSIVE.
   *               There is no pyre and no second phase; the multiplier is
   *               the whole of it, which is why the page promises a shorter
   *               fight and not a puzzle.
   *
   * The dead close it, because eight ghouls are standing in that room and
   * the sagas say exactly where a draugr's victims go.
   */
  "lore.draugr": {
    en: "Kárr the Old. He owned Haramsey and he owned everything on it, and "
      + "when they put him in the mound they put his gold in with him, "
      + "because that is what you did for a man of his standing. He got up "
      + "the first time somebody reached for it. Every farmer on the island "
      + "left except one he happened to like. That was eighty years ago and "
      + "he is still down there, still holding it.\n\n"
      + "Three things, and I will not repeat them.\n\n"
      + "The weight. The dead of that country swell — one of them came out "
      + "of the ground the size of an ox and took levers to lift. Kárr is "
      + "slower than anything alive on that island. You CAN walk away from "
      + "him, which you could not do from the last one. What you cannot do "
      + "is wait him out. He has had eight hundred years of practice.\n\n"
      + "The iron. He is wearing his, and there is more of it than there is "
      + "of you. Light blows will not get through — a rain of them is worth "
      + "less than four honest ones, so hit him properly or do not hit him.\n\n"
      + "The fire. Iron opens a draugr and does not finish it; the sagas "
      + "burn them, and they burn them because nothing else works quickly. "
      + "If you have fire, bring it. It will not do the job for you. It will "
      + "make the job shorter.\n\n"
      + "One more thing. Whatever a draugr kills gets up after it. There is "
      + "no farm left on Haramsey and there are a great many of them in that "
      + "room, so do not assume the last thing between you and him is him.",
    pl: "Kárr Stary. Był właścicielem Haramsey i wszystkiego, co na niej "
      + "stało, a kiedy kładli go w kurhanie, włożyli mu złoto do środka, bo "
      + "tak się chowa człowieka jego stanu. Wstał, kiedy pierwszy raz ktoś "
      + "po nie sięgnął. Wszyscy gospodarze z wyspy uciekli poza jednym, "
      + "którego akurat lubił. To było osiemdziesiąt lat temu i on wciąż tam "
      + "siedzi, wciąż tego pilnuje.\n\n"
      + "Trzy rzeczy, i nie będę ich powtarzał.\n\n"
      + "Ciężar. Tamtejsi umarli puchną — jeden wyszedł z ziemi wielkości "
      + "wołu i podnosili go na dźwigniach. Kárr jest wolniejszy od "
      + "wszystkiego żywego na tej wyspie. MOŻESZ od niego odejść, czego "
      + "przy poprzednim nie mogłeś. Czego nie możesz, to go przeczekać. Miał "
      + "na to osiemset lat wprawy.\n\n"
      + "Żelazo. On swoje ma na sobie i jest go więcej niż ciebie. Lekkie "
      + "ciosy przez to nie przejdą — grad takich jest wart mniej niż cztery "
      + "uczciwe, więc bij go porządnie albo nie bij wcale.\n\n"
      + "Ogień. Żelazo draugra otwiera, ale go nie kończy; sagi je palą, i "
      + "palą dlatego, że nic innego nie działa szybko. Jeśli masz ogień, "
      + "weź go. Nie zrobi roboty za ciebie. Skróci ją.\n\n"
      + "Jeszcze jedno. To, co draugr zabije, wstaje po nim. Na Haramsey nie "
      + "został ani jeden gospodarz, a w tamtej komorze jest ich sporo — więc "
      + "nie zakładaj, że ostatnią rzeczą między tobą a nim jest on.",
    es: "Kárr el Viejo. Era dueño de Haramsey y de todo lo que había en ella, "
      + "y cuando lo metieron en el túmulo le metieron el oro dentro, porque "
      + "eso es lo que se hacía con un hombre de su rango. Se levantó la "
      + "primera vez que alguien fue a por él. Todos los granjeros de la isla "
      + "se marcharon salvo uno que le caía bien. De eso hace ochenta años y "
      + "sigue ahí abajo, sigue guardándolo.\n\n"
      + "Tres cosas, y no las repetiré.\n\n"
      + "El peso. Los muertos de aquella tierra se hinchan: uno salió del "
      + "suelo del tamaño de un buey y hubo que levantarlo con palancas. Kárr "
      + "es más lento que cualquier cosa viva de esa isla. PUEDES alejarte de "
      + "él, cosa que no podías con el anterior. Lo que no puedes es "
      + "esperarlo. Lleva ochocientos años practicando.\n\n"
      + "El hierro. Lo lleva puesto, y hay más de él que de ti. Los golpes "
      + "flojos no pasarán: una lluvia de ellos vale menos que cuatro "
      + "honrados, así que pégale en serio o no le pegues.\n\n"
      + "El fuego. El hierro abre a un draugr y no lo termina; las sagas los "
      + "queman, y los queman porque nada más funciona deprisa. Si tienes "
      + "fuego, tráelo. No hará el trabajo por ti. Lo hará más corto.\n\n"
      + "Una cosa más. Lo que un draugr mata se levanta después de él. En "
      + "Haramsey no queda ni una granja y en esa cámara hay unos cuantos, "
      + "así que no des por hecho que lo último entre tú y él es él.",
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
  /* The heading over the errand in hand, in the quest log. Keyed for the same
   * reason CHRONICLES is: it sits directly above a Polish sentence. */
  "ui.errand": { en: "ERRAND", pl: "ZLECENIE", es: "ENCARGO" },
};

/* ==========================================================================
 *  WHAT A DARK PAD SAYS
 *
 *  Every one of these replaces the same sentence: "the portal is dormant… for
 *  now". It was on all six of the cases below and it was wrong on four of
 *  them — the mouth of a finished echo is not dormant, it is SPENT, and no
 *  amount of standing on it will ever change that. A player who has just
 *  killed Kárr walks back to the hole, reads "for now", and waits for
 *  something that is never coming.
 *
 *  So the pad answers the question the player is actually asking, which is
 *  never "am I dormant" — it is WHY, and WHAT DO I DO NOW. Each line is a
 *  reason and, where there is one, an instruction. Short, because these are
 *  drawn as a float over the player's head rather than in a box: the redcap's
 *  chronicle can afford six pages, this cannot afford two lines.
 * ========================================================================== */

const PAD: Readonly<Record<string, Bundle>> = {
  /* The ground exists and the sage will open it — later. The level is the one
   * fact worth carrying away, so it is in the sentence rather than implied. */
  "pad.needLevel": {
    en: "Chronos opens this door at level {lv}.",
    pl: "Chronos otworzy te wrota na poziomie {lv}.",
    es: "Chronos abre esta puerta en el nivel {lv}.",
  },
  /* The errand is on his table and has not been taken. This is the only one of
   * the six the player can act on immediately, and it names where he stands. */
  "pad.askSage": {
    en: "Not opened yet. Ask Chronos, down in his cellar.",
    pl: "Jeszcze nieotwarte. Spytaj Chronosa w jego piwnicy.",
    es: "Aún sin abrir. Pregunta a Chronos en su sótano.",
  },
  /* The boss is down and the relic is in the pack: the echo below is an empty
   * room with a spent chest in it, and the errand finishes at the sage. */
  "pad.relicWaiting": {
    en: "Nothing left down there. Carry it to Chronos.",
    pl: "Nic tam już nie ma. Zanieś to Chronosowi.",
    es: "Ya no queda nada ahí abajo. Llévaselo a Chronos.",
  },
  /* Handed in. This is the one the old line lied about hardest. */
  "pad.errandOver": {
    en: "That errand is finished. This door stays shut.",
    pl: "To zlecenie skończone. Te wrota zostają zamknięte.",
    es: "Ese encargo terminó. Esta puerta queda cerrada.",
  },
  /* Standing in an echo, on the pad home, with the boss still alive. */
  "pad.wayHome": {
    en: "The way home opens when he falls.",
    pl: "Droga powrotna otworzy się, gdy on padnie.",
    es: "El camino de vuelta se abre cuando él caiga.",
  },
  /* One of the ten rifts no mission has been written for. Honest about it. */
  "pad.sealed": {
    en: "Sealed. Chronos has not read this far yet.",
    pl: "Zapieczętowane. Chronos jeszcze tu nie doczytał.",
    es: "Sellada. Chronos aún no ha leído hasta aquí.",
  },
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
  "mission.title.draugr": {
    en: "The Helm in the Howe",
    pl: "Hełm w kurhanie",
    es: "El yelmo en el túmulo",
  },
  "mission.goal.draugr": {
    en: "Kill Kárr the Old in the howe under Haramsey and carry his helm back "
      + "to Chronos.",
    pl: "Zabij Kárra Starego w kurhanie pod Haramsey i przynieś jego hełm "
      + "Chronosowi.",
    es: "Mata a Kárr el Viejo en el túmulo bajo Haramsey y lleva su yelmo a "
      + "Chronos.",
  },
  /* The second half of every errand, and the half nothing on screen used to
   * say. The goal line is written for a player who has not been down yet
   * ("kill X and carry it back"); once the relic is in the pack that sentence
   * is half stale, and the log line that carried it faded twelve seconds after
   * the sage said it. One string covers every mission, because the answer is
   * the same for all of them: it is in your pack, he is in the cellar. */
  "mission.deliver": {
    en: "It is in your pack. Take it to Chronos, in the cellar.",
    pl: "Masz to w plecaku. Zanieś to Chronosowi, do piwnicy.",
    es: "Lo llevas en la mochila. Llévaselo a Chronos, al sótano.",
  },
};

export const TEXT: Readonly<Record<string, Bundle>> = {
  ...SAGE, ...LORE, ...UI, ...PAD, ...MISSION,
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
