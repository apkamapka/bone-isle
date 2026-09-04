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
  /* Etap 52 — the third door. THE POLISH IS RADEK'S OWN and is copied in
   * unchanged, beat for beat; English and Spanish are rebuilt to the same beat
   * count rather than translated line by line, which is the house rule.
   *
   * "TRZECIE WROTA" IS CORRECT and I queried it wrongly. Chronos numbers
   * DOORS, not links in the chain: Calanais is the gift errand and he opens it
   * with "before we begin properly" rather than a number, so the redcap is the
   * first door, Kárr the second, and this is the third — even though it is the
   * fourth mission.
   *
   * THE HAND-IN LINE BECAME LITERAL. "For hundreds of years it was enough that
   * people feared her more than she feared them" was written before the relic
   * was decided, and the relic turned it from a moral into a fact: what the
   * player carries back is the effigy she kept in the oak so the county could
   * go on seeing her on the nights she was asleep. Nothing in the beat had to
   * change for that to land, which is why it did not. */
  "sage.offer.blackannis": {
    en: "The third door.\n\n"
      + "Leicestershire. There is a cave under an old oak there that the locals have long since stopped calling by name.\n\n"
      + "They say Black Annis lives in it.\n\n"
      + "They also say she was a woman once.\n\n"
      + "One of those two claims is probably true.",
    pl: "Trzecie wrota.\n\n"
      + "Leicestershire. Jest tam jaskinia pod starym dębem, której miejscowi od dawna nie nazywają po imieniu.\n\n"
      + "Mówią, że mieszka w niej Black Annis.\n\n"
      + "Mówią też, że kiedyś była kobietą.\n\n"
      + "Jedno z tych dwóch twierdzeń jest prawdopodobnie prawdą.",
    es: "La tercera puerta.\n\n"
      + "Leicestershire. Hay allí una cueva bajo un roble viejo que los vecinos hace mucho que no llaman por su nombre.\n\n"
      + "Dicen que en ella vive Black Annis.\n\n"
      + "Dicen también que alguna vez fue mujer.\n\n"
      + "Una de esas dos afirmaciones es probablemente cierta.",
  },
  "sage.accept.blackannis": {
    en: "Once, when children went missing from the villages around, people barred their doors before sundown.\n\n"
      + "It did not help.\n\n"
      + "Black Annis came out at night and took whoever she found outside.\n\n"
      + "Then they began leaving food under the oak.\n\n"
      + "That worked.\n\n"
      + "For a while.\n\n"
      + "Go down into her cave and end the story.",
    pl: "Dawniej, kiedy dzieci znikały z okolicznych wiosek, ludzie zamykali drzwi przed zachodem słońca.\n\n"
      + "Nie pomagało.\n\n"
      + "Black Annis wychodziła nocą i zabierała tych, których znalazła poza domem.\n\n"
      + "Potem zaczęli zostawiać jedzenie pod dębem.\n\n"
      + "Zadziałało.\n\n"
      + "Przez jakiś czas.\n\n"
      + "Zejdź do jej jaskini i zakończ tę historię.",
    es: "Antes, cuando los niños desaparecían de las aldeas cercanas, la gente atrancaba las puertas antes del ocaso.\n\n"
      + "No servía de nada.\n\n"
      + "Black Annis salía de noche y se llevaba a quien encontrara fuera de casa.\n\n"
      + "Luego empezaron a dejar comida bajo el roble.\n\n"
      + "Eso funcionó.\n\n"
      + "Durante un tiempo.\n\n"
      + "Baja a su cueva y termina esta historia.",
  },
  "sage.decline.blackannis": {
    en: "Sensible.\n\n"
      + "The locals did the same for years.\n\n"
      + "They barred the door and hoped she would pick somebody else this time.",
    pl: "Rozsądnie.\n\n"
      + "Miejscowi przez lata robili to samo.\n\n"
      + "Zamykali drzwi i liczyli, że tym razem wybierze kogoś innego.",
    es: "Razonable.\n\n"
      + "Los vecinos hicieron lo mismo durante años.\n\n"
      + "Atrancaban la puerta y confiaban en que esta vez eligiera a otro.",
  },
  "sage.remind.blackannis": {
    en: "The old oak. The cave beneath it.\n\n"
      + "If you find tracks leading in, follow them.\n\n"
      + "If you find tracks leading out...\n\n"
      + "make sure there is only one set.",
    pl: "Stary dąb. Jaskinia pod nim.\n\n"
      + "Jeśli znajdziesz ślady prowadzące do środka, idź za nimi.\n\n"
      + "Jeśli znajdziesz ślady prowadzące na zewnątrz...\n\n"
      + "upewnij się, że są tylko jedne.",
    es: "El roble viejo. La cueva debajo.\n\n"
      + "Si encuentras huellas que entran, síguelas.\n\n"
      + "Si encuentras huellas que salen...\n\n"
      + "asegúrate de que sean unas solas.",
  },
  "sage.handIn.blackannis": {
    en: "So she could be quieted after all.\n\n"
      + "For hundreds of years it was enough that people feared her more than she feared them.\n\n"
      + "Now the fear is on the other side of the door.\n\n"
      + "Good.\n\n"
      + "That is one story fewer to tell.",
    pl: "Więc jednak można było ją uciszyć.\n\n"
      + "Przez setki lat wystarczało, że ludzie bali się jej bardziej, niż ona bała się ich.\n\n"
      + "Teraz strach został po drugiej stronie wrót.\n\n"
      + "Dobrze.\n\n"
      + "To jedna historia mniej do opowiedzenia.",
    es: "Así que sí se la podía acallar.\n\n"
      + "Durante siglos bastó con que la gente le temiera más de lo que ella les temía.\n\n"
      + "Ahora el miedo se quedó al otro lado de la puerta.\n\n"
      + "Bien.\n\n"
      + "Una historia menos que contar.",
  },
  "sage.empty.blackannis": {
    en: "You came back.\n\n"
      + "Black Annis did not.\n\n"
      + "That is not how this was meant to go.\n\n"
      + "The door is still open. Go back and finish what you started.",
    pl: "Wróciłeś.\n\n"
      + "A Black Annis nie.\n\n"
      + "Nie tak miało być.\n\n"
      + "Wrota wciąż są otwarte. Wróć tam i dokończ, co zacząłeś.",
    es: "Has vuelto.\n\n"
      + "Black Annis no.\n\n"
      + "No es así como debía terminar.\n\n"
      + "La puerta sigue abierta. Vuelve y acaba lo que empezaste.",
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
  "lore.title.blackannis": {
    en: "Dane Hills — 1794",
    pl: "Dane Hills — 1794",
    es: "Dane Hills — 1794",
  },
  /* The chronicle. Same build as Kárr's: a page told in beats, ending in the
   * three things it promises about the fight — and all three are stats in
   * MONSTER_DEFS rather than colour, so the page cannot quietly go out of date
   * without the smoke suite saying so. Speed level with the redcap, no iron on
   * her, and earth as the answer.
   *
   * The last beat is the one the folklore actually hands over: she scooped the
   * bower out of sandstone with her nails and it was the locals filling that
   * same rock back in that ended her, not a hero. That is why `resist.earth`
   * is 1.5 and why it is hers rather than a third helping of fire. */
  "lore.blackannis": {
    en: "The Dane Hills lie two miles west of Leicester.\n\n"
      + "It was waste ground once: low sandstone rises, gorse, and one cave.\n\n"
      + "They called it the Bower.\n\n"
      + "A pollard oak grew out of a cleft in the rock above the mouth of it.\n\n"
      + "They said she sat in its branches and waited.\n\n"
      + "That she had scratched the cave out with her own nails.\n\n"
      + "That her howling carried for miles.\n\n"
      + "And that this was good news, because it bought you time to bar the door.\n\n"
      + "The cottages around there were built with very small windows.\n\n"
      + "That part is true and can still be checked.\n\n"
      + "The reason cannot.\n\n"
      + "Every Easter Monday the mayor of Leicester rode out into the fields.\n\n"
      + "They dragged a dead cat soaked in aniseed from her cave to his door.\n\n"
      + "They did it for a hundred and seventy years and nobody wrote down why.\n\n"
      + "There are two stories about who she was.\n\n"
      + "In the first she is what is left of a Celtic goddess, and the cave was a place of worship before it was a place of fear.\n\n"
      + "In the second her name was Agnes Scott, an anchoress, who really did live in a cave in these hills.\n\n"
      + "A hundred years later all anyone remembered was that she sat there.\n\n"
      + "In the end they filled the cave in. Not to kill her — to stop people talking.\n\n"
      + "Three things.\n\n"
      + "She is fast. As fast as the one in the red cap, and nobody has outrun him.\n\n"
      + "She wears no iron, so every heavy blow counts for all of itself.\n\n"
      + "And she gives way to stone. She dug that sandstone out with her nails, and stone is what covered her.",
    pl: "Dane Hills leżą dwie mile na zachód od Leicester.\n\n"
      + "Kiedyś było tam pustkowie: niskie wzgórza z piaskowca, janowiec i jedna jaskinia.\n\n"
      + "Nazywali ją Bower.\n\n"
      + "Nad wejściem, ze szczeliny w skale, rósł ogławiany dąb.\n\n"
      + "Mówiono, że siedziała w jego konarach i czekała.\n\n"
      + "Że jaskinię wydrapała własnymi paznokciami.\n\n"
      + "Że jej wycie słychać było z wielu mil.\n\n"
      + "I że to dobra wiadomość, bo daje czas na zaryglowanie drzwi.\n\n"
      + "Chaty w tej okolicy budowano z bardzo małymi oknami.\n\n"
      + "To akurat prawda i można sprawdzić do dziś.\n\n"
      + "Powodu sprawdzić się nie da.\n\n"
      + "Co roku w Wielkanocny Poniedziałek burmistrz Leicester wyjeżdżał w pole.\n\n"
      + "Ciągnęli martwego kota natartego anyżem od jej groty pod jego drzwi.\n\n"
      + "Robili to przez sto siedemdziesiąt lat i nikt nie zapisał, po co.\n\n"
      + "Są dwie opowieści o tym, kim była.\n\n"
      + "W pierwszej jest resztką celtyckiej bogini, a grota była miejscem czci, zanim stała się miejscem strachu.\n\n"
      + "W drugiej nazywała się Agnes Scott, była pustelnicą i naprawdę mieszkała w jaskini w tych wzgórzach.\n\n"
      + "Sto lat później pamiętano już tylko, że siedziała.\n\n"
      + "W końcu zasypali grotę ziemią. Nie po to, żeby ją zabić — żeby przestano o niej mówić.\n\n"
      + "Trzy rzeczy.\n\n"
      + "Jest szybka. Tak szybka jak ten w czerwonej czapce, a jemu nikt nie uciekł.\n\n"
      + "Nie ma na sobie żelaza, więc każde ciężkie uderzenie liczy się całe.\n\n"
      + "I ustępuje kamieniowi. Przekopała się przez ten piaskowiec paznokciami, a to on ją przykrył.",
    es: "Las Dane Hills están dos millas al oeste de Leicester.\n\n"
      + "Antes era un yermo: lomas bajas de arenisca, aulaga y una sola cueva.\n\n"
      + "La llamaban el Bower.\n\n"
      + "Sobre la boca crecía un roble desmochado, salido de una grieta de la roca.\n\n"
      + "Decían que se sentaba en sus ramas y esperaba.\n\n"
      + "Que había excavado la cueva con sus propias uñas.\n\n"
      + "Que su aullido se oía a millas.\n\n"
      + "Y que era una buena noticia, porque daba tiempo a atrancar la puerta.\n\n"
      + "Las casas de por allí se construían con ventanas muy pequeñas.\n\n"
      + "Eso sí es cierto y aún puede comprobarse.\n\n"
      + "El motivo no.\n\n"
      + "Cada Lunes de Pascua el alcalde de Leicester salía a caballo al campo.\n\n"
      + "Arrastraban un gato muerto empapado en anís desde su cueva hasta la puerta de él.\n\n"
      + "Lo hicieron ciento setenta años y nadie anotó para qué.\n\n"
      + "Hay dos historias sobre quién fue.\n\n"
      + "En la primera es lo que queda de una diosa celta, y la cueva fue lugar de culto antes de ser lugar de miedo.\n\n"
      + "En la segunda se llamaba Agnes Scott, anacoreta, que de verdad vivió en una cueva de estas colinas.\n\n"
      + "Cien años después solo se recordaba que estaba allí sentada.\n\n"
      + "Al final rellenaron la cueva. No para matarla — para que dejaran de hablar.\n\n"
      + "Tres cosas.\n\n"
      + "Es rápida. Tan rápida como el de la gorra roja, y a él nadie lo ha dejado atrás.\n\n"
      + "No lleva hierro, así que cada golpe pesado cuenta entero.\n\n"
      + "Y cede ante la piedra. Excavó esa arenisca con las uñas, y fue la piedra la que la tapó.",
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
  /* ---------------- Calanais: the gift-errand, level 8 ----------------
   *
   * Polish is the original and English and Spanish are rebuilt to its beat,
   * not translated off it — same number of lines, same breath in the same
   * places, one image per line. Blank lines are page breaks in the box.
   *
   * He does not say which element to take, in any language, and that is the
   * whole discipline of these strings. The choice is permanent and it is the
   * player's; a sage who nudged would be making it for them. */
  "mission.title.calanais": {
    en: "The Circles of Calanais",
    pl: "Kręgi Calanais",
    es: "Los Círculos de Calanais",
  },
  "mission.goal.calanais": {
    en: "Cross Calanais, go down into the sanctum and choose one of the five "
      + "element circles. Then return to Chronos.",
    pl: "Przejdź przez Calanais, zejdź do sanktuarium i wybierz jeden z pięciu "
      + "kręgów żywiołów. Następnie wróć do Chronosa.",
    es: "Cruza Calanais, baja al santuario y elige uno de los cinco círculos "
      + "elementales. Luego vuelve con Chronos.",
  },
  "sage.offer.calanais": {
    en: "Before we begin in earnest, I have something for you that money does "
      + "not buy.\n\n"
      + "On Calanais stand stones older than the kingdoms that tried to name "
      + "them. Beneath them somebody built a room where five fires are still "
      + "burning.\n\n"
      + "Fire. Water. Lightning. Earth. Wind.\n\n"
      + "You may step into one only.\n\n"
      + "When you choose, the rest go out.\n\n"
      + "So do not choose the one that looks best.\n\n"
      + "Choose the one you want to live with.",
    pl: "Zanim zaczniemy na dobre, mam dla ciebie coś, czego nie da się "
      + "kupić.\n\n"
      + "Na wyspie Calanais stoją kamienie starsze od królestw, które próbowały "
      + "je nazwać. Pod nimi zbudowano miejsce, w którym wciąż płonie pięć "
      + "ognisk.\n\n"
      + "Ogień. Woda. Błyskawice. Ziemia. Wiatr.\n\n"
      + "Możesz wejść tylko w jedno.\n\n"
      + "Kiedy wybierzesz, pozostałe zgasną.\n\n"
      + "Więc nie wybieraj tego, który wygląda najładniej.\n\n"
      + "Wybierz ten, z którym chcesz zostać.",
    es: "Antes de empezar de verdad, tengo algo para ti que no se compra.\n\n"
      + "En Calanais hay piedras más viejas que los reinos que intentaron "
      + "nombrarlas. Debajo levantaron una sala donde siguen ardiendo cinco "
      + "fuegos.\n\n"
      + "Fuego. Agua. Relámpago. Tierra. Viento.\n\n"
      + "Sólo puedes entrar en uno.\n\n"
      + "Cuando elijas, los demás se apagarán.\n\n"
      + "Así que no elijas el que mejor se vea.\n\n"
      + "Elige aquel con el que quieras quedarte.",
  },
  "sage.accept.calanais": {
    en: "The gate is open.\n\n"
      + "Calanais is not as empty today as it once was.\n\n"
      + "Somebody went in before you.\n\n"
      + "And plainly never found the way back.\n\n"
      + "Cross the bridge. Then go down beneath the temple.\n\n"
      + "You will see five circles.\n\n"
      + "The rest you will work out yourself.",
    pl: "Wrota są otwarte.\n\n"
      + "Calanais nie jest dziś tak puste, jak było kiedyś.\n\n"
      + "Ktoś tam wszedł przed tobą.\n\n"
      + "I najwyraźniej nigdy nie znalazł drogi powrotnej.\n\n"
      + "Przejdź przez most. Potem zejdź pod świątynię.\n\n"
      + "Zobaczysz pięć kręgów.\n\n"
      + "Resztę zrozumiesz sam.",
    es: "La puerta está abierta.\n\n"
      + "Calanais no está hoy tan vacío como estuvo.\n\n"
      + "Alguien entró antes que tú.\n\n"
      + "Y por lo visto nunca encontró la vuelta.\n\n"
      + "Cruza el puente. Luego baja bajo el templo.\n\n"
      + "Verás cinco círculos.\n\n"
      + "El resto lo entenderás tú solo.",
  },
  "sage.decline.calanais": {
    en: "Very well.\n\n"
      + "Not every gift has to be taken.\n\n"
      + "The circles burned long before us.\n\n"
      + "If you change your mind, they will be there.",
    pl: "Dobrze.\n\n"
      + "Nie każdy prezent trzeba przyjąć.\n\n"
      + "Kręgi płonęły na długo przed nami.\n\n"
      + "Jeśli zmienisz zdanie, będą tam.",
    es: "Está bien.\n\n"
      + "No todo regalo hay que aceptarlo.\n\n"
      + "Los círculos ardían mucho antes que nosotros.\n\n"
      + "Si cambias de idea, allí estarán.",
  },
  "sage.remind.calanais": {
    en: "Calanais.\n\n"
      + "Go down under the stones and find five circles.\n\n"
      + "One will be yours.\n\n"
      + "Do not ask me which. If I wanted to choose for you, I would not have "
      + "given you a choice.",
    pl: "Calanais.\n\n"
      + "Zejdź pod kamienie i znajdź pięć kręgów.\n\n"
      + "Jeden będzie twój.\n\n"
      + "Nie pytaj mnie, który wybrać. Gdybym chciał wybrać za ciebie, nie "
      + "dałbym ci wyboru.",
    es: "Calanais.\n\n"
      + "Baja bajo las piedras y encuentra cinco círculos.\n\n"
      + "Uno será tuyo.\n\n"
      + "No me preguntes cuál. Si quisiera elegir por ti, no te habría dado a "
      + "elegir.",
  },
  /* Said on the stair, on the cellar side of the jump, every descent. He names
   * the five and refuses to recommend one — the five are a MENU, and the line
   * that gives each a temperament is the closest he comes to a hint. */
  "sage.descend.calanais": {
    en: "You can see them now.\n\n"
      + "Do not go near yet.\n\n"
      + "Walk around them.\n\n"
      + "Look at what is burning.\n\n"
      + "Red remembers fire. Blue — water. Yellow has no patience for quiet. "
      + "Brown holds to the ground. The pale one... is always trying to "
      + "leave.\n\n"
      + "Five elements.\n\n"
      + "One place for you.\n\n"
      + "When you step in, the other four go out.\n\n"
      + "And they will never light for you again.",
    pl: "Już je widzisz.\n\n"
      + "Nie podchodź jeszcze.\n\n"
      + "Obejdź je.\n\n"
      + "Przyjrzyj się temu, co płonie.\n\n"
      + "Czerwień pamięta ogień. Błękit — wodę. Żółć nie lubi ciszy. Brąz "
      + "trzyma się ziemi. Ten blady... zawsze próbuje uciec.\n\n"
      + "Pięć żywiołów.\n\n"
      + "Jedno miejsce dla ciebie.\n\n"
      + "Kiedy wejdziesz, pozostałe cztery zgasną.\n\n"
      + "I nie zapalą się już dla ciebie nigdy.",
    es: "Ya los ves.\n\n"
      + "No te acerques todavía.\n\n"
      + "Rodéalos.\n\n"
      + "Mira lo que arde.\n\n"
      + "El rojo recuerda el fuego. El azul — el agua. El amarillo no soporta "
      + "el silencio. El marrón se aferra a la tierra. El pálido... siempre "
      + "intenta irse.\n\n"
      + "Cinco elementos.\n\n"
      + "Un sitio para ti.\n\n"
      + "Cuando entres, los otros cuatro se apagarán.\n\n"
      + "Y ya nunca volverán a encenderse para ti.",
  },
  /* Said standing in the circle, the instant it takes. Not a reward speech —
   * the reward speech is at his table. This is the door closing.
   *
   * It opens on a beat of nothing but an ellipsis, which is deliberate and is
   * why it is three dots rather than the one-character "…": the box is drawn
   * in Courier New, so a single glyph would occupy one narrow cell and read as
   * a typo. Three cells read as a pause. */
  "sage.attuned.calanais": {
    en: "...\n\n"
      + "Do you feel it?\n\n"
      + "Good.\n\n"
      + "Now you know why I made you choose alone.\n\n"
      + "Come back to me.\n\n"
      + "I want to see what you have done with what I gave you.",
    pl: "...\n\n"
      + "Czujesz to?\n\n"
      + "Dobrze.\n\n"
      + "Teraz już wiesz, dlaczego kazałem ci wybrać samemu.\n\n"
      + "Wróć do mnie.\n\n"
      + "Chcę zobaczyć, co zrobiłeś z tym, co ci dałem.",
    es: "...\n\n"
      + "¿Lo sientes?\n\n"
      + "Bien.\n\n"
      + "Ahora sabes por qué te hice elegir solo.\n\n"
      + "Vuelve a mí.\n\n"
      + "Quiero ver qué has hecho con lo que te di.",
  },
  "sage.handIn.calanais": {
    en: "I see it.\n\n"
      + "Not bad.\n\n"
      + "Raise the Alchemy Tower on your island. There you will learn to carry "
      + "that element further — into arrowheads, into shards, into whatever "
      + "else comes of it.\n\n"
      + "Only remember: an element does not try to punch through armour.\n\n"
      + "It looks for what is underneath it.\n\n"
      + "And now, enough gifts.\n\n"
      + "I have another gate for you.",
    pl: "Widzę.\n\n"
      + "Nieźle.\n\n"
      + "Postaw na swojej wyspie Wieżę Alchemiczną. Tam nauczysz się prowadzić "
      + "ten żywioł dalej — w groty, odłamki i wszystko, co jeszcze z niego "
      + "powstanie.\n\n"
      + "Pamiętaj tylko: żywioł nie próbuje przebić pancerza.\n\n"
      + "Szuka tego, co jest pod nim.\n\n"
      + "A teraz wystarczy prezentów.\n\n"
      + "Mam dla ciebie kolejne wrota.",
    es: "Lo veo.\n\n"
      + "Nada mal.\n\n"
      + "Levanta la Torre de Alquimia en tu isla. Allí aprenderás a llevar ese "
      + "elemento más lejos — a puntas, a esquirlas, a todo lo que salga de "
      + "él.\n\n"
      + "Recuerda sólo una cosa: un elemento no intenta atravesar la "
      + "armadura.\n\n"
      + "Busca lo que hay debajo.\n\n"
      + "Y ahora, basta de regalos.\n\n"
      + "Tengo otra puerta para ti.",
  },
  /* Reached by walking down to the sanctum and coming back up without standing
   * in anything — the errand has no relic to lose, so this is the only way to
   * return empty-handed. */
  "sage.empty.calanais": {
    en: "You went all the way down under the temple and came back with "
      + "nothing.\n\n"
      + "The circles are still burning.\n\n"
      + "Next time, step into one.",
    pl: "Zszedłeś aż pod świątynię i wróciłeś bez niczego.\n\n"
      + "Kręgi wciąż płoną.\n\n"
      + "Następnym razem wejdź do jednego.",
    es: "Bajaste hasta debajo del templo y volviste sin nada.\n\n"
      + "Los círculos siguen ardiendo.\n\n"
      + "La próxima vez, entra en uno.",
  },
  "lore.title.calanais": {
    en: "The Circles of Calanais",
    pl: "Kręgi Calanais",
    es: "Los Círculos de Calanais",
  },
  "lore.calanais": {
    en: "They raised the stones on Lewis before Egypt cut its first block.\n\n"
      + "Nobody wrote down why.\n\n"
      + "The people who came after said the stones were giants who would not "
      + "kneel, and were left standing for it.\n\n"
      + "They said that at midsummer something walks the avenue.\n\n"
      + "Under the ring there is a chamber, and in the chamber five fires that "
      + "nobody lit.\n\n"
      + "They have not gone out.",
    pl: "Postawili kamienie na Lewis, zanim Egipt uciął pierwszy blok.\n\n"
      + "Nikt nie zapisał, po co.\n\n"
      + "Ci, co przyszli później, mówili, że kamienie to olbrzymy, które nie "
      + "chciały klęknąć, i za to zostały tak stać.\n\n"
      + "Mówili, że w przesilenie ktoś idzie aleją.\n\n"
      + "Pod kręgiem jest komora, a w komorze pięć ogni, których nikt nie "
      + "rozpalił.\n\n"
      + "Nie zgasły.",
    es: "Levantaron las piedras en Lewis antes de que Egipto cortara su primer "
      + "bloque.\n\n"
      + "Nadie escribió para qué.\n\n"
      + "Los que vinieron después decían que las piedras eran gigantes que no "
      + "quisieron arrodillarse, y por eso quedaron de pie.\n\n"
      + "Decían que en el solsticio algo recorre la avenida.\n\n"
      + "Bajo el círculo hay una cámara, y en la cámara cinco fuegos que nadie "
      + "encendió.\n\n"
      + "No se han apagado.",
  },
  /* The refusal when a character already holds the element they walked into.
   * Unreachable today — one errand, one element — and cheap insurance for the
   * day a second source exists. */
  "attune.already": {
    en: "you already carry this one",
    pl: "ten już w tobie jest",
    es: "ya llevas éste",
  },
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
  "mission.title.blackannis": {
    en: "The Effigy in the Oak",
    pl: "Kukła w dębie",
    es: "El muñeco en el roble",
  },
  "mission.goal.blackannis": {
    en: "Find Black Annis' cave under the Dane Hills, beat the hag, and bring the effigy to Chronos.",
    pl: "Odnajdź jaskinię Black Annis pod Dane Hills, pokonaj wiedźmę i przynieś kukłę Chronosowi.",
    es: "Encuentra la cueva de Black Annis bajo las Dane Hills, vence a la bruja y lleva el muñeco a Chronos.",
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
