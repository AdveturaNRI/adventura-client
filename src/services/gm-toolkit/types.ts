export type Gender = 'm' | 'f' | 'random';

export type RaceDef = {
  key: string;
  label: string;
  names: { m: string[]; f: string[] };
  surnames?: string[];
  clans?: string[];
};

export type NpcCard = {
  category: 'npc';
  name: string;
  raceKey: string;
  raceLabel: string;
  gender: 'm' | 'f';
  age: number;
  occupation: string;
  appearance: string;
  mannerism: string;
  secret: string;
  goal: string;
  summary: string;
};

export type TavernCard = {
  category: 'tavern';
  name: string;
  typeKey: string;
  typeLabel: string;
  keeper: string;
  atmosphere: string;
  signature: string;
  event: string;
  rumor: string;
  summary: string;
};

export type KingdomCard = {
  category: 'kingdom';
  name: string;
  government: string;
  governmentDescription: string;
  ruler: string;
  crisis: string;
  faction: string;
  factionSphere: string;
  emblem: string;
  motto: string;
  hiddenAgenda: string;
  summary: string;
};

export type SettlementCard = {
  category: 'settlement';
  name: string;
  sizeKey: string;
  sizeLabel: string;
  landmark: string;
  problem: string;
  summary: string;
};

export type DungeonCard = {
  category: 'dungeon';
  name: string;
  originalPurpose: string;
  currentThreat: string;
  trap: string;
  treasure: string;
  summary: string;
};

export type GeneratorCard =
  | NpcCard
  | TavernCard
  | KingdomCard
  | SettlementCard
  | DungeonCard;

export type GeneratorCategory = GeneratorCard['category'];

export type HistoryEntry = {
  id: string;
  at: number;
  card: GeneratorCard;
};
