import type { GeneratorCard } from './types';

export function formatCardPlaintext(card: GeneratorCard): string {
  switch (card.category) {
    case 'npc':
      return [
        `NPC: ${card.name}`,
        `Раса: ${card.raceLabel}`,
        `Возраст: ${card.age}`,
        `Занятие: ${card.occupation}`,
        `Внешность: ${card.appearance}`,
        `Манера: ${card.mannerism}`,
        `Секрет: ${card.secret}`,
        `Цель: ${card.goal}`,
      ].join('\n');
    case 'tavern':
      return [
        `${card.typeLabel}: ${card.name}`,
        `Хозяин: ${card.keeper}`,
        `Атмосфера: ${card.atmosphere}`,
        `Фирменное: ${card.signature}`,
        `Сейчас: ${card.event}`,
        `Слух: ${card.rumor}`,
      ].join('\n');
    case 'kingdom':
      return [
        `Государство: ${card.name}`,
        `Правление: ${card.government}`,
        `О правлении: ${card.governmentDescription || '—'}`,
        `Правитель: ${card.ruler}`,
        `Кризис: ${card.crisis}`,
        `Фракция: ${card.faction} (${card.factionSphere})`,
        `Герб: ${card.emblem}`,
        `Девиз: «${card.motto}»`,
        `Скрытая повестка: ${card.hiddenAgenda}`,
      ].join('\n');
    case 'settlement':
      return [
        `Локация: ${card.name}`,
        `Тип: ${card.sizeLabel}`,
        `Особенность: ${card.landmark}`,
        `Проблема: ${card.problem}`,
      ].join('\n');
    case 'dungeon':
      return [
        `Подземелье: ${card.name}`,
        `Назначение: ${card.originalPurpose}`,
        `Обитатели: ${card.currentThreat}`,
        `Опасность: ${card.trap}`,
        `Сокровище: ${card.treasure}`,
      ].join('\n');
    default:
      return '';
  }
}

export function formatCardChatMessage(card: GeneratorCard): string {
  return `🎲 Генерация: \n\n${formatCardPlaintext(card)}`;
}

export function categoryLabel(category: GeneratorCard['category']): string {
  switch (category) {
    case 'npc':
      return 'NPC';
    case 'tavern':
      return 'Таверна';
    case 'kingdom':
      return 'Королевство';
    case 'settlement':
      return 'Локация';
    case 'dungeon':
      return 'Подземелье';
    default:
      return 'Генерация';
  }
}
