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
    en: "Come back at level {lv}. Not every story cares for an unripe listener.",
    pl: "Wróć na poziomie {lv}. Nie wszystkie historie lubią niedojrzałych słuchaczy.",
    es: "Vuelve al nivel {lv}. No todas las historias quieren oyentes verdes.",
  },
  /* Nothing left in the catalogue — for now, which is the part that matters.
   * The first draft of this read as a dead end ("every door I know is behind
   * you"), and a chain of ten missions that says that after the first one has
   * told the player the game is over when it is not. */
  "sage.cold": {
    en: "That is all I have for you. For now. Come back when I open something else.",
    pl: "To wszystko, co mam dla ciebie. Na razie. Wróć, kiedy znowu coś otworzę.",
    es: "Eso es todo lo que tengo para ti. Por ahora. Vuelve cuando abra otra cosa.",
  },

  /* --- the answers the player picks ------------------------------------- */
  "sage.choice.what": {
    en: "What is behind them?",
    pl: "Co jest za nimi?",
    es: "¿Qué hay detrás?",
  },
  /* Two jobs: declining the errand, and the labelled way out of any other
   * conversation. Both are "I am done here", and one word covers both. */
  "sage.choice.notYet": {
    en: "Not yet.",
    pl: "Jeszcze nie.",
    es: "Todavía no.",
  },

  /* --- mission 1: the redcap --------------------------------------------
   * Rewritten in Etap 45 and the shape of it is the change, not the wording.
   * He tells it in beats now — one image to a line, a blank line between them
   * — and he stops before the explanation. "Coś małego. Czerwonego." is the
   * whole of what the player is told about the redcap in the offer, and it is
   * more than three sentences of description bought before. What the player
   * is supposed to walk away with is a question, not a briefing. */
  "sage.offer.redcap": {
    en: "The first door opens on Hermitage.\n\n"
      + "Liddesdale, in the year thirteen twenty. Rain, mud, and a castle "
      + "whose lord was too proud to die like an ordinary man.\n\n"
      + "It did not help him.",
    pl: "Pierwsze wrota prowadzą do Hermitage.\n\n"
      + "Liddesdale, rok 1320. Deszcz, błoto i zamek, którego pan był zbyt "
      + "dumny, żeby umrzeć jak zwykły człowiek.\n\n"
      + "Nie pomogło mu to.",
    es: "La primera puerta da a Hermitage.\n\n"
      + "Liddesdale, año mil trescientos veinte. Lluvia, barro y un castillo "
      + "cuyo señor era demasiado orgulloso para morir como un hombre "
      + "corriente.\n\n"
      + "No le sirvió de nada.",
  },
  "sage.accept.redcap": {
    en: "William de Soulis had his men, his castle, and the certainty that no "
      + "death could reach him.\n\n"
      + "So his tenants poured him into hot lead.\n\n"
      + "They say all that was left afterwards was an empty shell and the "
      + "smell of burnt meat.\n\n"
      + "But when night came down over the castle, something small came out "
      + "of the stones.\n\n"
      + "Red.\n\n"
      + "The Redcap has kept that place ever since.\n\n"
      + "Bring me his cap. Only do not let it dry. That matters more than it "
      + "sounds.",
    pl: "William de Soulis miał swoich ludzi, swój zamek i pewność, że żadna "
      + "śmierć nie może go dosięgnąć.\n\n"
      + "Więc jego poddani wlali go do rozgrzanego ołowiu.\n\n"
      + "Mówią, że po wszystkim został tylko pusty pancerz i zapach palonego "
      + "mięsa.\n\n"
      + "Ale kiedy noc zapadła nad zamkiem, z kamieni wyszło coś małego.\n\n"
      + "Czerwonego.\n\n"
      + "Od tamtej pory Redcap pilnuje tego miejsca.\n\n"
      + "Przynieś mi jego czapkę. Tylko jej nie pozwól wyschnąć. To "
      + "ważniejsze, niż się wydaje.",
    es: "William de Soulis tenía a sus hombres, su castillo y la certeza de "
      + "que ninguna muerte podía alcanzarlo.\n\n"
      + "Así que sus arrendatarios lo vertieron en plomo ardiendo.\n\n"
      + "Dicen que después sólo quedó una coraza vacía y olor a carne "
      + "quemada.\n\n"
      + "Pero cuando cayó la noche sobre el castillo, de las piedras salió "
      + "algo pequeño.\n\n"
      + "Rojo.\n\n"
      + "Desde entonces el Redcap guarda ese lugar.\n\n"
      + "Tráeme su gorro. Sólo que no dejes que se seque. Importa más de lo "
      + "que parece.",
  },
  "sage.decline.redcap": {
    en: "Good.\n\n"
      + "The Redcap has been waiting there seven hundred years.\n\n"
      + "I doubt he will notice you were not among them.",
    pl: "Dobrze.\n\n"
      + "Redcap czeka tam od siedmiuset lat.\n\n"
      + "Podejrzewam, że nie zauważy twojej nieobecności.",
    es: "Bien.\n\n"
      + "El Redcap lleva setecientos años esperando ahí.\n\n"
      + "Dudo que note que tú no estabas.",
  },
  "sage.remind.redcap": {
    en: "Go back to Hermitage.\n\n"
      + "Find the small man in the red cap and take from him the thing that "
      + "lets him keep wearing it.\n\n"
      + "And remember — blood dries faster than you would think.",
    pl: "Wróć do Hermitage.\n\n"
      + "Znajdź małego człowieka w czerwonej czapce i zabierz mu to, co "
      + "sprawia, że wciąż może ją nosić.\n\n"
      + "I pamiętaj — krew wysycha szybciej, niż mogłoby się wydawać.",
    es: "Vuelve a Hermitage.\n\n"
      + "Busca al hombrecillo del gorro rojo y quítale aquello que le "
      + "permite seguir llevándolo.\n\n"
      + "Y recuerda: la sangre se seca antes de lo que crees.",
  },
  "sage.handIn.redcap": {
    en: "Still wet.\n\n"
      + "Good.\n\n"
      + "Had it dried, you would be holding a fistful of red dust and a very "
      + "bad memory.\n\n"
      + "Nine men have called themselves lords of Hermitage.\n\n"
      + "The Redcap is the only one death could not drive out of it.",
    pl: "Jeszcze mokra.\n\n"
      + "Dobrze.\n\n"
      + "Gdyby wyschła, zostałaby ci garść czerwonego pyłu i bardzo złe "
      + "wspomnienie.\n\n"
      + "Dziewięciu ludzi nazywało się panami Hermitage.\n\n"
      + "Redcap jest jedynym, którego śmierć nie zdołała stamtąd wygonić.",
    es: "Aún húmedo.\n\n"
      + "Bien.\n\n"
      + "Si se hubiera secado, tendrías un puñado de polvo rojo y un recuerdo "
      + "muy malo.\n\n"
      + "Nueve hombres se han llamado señores de Hermitage.\n\n"
      + "El Redcap es el único al que la muerte no logró echar de allí.",
  },
  "sage.empty.redcap": {
    en: "You lost it.\n\n"
      + "A pity. The Redcap does not care to have things taken from him.\n\n"
      + "I will open the door once more. You will find him exactly where you "
      + "left him.\n\n"
      + "This time, mind the cap.",
    pl: "Zgubiłeś ją.\n\n"
      + "Szkoda. Redcap nie lubi, kiedy ktoś zabiera mu rzeczy.\n\n"
      + "Otworzę wrota jeszcze raz. Znajdziesz go dokładnie tam, gdzie go "
      + "zostawiłeś.\n\n"
      + "Tym razem pilnuj czapki.",
    es: "Lo has perdido.\n\n"
      + "Lástima. Al Redcap no le gusta que le quiten cosas.\n\n"
      + "Abriré la puerta otra vez. Lo encontrarás exactamente donde lo "
      + "dejaste.\n\n"
      + "Esta vez, cuida el gorro.",
  },

  /* --- mission 2: Kárr the Old ------------------------------------------
   * Same shape, colder. He opens on the temperature of the door rather than
   * on the century, and the beat that carries the whole thing is the one that
   * is only four words long: "Poza jednym grobem." */
  "sage.offer.draugr": {
    en: "The second door is colder.\n\n"
      + "Haramsey. A small island off the Norwegian coast where, about a "
      + "thousand years ago, one farm stood.\n\n"
      + "Nothing stands there now.\n\n"
      + "Except one grave.",
    pl: "Drugie wrota są zimniejsze.\n\n"
      + "Haramsey. Mała wyspa u wybrzeży Norwegii, gdzie około tysiąca lat "
      + "temu stało jedno gospodarstwo.\n\n"
      + "Teraz nie stoi tam nic.\n\n"
      + "Poza jednym grobem.",
    es: "La segunda puerta es más fría.\n\n"
      + "Haramsey. Una isla pequeña frente a la costa noruega donde, hace "
      + "unos mil años, había una sola granja.\n\n"
      + "Ahora no hay nada.\n\n"
      + "Salvo una tumba.",
  },
  "sage.accept.draugr": {
    en: "Kárr owned the island.\n\n"
      + "When he died they laid gold and an iron helm in the grave with him. "
      + "A man of his standing should take something with him.\n\n"
      + "What they did not allow for was that Kárr would want to come back "
      + "for it.\n\n"
      + "The first man to reach for the gold woke him.\n\n"
      + "Nobody has lived on Haramsey since.\n\n"
      + "Take his helm.\n\n"
      + "The name cut into that iron may be the only thing left of him.",
    pl: "Kárr był właścicielem wyspy.\n\n"
      + "Kiedy umarł, włożyli mu do grobu złoto i żelazny hełm. Człowiek "
      + "jego pozycji powinien zabrać coś ze sobą.\n\n"
      + "Nie przewidzieli tylko, że Kárr będzie chciał po to wrócić.\n\n"
      + "Pierwszy, który sięgnął po złoto, obudził go.\n\n"
      + "Od tamtej pory nikt nie mieszka na Haramsey.\n\n"
      + "Weź jego hełm.\n\n"
      + "Imię wyryte w żelazie może być jedyną rzeczą, jaka po nim została.",
    es: "Kárr era el dueño de la isla.\n\n"
      + "Cuando murió le pusieron oro y un yelmo de hierro en la tumba. Un "
      + "hombre de su rango debe llevarse algo consigo.\n\n"
      + "Lo que no previeron es que Kárr querría volver a por ello.\n\n"
      + "El primero que fue a por el oro lo despertó.\n\n"
      + "Desde entonces nadie vive en Haramsey.\n\n"
      + "Coge su yelmo.\n\n"
      + "El nombre grabado en ese hierro puede ser lo único que quede de él.",
  },
  "sage.decline.draugr": {
    en: "I understand.\n\n"
      + "Then Kárr can go on sitting in his grave, keeping gold he will never "
      + "spend.\n\n"
      + "He has plenty of time.",
    pl: "Rozumiem.\n\n"
      + "Kárr może więc dalej siedzieć w swoim grobie i pilnować złota, "
      + "którego nigdy już nie wyda.\n\n"
      + "Ma dużo czasu.",
    es: "Entendido.\n\n"
      + "Entonces Kárr seguirá sentado en su tumba, guardando un oro que "
      + "nunca gastará.\n\n"
      + "Tiempo le sobra.",
  },
  "sage.remind.draugr": {
    en: "Kárr is still under the ground.\n\n"
      + "Still wearing the same helm.\n\n"
      + "If you want it for me, you will have to persuade him to part with it "
      + "first.",
    pl: "Kárr wciąż siedzi pod ziemią.\n\n"
      + "Wciąż ma na głowie ten sam hełm.\n\n"
      + "Jeśli chcesz go dla mnie, będziesz musiał najpierw przekonać jego, "
      + "żeby go oddał.",
    es: "Kárr sigue bajo tierra.\n\n"
      + "Sigue llevando el mismo yelmo.\n\n"
      + "Si lo quieres para mí, primero tendrás que convencerlo a él de que "
      + "lo suelte.",
  },
  "sage.handIn.draugr": {
    en: "Kárr inn gamli.\n\n"
      + "Kárr the Old.\n\n"
      + "Strange. He held that island eighty years, and all that reached me "
      + "of his whole life was a handful of words.\n\n"
      + "Now I have his name.\n\n"
      + "That should be enough to stop him being one more nameless corpse.",
    pl: "Kárr inn gamli.\n\n"
      + "Kárr Stary.\n\n"
      + "Dziwne. Osiemdziesiąt lat trzymał tę wyspę, a z całego jego życia "
      + "została mi zaledwie garść słów.\n\n"
      + "Teraz mam jego imię.\n\n"
      + "To powinno wystarczyć, żeby przestał być tylko kolejnym bezimiennym "
      + "trupem.",
    es: "Kárr inn gamli.\n\n"
      + "Kárr el Viejo.\n\n"
      + "Extraño. Mantuvo esa isla ochenta años, y de toda su vida no me "
      + "llegó más que un puñado de palabras.\n\n"
      + "Ahora tengo su nombre.\n\n"
      + "Debería bastar para que deje de ser un cadáver más sin nombre.",
  },
  "sage.empty.draugr": {
    en: "You lost the helm.\n\n"
      + "Kárr will have put it back on by now.\n\n"
      + "Do not worry. I will open the mound again.\n\n"
      + "Only this time, do not let him keep what you went in for.",
    pl: "Zgubiłeś hełm.\n\n"
      + "Kárr pewnie już go sobie założył.\n\n"
      + "Nie martw się. Otworzę kurhan ponownie.\n\n"
      + "Tylko tym razem nie pozwól mu odejść z tym, po co tam przyszedłeś.",
    es: "Has perdido el yelmo.\n\n"
      + "Kárr ya se lo habrá vuelto a poner.\n\n"
      + "No te preocupes. Abriré el túmulo de nuevo.\n\n"
      + "Sólo que esta vez, no dejes que se quede con aquello a lo que "
      + "fuiste.",
  },

  /* --- TEMP-ETAP45-TESTMENU ---------------------------------------------
   * The two strings behind the "start over" answer. They are HERE rather
   * than in their own bundle so that pulling the feature is one contiguous
   * cut in each of the three files it touches; grep TEMP-ETAP45-TESTMENU.
   *
   * Written in his voice anyway, because a debug button that says "DEBUG:
   * reset mission" in the middle of a conversation is the kind of thing that
   * ships by accident, and one written like this at least does not look like
   * an accident while it is here. */
  "sage.test.restart": {
    en: "Start over.",
    pl: "Zacznij od nowa.",
    es: "Empezar de nuevo.",
  },
  "sage.test.pick": {
    en: "Which of them would you live through again?",
    pl: "Którą z nich chcesz przeżyć jeszcze raz?",
    es: "¿Cuál de ellas quieres vivir otra vez?",
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
  /* Rewritten in Etap 45, and the three facts are still all in it — wet cap,
   * iron, speed — but they are no longer a list of a boss's mechanics with
   * headings on it. The old version opened "Three things, and I will not
   * repeat them", which is a briefing, and a briefing read before a fight is
   * read once and skimmed. This one tells it and lets the mechanics fall out
   * of the telling. Every heading now sits under an image rather than over a
   * stat: the cap is where he keeps his life, so of course it must stay wet.
   *
   * The stone circle in the first half is a place the player can now walk
   * into — Nine Stane Rig is nine stones and a fire on the Liddesdale map,
   * eight tiles from where the pad puts you down. Reading this and then
   * standing in it is the whole trick, and it only works while both halves
   * agree about the number nine. */
  "lore.redcap": {
    en: "William de Soulis did not want to die.\n\n"
      + "They say he paid for that with more than gold. When death came for "
      + "him, it found nowhere in him it could take hold.\n\n"
      + "So his tenants found another way.\n\n"
      + "They shut him inside a ring of stones and poured hot lead in on "
      + "top of him.\n\n"
      + "They did not hurry.\n\n"
      + "When they were done, the castle went quiet.\n\n"
      + "William stayed dead.\n\n"
      + "But something small came out of the place where they boiled him.\n\n"
      + "The Redcap has walked Hermitage ever since.\n\n"
      + "Three things you should know.\n\n"
      + "The cap.\n\n"
      + "It is not an ornament. The Redcap keeps his life in it.\n\n"
      + "While the blood on it is wet, he lives.\n\n"
      + "When it dries, the cap turns to dust and the Redcap falls with it.\n\n"
      + "So if you take it — do not wait.\n\n"
      + "The iron.\n\n"
      + "The Redcap does not mind it the way the rest of his kind do.\n\n"
      + "He goes shod in iron and carries an iron weapon. You will hear his "
      + "step before you see him.\n\n"
      + "Do not try to stop him with it.\n\n"
      + "The speed.\n\n"
      + "That is the worst thing he has.\n\n"
      + "He is small. He is fast. And he does not tire.\n\n"
      + "You can try to run, but do not count on losing him.\n\n"
      + "If you hear iron on stone, you have a moment.\n\n"
      + "One more thing.\n\n"
      + "Somewhere under the castle the Redcap hid what he took from the "
      + "people of that valley.\n\n"
      + "He never went back for it.\n\n"
      + "That part I would like to see.",
    pl: "William de Soulis nie chciał umierać.\n\n"
      + "Podobno zapłacił za to czymś więcej niż złotem. Kiedy przyszła po "
      + "niego śmierć, nie znalazła w nim miejsca, w którym mogłaby się "
      + "zatrzymać.\n\n"
      + "Jego poddani znaleźli więc inne rozwiązanie.\n\n"
      + "Zamknęli go w kamiennym kręgu i wlali do środka rozgrzany ołów.\n\n"
      + "Nie spieszyli się.\n\n"
      + "Kiedy skończyli, zamek ucichł.\n\n"
      + "William został martwy.\n\n"
      + "Ale coś małego wyszło z miejsca, w którym go ugotowali.\n\n"
      + "Od tamtej pory po Hermitage chodzi Redcap.\n\n"
      + "Trzy rzeczy powinieneś wiedzieć.\n\n"
      + "Czapka.\n\n"
      + "Nie jest ozdobą. Redcap trzyma w niej swoje życie.\n\n"
      + "Dopóki krew na niej jest mokra, on żyje.\n\n"
      + "Kiedy wyschnie, czapka zamieni się w proch, a Redcap padnie razem "
      + "z nią.\n\n"
      + "Więc jeśli ją zdobędziesz — nie czekaj.\n\n"
      + "Żelazo.\n\n"
      + "Redcap nie boi się go tak, jak inne istoty z jego rodzaju.\n\n"
      + "Sam chodzi w żelaznych butach i nosi żelazną broń. Będziesz słyszał "
      + "jego kroki, zanim go zobaczysz.\n\n"
      + "Nie próbuj go tym zatrzymać.\n\n"
      + "Szybkość.\n\n"
      + "To najgorsza rzecz, jaką ma.\n\n"
      + "Jest mały. Jest szybki. I nie zna zmęczenia.\n\n"
      + "Możesz próbować uciekać, ale nie licz na to, że zdołasz go "
      + "zgubić.\n\n"
      + "Jeśli usłyszysz żelazo uderzające o kamień, masz tylko chwilę.\n\n"
      + "I jeszcze jedno.\n\n"
      + "Gdzieś pod zamkiem Redcap ukrył to, co zabrał ludziom z doliny.\n\n"
      + "Nigdy po to nie wrócił.\n\n"
      + "To akurat chciałbym zobaczyć.",
    es: "William de Soulis no quería morir.\n\n"
      + "Dicen que lo pagó con algo más que oro. Cuando la muerte vino a por "
      + "él, no halló en él sitio donde agarrarse.\n\n"
      + "Así que sus arrendatarios buscaron otra manera.\n\n"
      + "Lo encerraron en un círculo de piedras y le echaron plomo ardiendo "
      + "encima.\n\n"
      + "No tuvieron prisa.\n\n"
      + "Cuando terminaron, el castillo se quedó en silencio.\n\n"
      + "William siguió muerto.\n\n"
      + "Pero algo pequeño salió del sitio donde lo cocieron.\n\n"
      + "Desde entonces el Redcap recorre Hermitage.\n\n"
      + "Tres cosas deberías saber.\n\n"
      + "El gorro.\n\n"
      + "No es un adorno. El Redcap guarda en él su vida.\n\n"
      + "Mientras la sangre siga húmeda, él vive.\n\n"
      + "Cuando se seca, el gorro se vuelve polvo y el Redcap cae con él.\n\n"
      + "Así que si lo consigues, no esperes.\n\n"
      + "El hierro.\n\n"
      + "Al Redcap no le molesta como a los demás de su especie.\n\n"
      + "Calza hierro y lleva un arma de hierro. Oirás sus pasos antes de "
      + "verlo.\n\n"
      + "No intentes frenarlo con eso.\n\n"
      + "La velocidad.\n\n"
      + "Es lo peor que tiene.\n\n"
      + "Es pequeño. Es rápido. Y no se cansa.\n\n"
      + "Puedes intentar huir, pero no cuentes con despistarlo.\n\n"
      + "Si oyes hierro contra piedra, te queda un instante.\n\n"
      + "Y una cosa más.\n\n"
      + "En algún lugar bajo el castillo el Redcap escondió lo que les quitó "
      + "a los del valle.\n\n"
      + "Nunca volvió a por ello.\n\n"
      + "Eso sí me gustaría verlo.",
  },

  "lore.title.draugr": {
    en: "Haramsey — c. 1000",
    pl: "Haramsey — ok. 1000",
    es: "Haramsey — h. 1000",
  },
  /* Same rebuild. The one line that changed meaning rather than shape is the
   * weight beat: the draft read "nie popełnia błędu, którego żywy człowiek
   * nie popełnia od czasu do czasu", which is a double negative that says the
   * opposite of what it is reaching for. What it wants is that Kárr does not
   * make the mistakes a living man makes, and that is what it says now. */
  "lore.draugr": {
    en: "Kárr was a rich man.\n\n"
      + "Rich enough that when they buried him, they put gold, weapons and "
      + "the helm he wore in life into the ground with him.\n\n"
      + "He was to lie there forever.\n\n"
      + "Until somebody tried to take the gold.\n\n"
      + "Then Kárr opened his eyes.\n\n"
      + "The man who went into the mound did not come out.\n\n"
      + "The rest of Haramsey did it for him.\n\n"
      + "Eighty years later the island is still empty.\n\n"
      + "And Kárr is still under the ground.\n\n"
      + "Three things.\n\n"
      + "The weight.\n\n"
      + "The dead of Haramsey do not come back as they were.\n\n"
      + "They swell under the ground. They grow. They become heavier than "
      + "bodies have any business being.\n\n"
      + "Kárr is one of the heaviest.\n\n"
      + "He is slow, but he does not make the mistakes a living man makes "
      + "from time to time.\n\n"
      + "He does not have to catch you.\n\n"
      + "It is enough that he keeps walking.\n\n"
      + "The iron.\n\n"
      + "Kárr wears more of it than you would like to see.\n\n"
      + "Helm. Mail. Blade.\n\n"
      + "Weak blows will come off him like rain off a roof.\n\n"
      + "If you mean to hurt him, strike as though you actually meant to "
      + "kill him.\n\n"
      + "The fire.\n\n"
      + "Iron lets you wound him.\n\n"
      + "Fire lets you do it faster.\n\n"
      + "It is not enough to burn him.\n\n"
      + "It is enough to stop him being so hard to kill.\n\n"
      + "Take some with you if you can.\n\n"
      + "One more thing.\n\n"
      + "Kárr is not the only one down there who can get up.\n\n"
      + "What a draugr kills does not always stay dead.\n\n"
      + "If you go into his chamber, do not assume that beating Kárr leaves "
      + "you alone in it.",
    pl: "Kárr był bogatym człowiekiem.\n\n"
      + "Na tyle bogatym, że kiedy go pochowano, złożono z nim złoto, broń i "
      + "hełm, który nosił za życia.\n\n"
      + "Miał leżeć tam na zawsze.\n\n"
      + "Dopóki ktoś nie spróbował zabrać złota.\n\n"
      + "Wtedy Kárr otworzył oczy.\n\n"
      + "Człowiek, który wszedł do kurhanu, nie wyszedł.\n\n"
      + "Reszta mieszkańców Haramsey zrobiła to za niego.\n\n"
      + "Osiemdziesiąt lat później wyspa wciąż jest pusta.\n\n"
      + "A Kárr wciąż siedzi pod ziemią.\n\n"
      + "Trzy rzeczy.\n\n"
      + "Ciężar.\n\n"
      + "Umarli z Haramsey nie wracają tacy, jakimi byli.\n\n"
      + "Pęcznieją pod ziemią. Rosną. Stają się ciężsi, niż powinny być "
      + "ludzkie ciała.\n\n"
      + "Kárr jest jednym z najcięższych.\n\n"
      + "Jest powolny, ale nie popełnia błędów, które żywy człowiek popełnia "
      + "od czasu do czasu.\n\n"
      + "Nie musi cię dogonić.\n\n"
      + "Wystarczy, że będzie szedł.\n\n"
      + "Żelazo.\n\n"
      + "Kárr ma go na sobie więcej, niż chciałbyś widzieć.\n\n"
      + "Hełm. Zbroja. Broń.\n\n"
      + "Słabe ciosy będą odbijać się od niego jak deszcz od dachu.\n\n"
      + "Jeśli chcesz go zranić, uderzaj tak, jakbyś naprawdę chciał go "
      + "zabić.\n\n"
      + "Ogień.\n\n"
      + "Żelazo pozwala ci go zranić.\n\n"
      + "Ogień pozwala zrobić to szybciej.\n\n"
      + "Nie wystarczy, żeby go spalić.\n\n"
      + "Wystarczy, żeby przestał być tak trudny do zabicia.\n\n"
      + "Weź go ze sobą, jeśli możesz.\n\n"
      + "I jeszcze jedno.\n\n"
      + "Kárr nie jest jedynym, który może wstać.\n\n"
      + "To, co zabije draugr, nie zawsze zostaje martwe.\n\n"
      + "Jeśli wejdziesz do jego komory, nie zakładaj, że kiedy pokonasz "
      + "Kárra, będziesz już sam.",
    es: "Kárr era un hombre rico.\n\n"
      + "Tan rico que cuando lo enterraron metieron con él oro, armas y el "
      + "yelmo que llevó en vida.\n\n"
      + "Debía quedarse allí para siempre.\n\n"
      + "Hasta que alguien intentó llevarse el oro.\n\n"
      + "Entonces Kárr abrió los ojos.\n\n"
      + "El hombre que entró en el túmulo no salió.\n\n"
      + "El resto de Haramsey lo hizo por él.\n\n"
      + "Ochenta años después la isla sigue vacía.\n\n"
      + "Y Kárr sigue bajo tierra.\n\n"
      + "Tres cosas.\n\n"
      + "El peso.\n\n"
      + "Los muertos de Haramsey no vuelven como eran.\n\n"
      + "Se hinchan bajo tierra. Crecen. Pesan más de lo que un cuerpo "
      + "debería pesar.\n\n"
      + "Kárr es de los más pesados.\n\n"
      + "Es lento, pero no comete los errores que un hombre vivo comete de "
      + "vez en cuando.\n\n"
      + "No necesita alcanzarte.\n\n"
      + "Le basta con seguir andando.\n\n"
      + "El hierro.\n\n"
      + "Kárr lleva encima más del que querrías ver.\n\n"
      + "Yelmo. Cota. Arma.\n\n"
      + "Los golpes flojos le resbalarán como la lluvia por un tejado.\n\n"
      + "Si quieres herirlo, pega como si de verdad quisieras matarlo.\n\n"
      + "El fuego.\n\n"
      + "El hierro te deja herirlo.\n\n"
      + "El fuego te deja hacerlo más deprisa.\n\n"
      + "No basta para quemarlo.\n\n"
      + "Basta para que deje de ser tan difícil de matar.\n\n"
      + "Llévate algo si puedes.\n\n"
      + "Y una cosa más.\n\n"
      + "Kárr no es el único ahí abajo que puede levantarse.\n\n"
      + "Lo que un draugr mata no siempre sigue muerto.\n\n"
      + "Si entras en su cámara, no des por hecho que vencer a Kárr te deje "
      + "solo en ella.",
  },
};

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
    en: "He is down. What he had goes to Chronos.",
    pl: "On padł. To, co miał, idzie do Chronosa.",
    es: "Ha caído. Lo que tenía va para Chronos.",
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
    en: "Beat the Redcap in the Hermitage echo and bring his bloodied cap to "
      + "Chronos.",
    pl: "Pokonaj Redcapa w echu Hermitage i przynieś jego zakrwawioną czapkę "
      + "Chronosowi.",
    es: "Vence al Redcap en el eco de Hermitage y lleva su gorro ensangrentado "
      + "a Chronos.",
  },
  "mission.title.draugr": {
    en: "The Helm in the Howe",
    pl: "Hełm w kurhanie",
    es: "El yelmo en el túmulo",
  },
  "mission.goal.draugr": {
    en: "Beat Kárr the Old in the howe under Haramsey and bring his helm to "
      + "Chronos.",
    pl: "Pokonaj Kárra Starego w kurhanie pod Haramsey i przynieś jego hełm "
      + "Chronosowi.",
    es: "Vence a Kárr el Viejo en el túmulo bajo Haramsey y lleva su yelmo a "
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
  /* And the same sentence for the half-minute between the kill and the loot.
   * Etap 46 put the relic on the body, so `complete` no longer means "it is
   * in the bag" — for as long as it takes to open the corpse it means "it is
   * lying on him". A quest log that says "it is in your pack" while the thing
   * is still on the floor is the kind of small lie that costs a player ten
   * minutes of searching their inventory. */
  "mission.onBody": {
    en: "It is on his body. Loot him, then take it to Chronos.",
    pl: "Leży na jego ciele. Obszukaj go i zanieś to Chronosowi.",
    es: "Está en su cuerpo. Regístralo y llévaselo a Chronos.",
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
