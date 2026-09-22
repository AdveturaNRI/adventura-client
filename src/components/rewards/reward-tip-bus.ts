/** One open reward tooltip at a time — opening another (or outside click) closes the rest. */

type TipListener = (openId: string | null) => void;

let openTipId: string | null = null;
const listeners = new Set<TipListener>();
let nextId = 0;

function notify() {
  for (const listener of listeners) {
    listener(openTipId);
  }
}

export function createRewardTipId() {
  nextId += 1;
  return `reward-tip-${nextId}`;
}

export function subscribeRewardTip(listener: TipListener) {
  listeners.add(listener);
  listener(openTipId);
  return () => {
    listeners.delete(listener);
  };
}

/** Mark this tip as the only open one. */
export function claimRewardTip(id: string) {
  if (openTipId === id) {
    return;
  }
  openTipId = id;
  notify();
}

export function releaseRewardTip(id: string) {
  if (openTipId !== id) {
    return;
  }
  openTipId = null;
  notify();
}

export function getOpenRewardTipId() {
  return openTipId;
}
