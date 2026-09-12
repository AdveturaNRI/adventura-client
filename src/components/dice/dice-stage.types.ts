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
};

/** Single `2d20` or several `['2d20','1d6']` — dice-box accepts both. */
export type DiceNotation = string | string[];

export type DiceStageHandle = {
  roll: (notation: DiceNotation) => Promise<DiceRollOutcome>;
  /** Soft-drop dice-box meshes onto the table without firing onDone. */
  preview: (notation: DiceNotation | null) => void;
  clear: () => void;
};

export type DiceStageProps = {
  onReady?: () => void;
  onDone?: (outcome: DiceRollOutcome) => void;
};
