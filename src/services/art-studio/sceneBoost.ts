import type { ArtCameraId } from './types';

/**
 * Русские акценты сцены → жёсткие EN-фразы.
 * Цвет волос и оружие — отдельно и жёстко: schnell/dev иначе рисует блондинок с тремя мечами.
 */
const HAIR_HINTS: { match: RegExp; token: string }[] = [
  {
    match: /рыж|redhead|ginger|auburn|red[\s-]?hair/i,
    token:
      'vivid natural red hair, bright ginger auburn hair, copper-red locks, saturated red hair color, NOT blonde, NOT golden hair, NOT yellow hair',
  },
  {
    match: /блонд|светл\w*\s*волос|blonde|blond/i,
    token: 'blonde hair, golden light hair',
  },
  {
    match: /брюнет|чёрн\w*\s*волос|черн\w*\s*волос|black[\s-]?hair|brunette/i,
    token: 'black hair, dark brunette hair',
  },
  {
    match: /шатен|каштан|brown[\s-]?hair|chestnut/i,
    token: 'chestnut brown hair',
  },
  {
    match: /седы|серебр\w*\s*волос|white[\s-]?hair|silver[\s-]?hair/i,
    token: 'silver-white hair',
  },
];

const SCENE_HINTS: { match: RegExp; token: string }[] = [
  {
    match: /книг|читает|reading|book\b/i,
    token: 'reading an open book held in hands, book clearly visible, calm focused pose',
  },
  {
    match: /полн\w*\s*рост|во весь рост|с ног до головы|full[\s-]?body|fullbody/i,
    token:
      'full body shot head to toe including boots, feet visible, entire figure in frame, not cropped, not a close-up',
  },
  {
    match: /лук|archery|bow\b|longbow|shortbow/i,
    token:
      'holding one wooden longbow by the grip in hands in front of the body, bow clearly visible, no extra weapons',
  },
  {
    match: /меч|sword|blade/i,
    token:
      'holding exactly one sword by the hilt with correct hand grip on the handle, blade not gripped by the edge, sword in front of the body, no sword on the back, no extra swords',
  },
  {
    match: /топор|axe\b/i,
    token: 'holding one axe by the handle in hands, weapon clearly visible, no extra weapons',
  },
  {
    match: /посох|staff\b/i,
    token: 'holding one mage staff in hands, staff clearly visible',
  },
  {
    match: /щит|shield/i,
    token: 'holding one shield, shield clearly visible',
  },
  {
    match: /лес|рощ|чащ|forest|woods|woodland/i,
    token: 'dense fantasy forest environment, trees and foliage around the character',
  },
  {
    match: /таверн|inn\b|tavern/i,
    token: 'inside a fantasy tavern interior',
  },
  {
    match: /подземел|dungeon|cave|пещер/i,
    token: 'fantasy dungeon or cave environment',
  },
  {
    match: /конь|лошад|horse|mount/i,
    token: 'with a horse nearby',
  },
  {
    match: /доспех|armor|armour/i,
    token: 'wearing visible fantasy armor',
  },
  {
    match: /плащ|cloak|cape/i,
    token: 'wearing a flowing cloak',
  },
];

/** Угадать ракурс по тексту пользователя */
export function inferCameraFromPrompt(userPrompt: string): ArtCameraId | null {
  const text = userPrompt.trim();
  if (!text) return null;

  if (/полн\w*\s*рост|во весь рост|с ног до головы|full[\s-]?body|fullbody|стоя\w*\s*целиком/i.test(text)) {
    return 'fullbody';
  }
  if (
    /крупн\w*\s*план|лицо|close[\s-]?up|портрет лица|facial|читает|книг|reading|book\b/i.test(
      text,
    )
  ) {
    return 'closeup';
  }
  if (/птич\w*\s*пол[её]т|сверху|aerial|wide[\s-]?angle|панорам/i.test(text)) {
    return 'aerial';
  }
  if (/изометр|isometric|вид сверху.*токен|top[\s-]?down/i.test(text)) {
    return 'isometric';
  }
  return null;
}

/** EN-расширения: сначала цвет волос, потом сцена/оружие */
export function extractSceneBoosts(userPrompt: string): string[] {
  const text = userPrompt.trim();
  if (!text) return [];
  const hits: string[] = [];
  for (const hint of [...HAIR_HINTS, ...SCENE_HINTS]) {
    if (hint.match.test(text)) {
      hits.push(hint.token);
    }
  }
  return hits;
}

/** Токен сущности с учётом ракурса — без навязанного оружия */
export function entityTokenForCamera(baseToken: string, cameraId: ArtCameraId): string {
  if (cameraId === 'fullbody') {
    return 'full-body fantasy character illustration, head-to-toe including feet in frame, readable outfit, environment visible, anatomically correct hands, not a facial close-up';
  }
  if (cameraId === 'closeup') {
    return baseToken;
  }
  return baseToken;
}

/** Есть ли в тексте оружие/реквизит боя */
export function promptHasWeapon(userPrompt: string): boolean {
  return /лук|меч|топор|посох|щит|sword|bow\b|axe\b|staff\b|shield|blade|weapon/i.test(
    userPrompt,
  );
}

/** Размер холста: умеренный — меньше артефактов на быстрых моделях */
export function sizeForCamera(
  base: { width: number; height: number },
  cameraId: ArtCameraId,
): { width: number; height: number } {
  if (cameraId === 'fullbody' && base.height >= base.width) {
    return { width: 576, height: 768 };
  }
  if (cameraId === 'closeup' && base.height >= base.width) {
    return { width: 512, height: 768 };
  }
  return base;
}
