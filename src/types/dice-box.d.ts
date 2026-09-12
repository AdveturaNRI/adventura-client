declare module '@3d-dice/dice-box' {
  export type DiceBoxDieResult = {
    sides: number;
    value: number;
    groupId?: number;
    rollId?: number;
    theme?: string;
  };

  export type DiceBoxGroupResult = {
    qty: number;
    sides: number;
    value: number;
    rolls: DiceBoxDieResult[];
    mods?: unknown[];
  };

  export type DiceBoxConfig = {
    assetPath?: string;
    origin?: string;
    theme?: string;
    themeColor?: string;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
    settleTimeout?: number;
    offscreen?: boolean;
    delay?: number;
    lightIntensity?: number;
    shadowTransparency?: number;
    enableShadows?: boolean;
  };

  export default class DiceBox {
    constructor(target: string | HTMLElement, config?: DiceBoxConfig);
    init(): Promise<this>;
    roll(
      notation: string | Record<string, unknown> | Array<string | Record<string, unknown>>,
      options?: { theme?: string; newStartPoint?: boolean },
    ): Promise<DiceBoxGroupResult[]>;
    clear(): void;
    hide(className?: string): void;
    show(): void;
    updateConfig(config: Partial<DiceBoxConfig>): void;
    getRollResults(): DiceBoxGroupResult[];
    onRollComplete: (results: DiceBoxGroupResult[]) => void;
    onBeforeRoll?: (notation: unknown) => void;
    onDieComplete?: (die: DiceBoxDieResult) => void;
  }
}
