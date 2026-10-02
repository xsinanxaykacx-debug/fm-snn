// src/engine/live/diagnostics/deterministicFixture.ts
//
// Deterministic fixture helper.
//
// generateGameData() içindeki Math.random() çağrılarını, verilen
// fixtureSeed'e bağlı deterministik bir PRNG ile değiştirir.
//
// KONTRAT:
//   - Production'a DOKUNMAZ.
//   - Sadece test scope'unda çalışır.
//   - Live engine kendi seeded RNG'sini kullandığı için bu mock
//     yalnızca generateGameData()'yı etkiler.
//   - Fixture seed'i match seed'inden AYRI tutulur:
//       fixtureSeed = 424242 (bu dosya)
//       matchSeed   = 1000   (test dosyası)

import { vi } from 'vitest';

export const DEFAULT_FIXTURE_SEED = 424242;

/**
 * Deterministik LCG (linear congruential generator).
 * Hızlı, tekrarlanabilir. Test fixture üretimi için yeterli.
 */
function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export interface DeterministicRandomHandle {
  seed: number;
  restore: () => void;
}

export function installDeterministicRandom(
  seed: number = DEFAULT_FIXTURE_SEED
): DeterministicRandomHandle {
  const prng = createLcg(seed);
  const spy = vi.spyOn(Math, 'random').mockImplementation(prng);
  return {
    seed,
    restore: () => spy.mockRestore(),
  };
}
