import { describe, it, expect, vi, afterEach } from 'vitest';
import * as eventsModule from './events';
import * as ballModule from './ball';
import { simulateMatchLive } from './liveMatch';
import { PassGoalkeeperChainDiagnostic, type ApplyPassCall, type ControlBallCall } from './diagnostics/passGoalkeeperChainDiagnostic';
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
  let boundarySpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    applyPassSpy?.mockRestore();
    controlBallSpy?.mockRestore();
    boundarySpy?.mockRestore();
    random?.restore();
    applyPassSpy = null; controlBallSpy = null; boundarySpy = null; random = null;
  });

  it('traces tick 53497 pass and tick 53573 boundary resolution', ({ skip }) => {
    if (!RUN) skip();
    random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
    const diag = new PassGoalkeeperChainDiagnostic(PASS_TICK, BOUNDARY_TICK);
    let currentTick = 0;

    const originalApplyPass = ballModule.applyPass;
    applyPassSpy = vi.spyOn(ballModule, 'applyPass').mockImplementation((ball, from, to, power, physics, playerId, clubId) => {
      const result = originalApplyPass(ball, from, to, power, physics, playerId, clubId);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      const dirX = len > 1e-9 ? dx / len : 0;
      const dirY = len > 1e-9 ? dy / len : 0;
      const resultVx = result.velocity.x;
      const resultVy = result.velocity.y;
      const resultSpeed = Math.hypot(resultVx, resultVy);
      const velLen = resultSpeed;
      const normVx = velLen > 1e-9 ? resultVx / velLen : 0;
      const normVy = velLen > 1e-9 ? resultVy / velLen : 0;
      diag.recordApplyPass({ tick: currentTick + 1, playerId: playerId ?? 'null', clubId: clubId ?? 'null', fromX: from.x, fromY: from.y, targetX: to.x, targetY: to.y, power, resultVx, resultVy, resultSpeed, dirX, dirY, dirMatchesVelocity: Math.abs(normVx - dirX) < 0.01 && Math.abs(normVy - dirY) < 0.01 });
      return result;
    });

    const originalControlBall = ballModule.controlBall;
    controlBallSpy = vi.spyOn(ballModule, 'controlBall').mockImplementation((ball, playerId, clubId) => {
      const previousOwnerId = ball.ownerId;
      const result = originalControlBall(ball, playerId, clubId);
      diag.recordControlBall({ tick: currentTick + 1, ownerId: playerId, clubId, previousOwnerId, resultingLastTouchId: result.lastTouchId, resultingLastTouchClubId: result.lastTouchClubId });
      return result;
    });

    const originalBoundary = eventsModule.detectBoundaryOutcome;
    boundarySpy = vi.spyOn(eventsModule, 'detectBoundaryOutcome').mockImplementation(input => {
      const result = originalBoundary(input);
      diag.recordBoundary({ tick: currentTick + 1, input, result });
      return result;
    });

    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const players = structuredClone(data.players);

    simulateMatchLive(home, away, players, {
      seed: MATCH_SEED,
      maxTicks: MATCH_TICKS,
      onTick: state => { currentTick = state.tick; diag.onTick(state); },
    });

    diag.report();
    expect(true).toBe(true);
  }, 10 * 60 * 1000);
});
