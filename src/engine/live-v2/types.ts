/**
 * Compatibility export for code that imports the early live-v2 type module.
 *
 * state.ts is the canonical MatchState definition. Keeping this re-export
 * avoids two competing copies of the same domain model while the v2 modules
 * are still being built.
 */
export * from './state';
