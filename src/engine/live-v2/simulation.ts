import { runTick } from './tick';
import type { MatchState } from './state';

export function simulateMatchV2(
  state: MatchState,
  maxSeconds: number,
): MatchState {
  if (!Number.isInteger(maxSeconds) || maxSeconds < 0) {
    throw new Error('live-v2 simulation: invalid maxSeconds');
  }

  let current = state;
  const targetTick = current.tick + maxSeconds;

  while (current.tick < targetTick) {
    current = runTick(current);
  }

  return current;
}
