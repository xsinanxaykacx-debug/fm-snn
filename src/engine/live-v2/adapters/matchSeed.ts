import type { RngState } from '../rng';

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function createV2MatchSeed(
  season: number,
  fixture: string,
  week: number,
): RngState {
  if (!Number.isInteger(season)) throw new Error('live-v2 seed: invalid season');
  if (!Number.isInteger(week)) throw new Error('live-v2 seed: invalid week');

  return { seed: fnv1a(`live-v2:${season}:${fixture}:${week}`) };
}
