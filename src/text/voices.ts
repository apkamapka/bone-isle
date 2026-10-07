/**
 * What creatures and townsfolk say out loud (Etap 73).
 *
 * ENGLISH ONLY, on purpose. Chronos is the one voice in the game that is
 * translated: his speech is the story, and a story is worth nothing if it is
 * not understood. A bandit shouting at you is not a story, it is a sound
 * effect with words in it, and it reads the same in every language the way an
 * orc's war cry does.
 *
 * WRITTEN FRESH. None of these is lifted from Tibia, and the smoke suite keeps
 * a list of the lines that would be the obvious ones to lift, so a later pass
 * cannot quietly start copying.
 *
 * SHORT. A bubble is one line over a head at a fixed size; past MAX_LINE
 * characters it starts covering whoever stands beside the speaker. Orcs,
 * goblins and minotaurs speak their own tongues — gibberish written to be
 * pronounceable, not a cipher for anything.
 *
 * The five bosses are silent, and so is Chronos: their words are the
 * chronicles'.
 */
import type { MonsterKind, NpcKey } from "../world/types.ts";

/** A creature talking is orange, over its head. */
export const VOICE_COLOR = "#f0a33a";
/** The longest line a bubble carries. */
export const MAX_LINE = 34;

type Lines = readonly string[];
interface Voice { calm: Lines; hostile: Lines; flee?: Lines }

/* The bottom of the human ladder: hungry, scared, and the only ones who run. */
const VERMIN: Voice = {
  calm: ["Spare a copper, friend?", "Cold night coming...", "Nobody saw nothing.",
    "Keep walking. Nothing here.", "Rats ate better than me today."],
  hostile: ["Easy now... easy...", "I'll cut you, I swear it!", "Just hand it over!",
    "Wrong alley, friend.", "Don't make me do this!"],
  flee: ["Mercy! I've got nothing!", "Not worth it! Not worth it!", "Run, run, RUN!",
    "I yield! I yield!", "You'll never catch me!"],
};
/* The Gallows Coast's working men. */
const ROAD: Voice = {
  calm: ["Toll's due on this road.", "Quiet day. Too quiet.", "Sharpen that blade, lad.",
    "Somebody's coming. Look lively.", "The gallows can wait."],
  hostile: ["Purse on the ground. Now.", "Nobody leaves this road rich.", "Stand and deliver!",
    "Another one for the gallows!", "Your boots look my size."],
};
const WARBAND: Voice = {
  calm: ["Coin first. Then we talk.", "My blade's been thirsty.", "Another day, another war.",
    "Eyes on the treeline."],
  hostile: ["Face me!", "Gold and glory! Mostly gold!", "I've killed better than you!",
    "Hold the line!", "Your skull on my shield!"],
};
const CORSAIR: Voice = {
  calm: ["The tide waits for no one.", "Smell that? Salt and money."],
  hostile: ["Salt and steel!", "Over the rail with you!", "Board 'em!"],
};
const VIKING: Voice = {
  calm: ["The ravens are watching.", "Cold sea, warm mead."],
  hostile: ["The ravens will feast!", "Fight me, or feed the fish!", "Axes up!"],
};
const AMAZON: Voice = {
  calm: ["The forest remembers you.", "Walk softly here."],
  hostile: ["Not one step further!", "You chose the wrong forest.", "Spears ready!"],
};
const HUNTER: Voice = {
  calm: ["Fresh tracks. Still warm.", "Easy... steady..."],
  hostile: ["Hold still, this won't take long.", "Your hide will hang by my fire.", "Right between the eyes."],
};
const GLADIATOR: Voice = {
  calm: ["The crowd is restless.", "Sand in my teeth again."],
  hostile: ["The crowd wants blood!", "Salute, then die!", "Let's give them a show!"],
};
const ORC: Voice = {
  calm: ["Hrok dul gazza.", "Mug-mug. Ruk.", "Vashka tor!", "Grunn... grunn...", "Zugrak mo'tal."],
  hostile: ["RAKKA! RAKKA!", "Dul'gor ushtak!", "Ghaaar! Tuk-tuk!", "Brak na zog!", "KRUSH'NA!"],
};
const GOBLIN: Voice = {
  calm: ["Skritt? Skritt!", "Nik-nik-nik...", "Zibbit shinies...", "Hee hee... tikka."],
  hostile: ["STABBA! STABBA!", "Zik zik zik!", "Nak-nak! Git 'im!", "Tikka-tak! Hee-hee!"],
};
const MINOTAUR: Voice = {
  calm: ["Hmmmrrh.", "Brrrum. Tauro.", "Mhoo... harr.", "Kor-dash."],
  hostile: ["TAUROKH!", "Mhorrr-DAH!", "Harr-kot! Harr-kot!", "BRRRUHM!"],
};
const UNDEAD: Voice = {
  calm: ["Clk... clk... clk...", "Hhhhhaaa...", "So... cold...", "The earth... remembers..."],
  hostile: ["Join... us...", "Warm... blood...", "You too... will rot...", "Hhhrrraaah!"],
};
const SNAKE: Voice = { calm: ["Hssssss..."], hostile: ["Hssssss!", "Sssst!"] };
const DRAGON: Voice = { calm: ["HRRRMMMM..."], hostile: ["HRRRAAAWWR!", "SSSHHHAAAAR!", "KHHHRRRR..."] };
const KNIGHT: Voice = {
  calm: ["The road is closed.", "Steel remembers."],
  hostile: ["Kneel, and it ends quickly.", "Your road ends here.", "I have outlasted kings.",
    "Steel answers steel."],
};

