import { describe, it, expect, vi, afterEach } from 'vitest';
import * as actionResolutionModule from './actionResolution';
import * as ballModule from './ball';
import * as eventsModule from './events';
import { simulateMatchLive } from './liveMatch';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
  type DeterministicRandomHandle,
} from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';
import type { LiveMatchState, Vec2, Vec3 } from '../types';
import {
  BALL_CONTROL_MAX_SPEED,
  DEFAULT_LIVE_ENGINE_CONFIG,
} from './config';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const SPY_ACCESS_TICKS = 1_000;
const TRACE_TICKS = 50;
const CENTER_TICK = 53_497;
const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_PASS_TARGET_RECEIVER_REALIZATION === '1';

type PassOutcome = 'boundary' | 'possession' | 'interception' | 'none';

interface ReceiverSnapshot {
  tick: number;
  position: Vec2 | null;
  ballPosition: Vec3;
  ballVelocity: Vec3;
  ballToTarget: number;
  ballToReceiver: number | null;
  receiverOwnsBall: boolean;
  receiverSpeed: number | null;
  ballSpeed: number;
  canControlByProductionRules: boolean;
}

interface PassTrace {
  applyTick: number;
  passerId: string | null;
  clubId: string | null;
  receiverId: string | null;
  receiverPosAtApply: Vec2 | null;
  receiverMissingReason: 'none' | 'no_target_player' | 'player_missing';
  target: Vec2;
  power: number;
  initialVelocity: Vec3;
  outcome: PassOutcome;
  terminalTick: number | null;
  receiverControlTick: number | null;
  receiverSnapshots: ReceiverSnapshot[];
  minBallReceiverDistance: number;
  minBallReceiverTick: number | null;
  receiverPosAtMinBallReceiver: Vec2 | null;
  receiverOwnsBallAtMin: boolean;
  targetDistanceAtMinBallReceiver: number | null;
  receiverCanControlAtMin: boolean;
  receiverMovementDistance: number | null;
  resolutionProbability: number | null;
  resolutionSeen: boolean;
}

interface ResolutionRecord {
  tick: number;
  passerId: string;
  receiverId: string | null;
  receiverPosAtApply: Vec2 | null;
  receiverMissingReason: PassTrace['receiverMissingReason'];
  applyMatched: boolean;
  trace: PassTrace | null;
}

