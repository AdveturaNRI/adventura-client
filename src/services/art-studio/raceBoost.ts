/**
 * Flux слабо читает русские расы («эльфийка» → обычная женщина).
 * Разворачиваем маркеры в явные EN-анатомические токены и ставим их в начало промпта.
 *
 * Важно: в JS `\b` почти не работает с кириллицей — границы только через lookahead/lookbehind
 * или просто substring-match по более длинным формам сначала.
 */

type RaceBoost = {
  match: RegExp;
  token: string;
};

const RACE_BOOSTS: RaceBoost[] = [
  {
    match: /дроу|тёмн\w*\s*эльф|темн\w*\s*эльф|drow|dark\s*elf/i,
    token:
      'drow dark elf, long pointed elf ears clearly visible outside the hair, white or silver hair, dark grey-purple skin, crimson or violet eyes, non-human elven features',
  },
  {
    match: /эладрин|eladrin/i,
    token:
      'eladrin fey elf, long pointed ears visible outside the hair, luminous otherworldly eyes, seasonal fey aura, non-human elven face',
  },
  {
    match: /эльфийк|эльфов|эльф|high\s*elf|wood\s*elf|sea\s*elf|(?<![a-z])elf(?![a-z])|elven|elfish/i,
    token:
      'woodland fantasy elf ranger, long sharply pointed elf ears visible, non-human elven anatomy, slender athletic build',
  },
  {
    match: /дварфик|дварф|dwarf|dwarven/i,
    token:
      'fantasy dwarf, short stocky build cues, broad nose, thick brow, braided beard when male, non-human dwarven face',
  },
  {
    match: /гномик|гномк|гном|gnome/i,
    token:
      'fantasy gnome, large bright eyes, oversized pointed nose, small stature cues, whimsical non-human gnome face',
  },
  {
    match: /орчих|орк|orcess|(?<![a-z])orc(?![a-z])|orcs/i,
    token:
      'fantasy orc, prominent lower tusks, green or grey skin, heavy jaw, pointed ears, unmistakably non-human orc face',
  },
  {
    match: /тифлинг|tiefling/i,
    token:
      'tiefling, curved horns on forehead clearly visible, pointed tail hint, demonic heritage face, non-human horns in frame',
  },
  {
    match: /драконорожд|dragonborn/i,
    token:
      'dragonborn humanoid dragon face, snout scales horns, reptilian eyes, non-human dragonborn head',
  },
  {
    match: /табакси|tabaxi/i,
    token:
      'tabaxi catfolk, feline face muzzle whiskers, furred skin, cat ears on head clearly visible, non-human',
  },
  {
    match: /кенку|kenku/i,
    token: 'kenku crowfolk, avian beak face, feathered head, bird eyes, non-human kenku',
  },
  {
    match: /гоблин|goblin/i,
    token:
      'fantasy goblin, oversized pointed ears, sharp teeth, green skin, small cunning non-human face',
  },
  {
    match: /аасимар|aasimar/i,
    token:
      'aasimar celestial humanoid, subtle glowing eyes, luminous skin undertone, faintly divine non-mundane face',
  },
  {
    match: /тритон|triton/i,
    token:
      'triton sea folk, fin-like ears, blue-green skin, aquatic non-human features',
  },
  {
    match: /юань[\s-]?ти|yuan[\s-]?ti/i,
    token:
      'yuan-ti snakefolk, serpentine eyes, scales on face, faintly reptilian non-human features',
  },
  {
    match: /кобольд|kobold/i,
    token:
      'kobold small dragonfolk, snout horns scales, reptilian non-human face',
  },
  {
    match: /фирболг|firbolg/i,
    token:
      'firbolg giantfolk, broad gentle face, large pointed ears, blue-grey skin undertone, non-human',
  },
  {
    match: /багбир|bugbear/i,
    token:
      'bugbear, furred face, large pointed ears, beastly goblinoid features, non-human',
  },
  {
    match: /гитиянки|githyanki|(?<![a-z])gith(?![a-z])/i,
    token:
      'githyanki, yellow-spotted skin, sharp gaunt non-human face, distinctive gith features',
  },
  {
    match: /полурослик|halfling|hobbit/i,
    token:
      'halfling smallfolk, youthful round face, slightly pointed ears, short stature readable, fantasy halfling',
  },
];

const PORTRAIT_FANTASY_LOCK =
  'fantasy RPG character portrait, distinct non-generic face, species-defining traits readable at a glance';

const HUMAN_GUARD = /человек|людск|human|(?<![a-z])woman(?![a-z])|(?<![a-z])man(?![a-z])|девушка|парень|женщина|мужчина/i;

/**
 * Возвращает EN-буст расы или пустую строку.
 */
export function extractRaceBoost(
  userPrompt: string,
  entityId: string,
): string | undefined {
  const text = userPrompt.trim();
  if (!text) return undefined;

  for (const boost of RACE_BOOSTS) {
    if (boost.match.test(text)) {
      return boost.token;
    }
  }

  if (entityId === 'portrait' && !HUMAN_GUARD.test(text)) {
    return PORTRAIT_FANTASY_LOCK;
  }

  return undefined;
}

/** Пол из явных RU/EN маркеров */
export function extractGenderBoost(userPrompt: string): string | undefined {
  const text = userPrompt.trim();
    if (/эльфийка|дварфика|орчиха|женщина|девушка|девочка|(?<![a-z])female(?![a-z])|(?<![a-z])woman(?![a-z])|(?<![a-z])girl(?![a-z])/i.test(text)) {
    return 'young adult woman, female character, feminine features, NOT a man, NOT male, NOT beard';
  }
  return undefined;
}
