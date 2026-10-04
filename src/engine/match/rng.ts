// Seeded RNG for the Frozen match engine.
// When no seed is supplied, Math.random is preserved for existing callers.
export type MatchRng = () => number;

export function createMatchRng(seed?: number): MatchRng {
  if (seed === undefined) {
    return Math.random;
  }

  let state = seed >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
