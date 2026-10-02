// detectBoundaryOutcome spy erişim testi.
// Amaç: vi.spyOn'un liveMatch çağrısını yakalayıp yakalamadığını doğrulamak.
//
// Kullanım:
//   $env:RUN_SPY_ACCESS_TEST="1"
//   npx vitest run src/engine/live/diagnostics/spyAccessTest.test.ts

import { describe, it, expect, vi } from 'vitest';
import * as eventsModule from '../events';
import { simulateMatchLive } from '../liveMatch';
import { generateGameData } from '../../data/generateData';

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_SPY_ACCESS_TEST === '1';

describe.skipIf(!RUN)('detectBoundaryOutcome spy access test', () => {
  it('vi.spyOn detects calls from liveMatch', () => {
    const spy = vi.spyOn(eventsModule, 'detectBoundaryOutcome');

    try {
      const data = generateGameData();
      const clubs = Object.values(data.clubs);

      if (clubs.length < 2) {
        throw new Error(
          'Spy access diagnostic için en az iki kulüp gerekli.'
        );
      }

      const home = structuredClone(clubs[0]);
      const away = structuredClone(clubs[1]);
      const players = structuredClone(data.players);

      simulateMatchLive(home, away, players, {
        seed: 1000,
        maxTicks: 2000,
      });

      console.log('=== SPY ACCESS TEST ===');
      console.log(
        `detectBoundaryOutcome call count: ${spy.mock.calls.length}`
      );

      expect(spy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  }, 60_000);
});