function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function speed2D(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

function speed3D(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function formatVec(v: Vec3 | Vec2): string {
  const z = 'z' in v ? ',' + v.z.toFixed(3) : '';
  return '(' + v.x.toFixed(3) + ',' + v.y.toFixed(3) + z + ')';
}

function controlRadius(): number {
  return DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics.ballControlRadius;
}

function canControlByProductionRules(
  ballPosition: Vec3,
  ballVelocity: Vec3,
  receiverPosition: Vec2
): boolean {
  return (
    speed3D(ballVelocity) <= BALL_CONTROL_MAX_SPEED &&
    distance2D(
      { x: ballPosition.x, y: ballPosition.y },
      receiverPosition
    ) <= controlRadius()
  );
}

function buildFixture() {
  const data = generateGameData();
  const clubs = Object.values(data.clubs);
  return {
    home: structuredClone(clubs[0]),
    away: structuredClone(clubs[1]),
    players: structuredClone(data.players),
  };
}

describe('Pass Target Receiver Realization Diagnostic V9.1', () => {
  let random: DeterministicRandomHandle | null = null;
  let resolveSpy: ReturnType<typeof vi.spyOn> | null = null;
  let passSpy: ReturnType<typeof vi.spyOn> | null = null;
  let controlSpy: ReturnType<typeof vi.spyOn> | null = null;
  let boundarySpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    resolveSpy?.mockRestore();
    passSpy?.mockRestore();
    controlSpy?.mockRestore();
    boundarySpy?.mockRestore();
    random?.restore();
    resolveSpy = null;
    passSpy = null;
    controlSpy = null;
    boundarySpy = null;
    random = null;
  });

  it(
    'verifies resolvePassAction spy access before the V9.1 run',
    ({ skip }) => {
      if (!RUN) skip();

      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
      const original = actionResolutionModule.resolvePassAction;

      resolveSpy = vi
        .spyOn(actionResolutionModule, 'resolvePassAction')
        .mockImplementation((owner, decision, state) =>
          original(owner, decision, state)
        );

      const fixture = buildFixture();

      simulateMatchLive(fixture.home, fixture.away, fixture.players, {
        seed: MATCH_SEED,
        maxTicks: SPY_ACCESS_TICKS,
      });

      console.log('');
      console.log('=== V9.1 SPY ACCESS CHECK ===');
      console.log('ticks=' + SPY_ACCESS_TICKS);
      console.log(
        'resolvePassAction calls=' + resolveSpy.mock.calls.length
      );
      console.log(
        'spyAccessCheck=' + (resolveSpy.mock.calls.length > 0)
      );

      expect(resolveSpy.mock.calls.length).toBeGreaterThan(0);

      resolveSpy.mockRestore();
      resolveSpy = null;
      random.restore();
      random = null;
    },
    10 * 1000
  );

  it(
    'measures pass target receiver realization without changing production behavior',
    ({ skip }) => {
      if (!RUN) skip();

      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

      const traces: PassTrace[] = [];
      const resolutions: ResolutionRecord[] = [];
      const pendingByTick = new Map<number, ResolutionRecord[]>();
      let active: PassTrace | null = null;
      let currentTick = 0;

      const originalResolve = actionResolutionModule.resolvePassAction;
      resolveSpy = vi
        .spyOn(actionResolutionModule, 'resolvePassAction')
        .mockImplementation((owner, decision, state) => {
          const result = originalResolve(owner, decision, state);

          const receiverId =
            typeof decision.targetPlayerId === 'string'
              ? decision.targetPlayerId
              : null;

          let receiverPosAtApply: Vec2 | null = null;
          let receiverMissingReason: PassTrace['receiverMissingReason'] =
            'none';

          if (receiverId === null) {
            receiverMissingReason = 'no_target_player';
          } else {
            const receiver = state.players[receiverId];
            if (receiver) {
              receiverPosAtApply = { ...receiver.position };
            } else {
              receiverMissingReason = 'player_missing';
            }
          }

          const record: ResolutionRecord = {
            tick: currentTick + 1,
            passerId: owner.player.id,
            receiverId,
            receiverPosAtApply,
            receiverMissingReason,
            applyMatched: false,
            trace: null,
          };

          resolutions.push(record);

          const bucket = pendingByTick.get(record.tick) ?? [];
          bucket.push(record);
          pendingByTick.set(record.tick, bucket);

          return result;
        });

      const originalPass = ballModule.applyPass;
      passSpy = vi
        .spyOn(ballModule, 'applyPass')
        .mockImplementation(
          (ball, from, to, power, physics, playerId, clubId) => {
            const result = originalPass(
              ball,
              from,
              to,
              power,
              physics,
              playerId,
              clubId
            );

            const tick = currentTick + 1;
            const bucket = pendingByTick.get(tick) ?? [];
            const resolution = bucket.find(
              item =>
                !item.applyMatched &&
                item.passerId === (playerId ?? '')
            ) ?? null;

            if (resolution) {
              resolution.applyMatched = true;
            }

            const trace: PassTrace = {
              applyTick: tick,
              passerId: playerId ?? null,
              clubId: clubId ?? null,
              receiverId: resolution?.receiverId ?? null,
              receiverPosAtApply:
                resolution?.receiverPosAtApply ?? null,
              receiverMissingReason:
                resolution?.receiverMissingReason ?? 'no_target_player',
              target: { ...to },
              power,
              initialVelocity: { ...result.velocity },
              outcome: 'none',
              terminalTick: null,
              receiverControlTick: null,
              receiverSnapshots: [],
              minBallReceiverDistance: Number.POSITIVE_INFINITY,
              minBallReceiverTick: null,
              receiverPosAtMinBallReceiver: null,
              receiverOwnsBallAtMin: false,
              targetDistanceAtMinBallReceiver: null,
              receiverCanControlAtMin: false,
              receiverMovementDistance: null,
              resolutionProbability: null,
              resolutionSeen: resolution !== null,
            };

            traces.push(trace);
            active = trace;

            if (resolution) {
              resolution.trace = trace;
              trace.resolutionProbability = null;
            }

            return result;
          }
        );

      const originalControl = ballModule.controlBall;
      controlSpy = vi
        .spyOn(ballModule, 'controlBall')
        .mockImplementation((ball, playerId, clubId) => {
          const result = originalControl(ball, playerId, clubId);

          if (active !== null && active.outcome === 'none') {
            active.outcome =
              playerId === active.receiverId
                ? 'possession'
                : 'interception';
            active.terminalTick = currentTick + 1;

            if (playerId === active.receiverId) {
              active.receiverControlTick = currentTick + 1;
            }
          }

          return result;
        });

      const originalBoundary = eventsModule.detectBoundaryOutcome;
      boundarySpy = vi
        .spyOn(eventsModule, 'detectBoundaryOutcome')
        .mockImplementation(input => {
          const result = originalBoundary(input);

          if (
            active !== null &&
            active.outcome === 'none' &&
            result.type !== 'none'
          ) {
            active.outcome = 'boundary';
            active.terminalTick = currentTick + 1;
          }

          return result;
        });

      const fixture = buildFixture();

      simulateMatchLive(fixture.home, fixture.away, fixture.players, {
        seed: MATCH_SEED,
        maxTicks: MATCH_TICKS,
        onTick: (state: LiveMatchState) => {
          currentTick = state.tick;

          if (active === null) return;

          const ticksSinceApply =
            state.tick - active.applyTick + 1;

          if (
            ticksSinceApply < 1 ||
            ticksSinceApply > TRACE_TICKS
          ) {
            return;
          }

          const receiver =
            active.receiverId !== null
              ? state.players[active.receiverId]
              : null;

          const receiverPosition = receiver
            ? { ...receiver.position }
            : null;

          const ballPosition = { ...state.ball.position };
          const ballVelocity = { ...state.ball.velocity };
          const ballSpeed = speed3D(ballVelocity);

          const ballToTarget = distance2D(
            { x: ballPosition.x, y: ballPosition.y },
            active.target
          );

          const ballToReceiver =
            receiverPosition === null
              ? null
              : distance2D(
                  { x: ballPosition.x, y: ballPosition.y },
                  receiverPosition
                );

          const receiverOwnsBall =
            active.receiverId !== null &&
            state.ball.ownerId === active.receiverId;

          const receiverSpeed =
            receiver !== null
              ? speed2D(receiver.velocity)
              : null;

          const snapshot: ReceiverSnapshot = {
            tick: state.tick,
            position: receiverPosition,
            ballPosition,
            ballVelocity,
            ballToTarget,
            ballToReceiver,
            receiverOwnsBall,
            receiverSpeed,
            ballSpeed,
            canControlByProductionRules:
              receiverPosition !== null &&
              canControlByProductionRules(
                ballPosition,
                ballVelocity,
                receiverPosition
              ),
          };

          active.receiverSnapshots.push(snapshot);

          if (
            receiverPosition !== null &&
            ballToReceiver !== null &&
            ballToReceiver < active.minBallReceiverDistance
          ) {
            active.minBallReceiverDistance = ballToReceiver;
            active.minBallReceiverTick = state.tick;
            active.receiverPosAtMinBallReceiver = {
              ...receiverPosition,
            };
            active.receiverOwnsBallAtMin =
              receiverOwnsBall;
            active.targetDistanceAtMinBallReceiver =
              ballToTarget;
            active.receiverCanControlAtMin =
              snapshot.canControlByProductionRules;
          }
        },
      });

      for (const trace of traces) {
        if (
          trace.receiverPosAtApply !== null &&
          trace.receiverPosAtMinBallReceiver !== null
        ) {
          trace.receiverMovementDistance = distance2D(
            trace.receiverPosAtApply,
            trace.receiverPosAtMinBallReceiver
          );
        }

        if (trace.receiverControlTick !== null) {
          continue;
        }

        const controlSnapshot = trace.receiverSnapshots.find(
          sample => sample.receiverOwnsBall
        );

        if (controlSnapshot) {
          trace.receiverControlTick = controlSnapshot.tick;
        }
      }

      const matchedResolutions = resolutions.filter(
        record => record.applyMatched
      );

      const interceptedResolutions = resolutions.filter(
        record => !record.applyMatched
      );

      const receiverKnown = traces.filter(
        trace => trace.receiverId !== null
      );

      const receiverMissing = traces.filter(
        trace => trace.receiverId === null
      );

      const controlled = traces.filter(
        trace => trace.receiverControlTick !== null
      );

      const receiverCanControlAtMin = traces.filter(
        trace =>
          trace.receiverId !== null &&
          trace.receiverCanControlAtMin
      );

      const outcomeCounts: Record<PassOutcome, number> = {
        boundary: 0,
        possession: 0,
        interception: 0,
        none: 0,
      };

      for (const trace of traces) {
        outcomeCounts[trace.outcome]++;
      }

      const boundaryTraces = traces.filter(
        trace => trace.outcome === 'boundary'
      );

      const centerTraces = traces.filter(
        trace => trace.applyTick === CENTER_TICK
      );

      const centerTrace = centerTraces[0] ?? null;

      console.log('');
      console.log('=== V9.1 PASS TARGET RECEIVER REALIZATION ===');
      console.log('seed=' + MATCH_SEED + ' ticks=' + MATCH_TICKS);
      console.log(
        'traceWindow=' +
          TRACE_TICKS +
          ' ticks after applyPass (terminal tick included)'
      );
      console.log('total applyPass calls=' + traces.length);
      console.log(
        'total resolvePassAction calls=' + resolutions.length
      );

      console.log('');
      console.log('--- resolve/apply pairing ---');
      console.log(
        'matched resolve→apply=' + matchedResolutions.length
      );
      console.log(
        'resolve without apply (interception)=' +
          interceptedResolutions.length
      );
      console.log(
        'pairingCheck=' +
          (matchedResolutions.length +
            interceptedResolutions.length ===
            resolutions.length)
      );

      console.log('');
      console.log('--- receiver identity ---');
      console.log('receiver known=' + receiverKnown.length);
      console.log('receiver missing=' + receiverMissing.length);
      console.log(
        'receiver known rate=' +
          (
            traces.length > 0
              ? receiverKnown.length / traces.length * 100
              : 0
          ).toFixed(1) +
          '%'
      );

      console.log('');
      console.log('--- receiver realization aggregate ---');
      console.log('receiver controlled=' + controlled.length);
      console.log(
        'receiver not controlled=' +
          (receiverKnown.length - controlled.length)
      );
      console.log(
        'receiver could control at min distance=' +
          receiverCanControlAtMin.length
      );

      console.log('');
      console.log('--- pass outcomes ---');
      console.log('boundary=' + outcomeCounts.boundary);
      console.log('possession=' + outcomeCounts.possession);
      console.log('interception=' + outcomeCounts.interception);
      console.log('none=' + outcomeCounts.none);

      console.log('');
      console.log('--- boundary receiver realization ---');
      for (const trace of boundaryTraces) {
        console.log(
          'tick=' +
            trace.applyTick +
            ' receiver=' +
            (trace.receiverId ?? 'null') +
            ' minBallReceiver=' +
            (
              Number.isFinite(trace.minBallReceiverDistance)
                ? trace.minBallReceiverDistance.toFixed(3)
                : 'N/A'
            ) +
            'm minTick=' +
            (trace.minBallReceiverTick ?? 'N/A') +
            ' targetAtMin=' +
            (
              trace.targetDistanceAtMinBallReceiver === null
                ? 'N/A'
                : trace.targetDistanceAtMinBallReceiver.toFixed(3)
            ) +
            'm receiverCanControlAtMin=' +
            trace.receiverCanControlAtMin
        );
      }

      console.log('');
      console.log('--- ' + CENTER_TICK + ' CENTER CASE ---');

      if (centerTrace === null) {
        console.log('53497 count=0');
      } else {
        console.log(
          'applyPass @ ' +
            centerTrace.applyTick +
            ' passer=' +
            (centerTrace.passerId ?? 'null') +
            ' club=' +
            (centerTrace.clubId ?? 'null')
        );
        console.log(
          '  receiver=' +
            (centerTrace.receiverId ?? 'null') +
            ' receiverPos@apply=' +
            (
              centerTrace.receiverPosAtApply
                ? formatVec(centerTrace.receiverPosAtApply)
                : 'null'
            )
        );
        console.log(
          '  target=' +
            formatVec(centerTrace.target) +
            ' power=' +
            centerTrace.power.toFixed(6)
        );
        console.log(
          '  min ball→receiver=' +
            (
              Number.isFinite(centerTrace.minBallReceiverDistance)
                ? centerTrace.minBallReceiverDistance.toFixed(6)
                : 'N/A'
            ) +
            ' m at tick=' +
            (centerTrace.minBallReceiverTick ?? 'N/A')
        );
        console.log(
          '  receiverPos@min=' +
            (
              centerTrace.receiverPosAtMinBallReceiver
                ? formatVec(centerTrace.receiverPosAtMinBallReceiver)
                : 'null'
            )
        );
        console.log(
          '  ball→target@receiver-min=' +
            (
              centerTrace.targetDistanceAtMinBallReceiver === null
                ? 'N/A'
                : centerTrace.targetDistanceAtMinBallReceiver.toFixed(6)
            ) +
            ' m'
        );
        console.log(
          '  receiver can control at min=' +
            centerTrace.receiverCanControlAtMin
        );
        console.log(
          '  receiver owns ball at min=' +
            centerTrace.receiverOwnsBallAtMin
        );
        console.log(
          '  controlTick=' +
            (centerTrace.receiverControlTick ?? 'N/A') +
            ' outcome=' +
            centerTrace.outcome +
            ' terminalTick=' +
            (centerTrace.terminalTick ?? 'N/A')
        );

        for (const sample of centerTrace.receiverSnapshots) {
          console.log(
            '    t=' +
              sample.tick +
              ' ball=' +
              formatVec(sample.ballPosition) +
              ' receiver=' +
              (
                sample.position
                  ? formatVec(sample.position)
                  : 'null'
              ) +
              ' ball→target=' +
              sample.ballToTarget.toFixed(3) +
              ' ball→receiver=' +
              (
                sample.ballToReceiver === null
                  ? 'N/A'
                  : sample.ballToReceiver.toFixed(3)
              ) +
              ' ballSpeed=' +
              sample.ballSpeed.toFixed(3) +
              ' receiverSpeed=' +
              (
                sample.receiverSpeed === null
                  ? 'N/A'
                  : sample.receiverSpeed.toFixed(3)
              ) +
              ' canControl=' +
              sample.canControlByProductionRules +
              ' owns=' +
              sample.receiverOwnsBall
          );
        }
      }

      console.log('');
      console.log('=== V9.1 REQUIRED CHECKS ===');
      console.log('53497 count=' + centerTraces.length);
      console.log(
        'spyAccessCheck=' +
          (resolveSpy.mock.calls.length > 0)
      );
      console.log(
        'pairingCheck=' +
          (matchedResolutions.length +
            interceptedResolutions.length ===
            resolutions.length)
      );
      console.log(
        'receiverPartitionCheck=' +
          (
            receiverKnown.length +
              receiverMissing.length ===
            traces.length
          )
      );

      expect(traces.length).toBeGreaterThan(0);
      expect(resolutions.length).toBeGreaterThan(0);
      expect(
        matchedResolutions.length +
          interceptedResolutions.length
      ).toBe(resolutions.length);
      expect(
        receiverKnown.length + receiverMissing.length
      ).toBe(traces.length);
      expect(centerTraces.length).toBe(1);
    },
    10 * 60 * 1000
  );
});