const VOICE_OF: Partial<Record<MonsterKind, Voice>> = {
  beggar: VERMIN, vagrant: VERMIN, thief: VERMIN, poacher: VERMIN, smuggler: VERMIN,
  bandit: ROAD, cutthroat: ROAD, deserter: ROAD, brigand: ROAD, highwayman: ROAD,
  mercenary: WARBAND, wildWarrior: WARBAND, barbarian: WARBAND, raider: WARBAND,
  warlord: WARBAND, chieftain: WARBAND,
  corsair: CORSAIR, viking: VIKING, amazon: AMAZON, hunter: HUNTER, gladiator: GLADIATOR,
  orc: ORC, orcArcher: ORC, orcWarrior: ORC, orcShaman: ORC, orcBerserker: ORC,
  goblin: GOBLIN, goblinLegionary: GOBLIN,
  minotaur: MINOTAUR, minotaurArcher: MINOTAUR, minotaurGuard: MINOTAUR, minotaurMage: MINOTAUR,
  skeleton: UNDEAD, skeletonWarrior: UNDEAD, demonSkeleton: UNDEAD, ghoul: UNDEAD,
  snake: SNAKE, dragon: DRAGON, blackKnight: KNIGHT,
};

/* Bonetown, calling out across the square. Chronos does not. */
const NPC_LINES: Partial<Record<NpcKey, Lines>> = {
  smith: ["Fresh steel! Fair prices!", "Mind the sparks.", "A dull blade gets you killed.",
    "Bring ore, leave with armor."],
  herbalist: ["Herbs for what ails you!", "Mushrooms, fresh from the damp.",
    "Potions now, not funerals later.", "Don't eat the blue ones. Trust me."],
  elder: ["This was a fishing hamlet once.", "Amulets. For the careful ones.",
    "The sea gives. The sea takes.", "Nobody listens. Then they learn."],
  taskmaster: ["Hunters wanted! Coin per head!", "The board won't clear itself.",
    "Bring me proof, not stories.", "Still breathing? Back out there."],
  tailor: ["A hero should look the part!", "New colors, same brave fool.",
    "Mud is not a fashion, darling.", "Hold still. I'm measuring you."],
  morgan: ["Gold to platinum, and back!", "Heavy purse? I can fix that.",
    "Count it twice. I always do.", "Every coin finds its way to me."],
};

const pick = (ls: Lines, rand: () => number): string =>
  ls[Math.min(ls.length - 1, Math.floor(rand() * ls.length))];

/** A line for this creature — angry while it is fighting you — or null. */
export function voiceLine(kind: MonsterKind, hostile: boolean, rand: () => number = Math.random): string | null {
  const v = VOICE_OF[kind];
  if (!v) return null;
  const ls = hostile ? v.hostile : v.calm;
  return ls.length ? pick(ls, rand) : null;
}

/** What a coward cries as it breaks and runs, or null for everyone else. */
export function fleeLine(kind: MonsterKind, rand: () => number = Math.random): string | null {
  const ls = VOICE_OF[kind]?.flee;
  return ls && ls.length ? pick(ls, rand) : null;
}

/** A townsperson's call, or null for one who keeps quiet. */
export function npcLine(key: NpcKey, rand: () => number = Math.random): string | null {
  const ls = NPC_LINES[key];
  return ls && ls.length ? pick(ls, rand) : null;
}

/** Everything anybody can say — the tests' window onto this file. */
export function allVoiceLines(): string[] {
  const out = new Set<string>();
  for (const v of Object.values(VOICE_OF)) {
    if (!v) continue;
    for (const l of [...v.calm, ...v.hostile, ...(v.flee ?? [])]) out.add(l);
  }
  for (const ls of Object.values(NPC_LINES)) if (ls) for (const l of ls) out.add(l);
  return [...out];
}
