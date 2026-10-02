// V7 targeted forensic harness
// Usage:
// $env:RUN_PASS_GOALKEEPER_TRACE='1'
// npx vitest run src/engine/live/passGoalkeeperChain.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ballModule from './ball';
import { simulateMatchLive } from './liveMatch';
import { PassGoalkeeperChainDiagnostic, type PassCallRecord } from './diagnostics/passGoalkeeperChainDiagnostic';
import { installDeterministicRandom, DEFAULT_FIXTURE_SEED, type DeterministicRandomHandle } from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const PASS_TICK = 53_497;
const BOUNDARY_TICK = 53_573;
const RUN = typeof process !== 'undefined' && process.env.RUN_PASS_GOALKEEPER_TRACE === '1';

describe('Pass + Goalkeeper Chain V7', () => {
  let random: DeterministicRandomHandle | null = null;
  let applyPassSpy: ReturnType<typeof vi.spyOn> | null = null;
  let controlBallSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    applyPassSpy?.mockRestore();
    controlBallSpy?.mockRestore();
    applyPassSpy = null;
    controlBallSpy = null;
    random?.restore();
    random = null;
  });

  it('traces tick 53497 pass and tick 53573 boundary resolution', ({ skip }) => {
    if (!RUN) skip();
    random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
    const passCalls: PassCallRecord[] = [];

    const originalApplyPass = ballModule.applyPass;
    applyPassSpy = vi.spyOn(ballModule, 'applyPass').mockImplementation((ball, from, to, power, physics, playerId, clubId) => {
      const result = originalApplyPass(ball, from, to, power, physics, playerId, clubId);
      const speed = Math.hypot(result.velocity.x, result.velocity.y, result.velocity.z);
      passCalls.push({
        playerId,
        clubId,
        from: { ...from },
        to: { ...to },
        power,
        speed,
      });
      return result;
    });

    controlBallSpy = vi.spyOn(ballModule, 'controlBall');

    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const players = structuredClone(data.players);

    const diag = new PassGoalkeeperChainDiagnostic(PASS_TICK, BOUNDARY_TICK);

    simulateMatchLive(home, away, players, {
      seed: MATCH_SEED,
      maxTicks: MATCH_TICKS,
      onTick: state => diag.onTick(state, passCalls),
    });

    const passCall = passCalls.find(call => call.playerId === 'player_club_1_18');
    expect(passCall).toBeDefined();
    expect(controlBallSpy).toBeDefined();

    console.log('=== V7 CONTROL BALL SUMMARY ===');
    console.log('controlBallCalls=' + (controlBallSpy?.mock.calls.length ?? 0));
    const lastControl = controlBallSpy?.mock.calls.at(-1);
    if (lastControl) console.log('lastControl player=' + lastControl[1] + ' club=' + lastControl[2]);
  }, 10 * 60 * 1000);
});
