import type { ArtCameraId, ArtEntityId } from './types';

export type PromptIntent = {
  gender: 'female' | 'male' | 'unspecified';
  hair?: string;
  race?: string;
  activity?: string;
  weapons: string[];
  setting?: string;
  wantsFullBody: boolean;
  peaceful: boolean;
};

function detectGender(text: string): PromptIntent['gender'] {
  if (
    /эльфийка|дварфика|орчиха|женщина|девушка|девочка|female|woman|girl\b/i.test(
      text,
    )
  ) {
    return 'female';
  }
  if (/мужчина|парень|male|man\b|boy\b/i.test(text) && !/woman|female/i.test(text)) {
    return 'male';
  }
  return 'unspecified';
}

function detectHair(text: string): string | undefined {
  if (/рыж|redhead|ginger|auburn/i.test(text)) {
    return 'vivid ginger-red hair, bright copper auburn hair';
  }
  if (/блонд|blonde|blond/i.test(text)) return 'blonde hair';
  if (/брюнет|чёрн\w*\s*волос|черн\w*\s*волос|black[\s-]?hair/i.test(text)) {
    return 'black hair';
  }
  if (/шатен|каштан|brown[\s-]?hair|chestnut/i.test(text)) return 'chestnut brown hair';
  if (/седы|серебр\w*\s*волос|silver[\s-]?hair|white[\s-]?hair/i.test(text)) {
    return 'silver-white hair';
  }
  return undefined;
}

function detectRace(text: string): string | undefined {
  if (/дроу|drow|dark\s*elf/i.test(text)) return 'drow dark elf';
  if (/эльф|elf|elven/i.test(text)) return 'woodland fantasy elf with long pointed ears';
  if (/дварф|dwarf/i.test(text)) return 'fantasy dwarf';
  if (/гном|gnome/i.test(text)) return 'fantasy gnome';
  if (/орк|orc/i.test(text)) return 'fantasy orc';
  if (/тифлинг|tiefling/i.test(text)) return 'tiefling with horns';
  if (/драконорожд|dragonborn/i.test(text)) return 'dragonborn';
  return undefined;
}

function detectActivity(text: string): string | undefined {
  if (/читает|книг|reading|book\b/i.test(text)) {
    return 'quietly reading an open book held in both hands';
  }
  if (/сид|sitting|сидя/i.test(text)) return 'sitting calmly';
  if (/бежит|running/i.test(text)) return 'running';
  if (/сраж|fighting|бой/i.test(text)) return 'in combat stance';
  return undefined;
}

function detectWeapons(text: string): string[] {
  const weapons: string[] = [];
  if (/лук|bow\b|longbow|shortbow/i.test(text)) {
    weapons.push('holding one longbow by the grip');
  }
  if (/меч|sword/i.test(text)) {
    weapons.push('holding one sword by the hilt');
  }
  if (/топор|axe\b/i.test(text)) {
    weapons.push('holding one axe by the handle');
  }
  if (/посох|staff\b/i.test(text)) {
    weapons.push('holding one mage staff');
  }
  if (/щит|shield/i.test(text)) {
    weapons.push('holding one shield');
  }
  return weapons;
}

function detectSetting(text: string): string | undefined {
  if (/лес|рощ|чащ|forest|woods/i.test(text)) return 'in a quiet fantasy forest';
  if (/таверн|tavern|inn\b/i.test(text)) return 'inside a cozy fantasy tavern';
  if (/подземел|dungeon|пещер|cave/i.test(text)) return 'in a fantasy dungeon';
  if (/библиотек|library/i.test(text)) return 'in a candlelit library';
  return undefined;
}

export function parsePromptIntent(userPrompt: string): PromptIntent {
  const text = userPrompt.trim();
  const activity = detectActivity(text);
  const weapons = detectWeapons(text);
  const peaceful =
    Boolean(activity && /reading|book|sitting|quietly/i.test(activity)) &&
    weapons.length === 0;

  return {
    gender: detectGender(text),
    hair: detectHair(text),
    race: detectRace(text),
    activity,
    weapons,
    setting: detectSetting(text),
    wantsFullBody: /полн\w*\s*рост|во весь рост|full[\s-]?body|fullbody/i.test(text),
    peaceful,
  };
}

/**
 * Короткий EN-lead. Schnell/дешёвые модели сдыхают на длинном супе токенов
 * и скатываются в «седого эльфа-воина».
 */
export function buildLeadPrompt(
  userPrompt: string,
  cameraId: ArtCameraId,
  _entityId: ArtEntityId,
): string {
  const intent = parsePromptIntent(userPrompt);
  const chunks: string[] = [];

  if (intent.gender === 'female') {
    chunks.push('a young adult woman', 'female', 'feminine face');
  } else if (intent.gender === 'male') {
    chunks.push('an adult man', 'male');
  }

  if (intent.race) chunks.push(intent.race);
  if (intent.hair) {
    chunks.push(intent.hair);
    // повтор — иначе цвет часто теряется
    chunks.push(intent.hair);
  }
  if (intent.activity) chunks.push(intent.activity);
  for (const weapon of intent.weapons) chunks.push(weapon);
  if (intent.setting) chunks.push(intent.setting);

  if (intent.peaceful) {
    chunks.push('no weapons', 'no armor focus', 'peaceful scholarly mood');
  }

  if (cameraId === 'fullbody' || intent.wantsFullBody) {
    chunks.push('full body visible head to toe');
  } else if (cameraId === 'closeup') {
    chunks.push('close-up portrait, face and hands in frame');
  }

  chunks.push('clean anatomy', 'natural hands');

  // Исходный RU оставляем коротко в конце lead — модель иногда цепляется
  const raw = userPrompt.trim();
  if (raw) chunks.push(`subject: ${raw}`);

  return chunks.join(', ');
}

export function shouldSoftenCombatStyle(userPrompt: string): boolean {
  return parsePromptIntent(userPrompt).peaceful;
}
