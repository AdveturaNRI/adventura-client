import type { DiceAnimationSpeed } from '@/utils/dice-animations-storage';

export type DiceRollGroup = {
  sides: number;
  values: number[];
  sum: number;
};

export type DiceRollOutcome = {
  values: number[];
  sum: number;
  /** Human label, e.g. `2d20 + 1d6` */
  notation: string;
  groups: DiceRollGroup[];
  /** Преимущество / помеха — итог уже с учётом keep best/worst. */
  mode?: 'normal' | 'advantage' | 'disadvantage';
};

/** dice-box accepts strings, roll objects, or mixed arrays. */
export type DiceRollNotationObject = {
  qty?: number;
  sides: number;
  themeColor?: string;
};

export type DiceNotation =
  | string
  | DiceRollNotationObject
  | Array<string | DiceRollNotationObject>;

export type DiceStageHandle = {
  roll: (notation: DiceNotation) => Promise<DiceRollOutcome>;
  /** Soft-drop dice-box meshes onto the table without firing onDone. */
  preview: (notation: DiceNotation | null) => void;
  clear: () => void;
};

export type DiceStageProps = {
  onReady?: () => void;
  onDone?: (outcome: DiceRollOutcome) => void;
  /** Transparent canvas for chat overlay (no table bg). */
  transparent?: boolean;
  /** Hex color for dice body (`themeColor` in dice-box). */
  accent?: string;
  /** Скорость физики броска. */
  animationSpeed?: DiceAnimationSpeed;
};
