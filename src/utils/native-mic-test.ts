export type NativeMicTestHandle = {
  stop: () => void;
  getLevel: () => number;
  setMicGain: (gain: number) => void;
};

/** Web stub — native implementation is in native-mic-test.native.ts */
export async function startNativeMicrophoneTest(
  _micGain: number = 1,
): Promise<NativeMicTestHandle> {
  throw new Error('Проверка микрофона на этом экране только в приложении');
}
