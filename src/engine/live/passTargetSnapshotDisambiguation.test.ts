import { describe, it, expect, vi, afterEach } from 'vitest';
import * as actionResolutionModule from './actionResolution';
import * as ballModule from './ball';
import { simulateMatchLive } from './liveMatch';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
  type DeterministicRandomHandle,
} from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';
import type { LiveMatchState, Vec2 } from '../types';
import { TICK_DURATION } from './config';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const SPY_ACCESS_TICKS = 1_000;
const CENTER_TICK = 53_497;
const EPSILON = 1e-9;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_PASS_DECISION_FRESHNESS === '1';

interface PendingResolution {
  resolveSequence: number;
  resolveSequenceInTick: number;
  resolveTick: number;
  applyTick: number;
  passerId: string;
  receiverId: string | null;
  decisionTimestamp: number;
  decisionTick: number;
  decisionAgeTicks: number;
  decisionTarget: Vec2;
  receiverAtResolve: Vec2 | null;
  receiverResolveTick: number | null;
  matched: boolean;
}

interface PassTrace {
  resolveSequence: number;
  resolveSequenceInTick: number;
  applySequenceInTick: number;
  resolveTick: number;
  applyTick: number;
  passerId: string;
  receiverId: string | null;
  decisionTimestamp: number;
  decisionTick: number;
  decisionAgeTicks: number;
  decisionTarget: Vec2;
  applyTarget: Vec2;
  receiverAtResolve: Vec2 | null;
  receiverAtApply: Vec2 | null;
  receiverResolveTick: number | null;
  receiverApplyTick: number | null;
  distanceDecisionToApply: number;
  distanceDecisionToResolve: number | null;
  distanceDecisionToApplyReceiver: number | null;
  distanceApplyToResolve: number | null;
  distanceApplyToApplyReceiver: number | null;
  decisionTargetEqualsApplyTarget: boolean;
  receiverAtResolveEqualsApply: boolean;
  receiverResolveTickEqualsApply: boolean;
}

function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sameVec(a: Vec2 | null, b: Vec2 | null): boolean {
  if (a === null || b === null) return a === b;

  return (
    Math.abs(a.x - b.x) <= EPSILON &&
    Math.abs(a.y - b.y) <= EPSILON
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
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

function formatVec(value: Vec2 | null): string {
  return value === null
    ? 'null'
    : '(' + value.x.toFixed(3) + ', ' + value.y.toFixed(3) + ')';
}

describe('Pass Target Snapshot Disambiguation V9.3', () => {
  let random: DeterministicRandomHandle | null = null;
  let resolveSpy: ReturnType<typeof vi.spyOn> | null = null;
  let passSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    resolveSpy?.mockRestore();
    passSpy?.mockRestore();
    random?.restore();

    resolveSpy = null;
    passSpy = null;
    random = null;
  });

  it(
    'verifies the resolvePassAction spy sees decision.target and state.tick',
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

      expect(resolveSpy.mock.calls.length).toBeGreaterThan(0);

      const firstPassCall = resolveSpy.mock.calls.find(
        call =>
          typeof call[1].timestamp === 'number' &&
          typeof call[2].tick === 'number'
      );

      expect(firstPassCall).toBeDefined();

      if (firstPassCall) {
        expect(typeof firstPassCall[1].timestamp).toBe('number');
        expect(Number.isFinite(firstPassCall[1].timestamp)).toBe(true);
        expect(typeof firstPassCall[2].tick).toBe('number');
        expect(Number.isInteger(firstPassCall[2].tick)).toBe(true);
      }
    },
    10 * 1000
  );

  it(
    'disambiguates decisionTarget/applyTarget and receiver snapshots without changing production behavior',
    ({ skip }) => {
      if (!RUN) skip();

      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

      const pendingByTickAndPasser = new Map<string, PendingResolution[]>();
      const traces: PassTrace[] = [];

      let currentTick = 0;
      let resolveSequence = 0;
      const resolveSequenceInTick = new Map<number, number>();
      const applySequenceByTick = new Map<number, number>();

      const originalResolve = actionResolutionModule.resolvePassAction;

      resolveSpy = vi
        .spyOn(actionResolutionModule, 'resolvePassAction')
        .mockImplementation((owner, decision, state) => {
          const resolveTick = state.tick;
          const applyTick = currentTick + 1;

          const sequenceInTick =
            (resolveSequenceInTick.get(resolveTick) ?? 0) + 1;

          resolveSequenceInTick.set(resolveTick, sequenceInTick);
          resolveSequence += 1;

          if (decision.target === null) {
            return originalResolve(owner, decision, state);
          }

          const decisionTargetSnapshot = {
            x: decision.target.x,
            y: decision.target.y,
          };

          const receiverId =
            typeof decision.targetPlayerId === 'string'
              ? decision.targetPlayerId
              : null;

          const receiver = receiverId !== null
            ? state.players[receiverId]
            : undefined;

          const receiverAtResolve = receiver
            ? {
                x: receiver.position.x,
                y: receiver.position.y,
              }
            : null;

          const decisionTick = Math.round(
            decision.timestamp / TICK_DURATION
          );

          const decisionAgeTicks = resolveTick - decisionTick;

          const pending: PendingResolution = {
            resolveSequence,
            resolveSequenceInTick: sequenceInTick,
            resolveTick,
            applyTick,
            passerId: owner.player.id,
            receiverId,
            decisionTimestamp: decision.timestamp,
            decisionTick,
            decisionAgeTicks,
            decisionTarget: decisionTargetSnapshot,
            receiverAtResolve,
            receiverResolveTick: receiver
              ? resolveTick
              : null,
            matched: false,
          };

          const key = resolveTick + '|' + owner.player.id;
          const bucket = pendingByTickAndPasser.get(key) ?? [];
          bucket.push(pending);
          pendingByTickAndPasser.set(key, bucket);

          return originalResolve(owner, decision, state);
        });

      const originalPass = ballModule.applyPass;

      passSpy = vi
        .spyOn(ballModule, 'applyPass')
        .mockImplementation(
          (ball, from, to, power, physics, playerId, clubId) => {
            const applyTick = currentTick + 1;
            const passerId = playerId ?? '';
            const resolveTick = applyTick;

            const key = resolveTick + '|' + passerId;
            const bucket = pendingByTickAndPasser.get(key) ?? [];
            const pending = bucket.find(item => !item.matched) ?? null;

            expect(pending).not.toBeNull();

            const result = originalPass(
              ball,
              from,
              to,
              power,
              physics,
              playerId,
              clubId
            );

            if (pending === null) {
              return result;
            }

            pending.matched = true;

            const nextApplySequence =
              (applySequenceByTick.get(applyTick) ?? 0) + 1;
            applySequenceByTick.set(applyTick, nextApplySequence);

            const applyTargetSnapshot = {
              x: to.x,
              y: to.y,
            };

            const trace: PassTrace = {
              resolveSequence: pending.resolveSequence,
              resolveSequenceInTick: pending.resolveSequenceInTick,
              applySequenceInTick: nextApplySequence,
              resolveTick: pending.resolveTick,
              applyTick,
              passerId: pending.passerId,
              receiverId: pending.receiverId,
              decisionTimestamp: pending.decisionTimestamp,
              decisionTick: pending.decisionTick,
              decisionAgeTicks: pending.decisionAgeTicks,
              decisionTarget: { ...pending.decisionTarget },
              applyTarget: applyTargetSnapshot,
              receiverAtResolve: pending.receiverAtResolve
                ? { ...pending.receiverAtResolve }
                : null,
              receiverAtApply: null,
              receiverResolveTick: pending.receiverResolveTick,
              receiverApplyTick: null,
              distanceDecisionToApply: distance2D(
                pending.decisionTarget,
                applyTargetSnapshot
              ),
              distanceDecisionToResolve:
                pending.receiverAtResolve === null
                  ? null
                  : distance2D(
                      pending.decisionTarget,
                      pending.receiverAtResolve
                    ),
              distanceDecisionToApplyReceiver: null,
              distanceApplyToResolve:
                pending.receiverAtResolve === null
                  ? null
                  : distance2D(
                      applyTargetSnapshot,
                      pending.receiverAtResolve
                    ),
              distanceApplyToApplyReceiver: null,
              decisionTargetEqualsApplyTarget: sameVec(
                pending.decisionTarget,
                applyTargetSnapshot
              ),
              receiverAtResolveEqualsApply: false,
              receiverResolveTickEqualsApply: false,
            };

            traces.push(trace);

            return result;
          }
        );

      const fixture = buildFixture();

      simulateMatchLive(fixture.home, fixture.away, fixture.players, {
        seed: MATCH_SEED,
        maxTicks: MATCH_TICKS,
        onTick: (state: LiveMatchState) => {
          currentTick = state.tick;

          const applyTraces = traces.filter(
            trace =>
              trace.applyTick === state.tick &&
              trace.receiverAtApply === null &&
              trace.receiverId !== null
          );

          for (const trace of applyTraces) {
            const receiver = state.players[trace.receiverId!];

            if (!receiver) continue;

            trace.receiverAtApply = {
              x: receiver.position.x,
              y: receiver.position.y,
            };
            trace.receiverApplyTick = state.tick;

            trace.distanceDecisionToApplyReceiver = distance2D(
              trace.decisionTarget,
              trace.receiverAtApply
            );

            trace.distanceApplyToApplyReceiver = distance2D(
              trace.applyTarget,
              trace.receiverAtApply
            );

            trace.receiverAtResolveEqualsApply = sameVec(
              trace.receiverAtResolve,
              trace.receiverAtApply
            );

            trace.receiverResolveTickEqualsApply =
              trace.receiverResolveTick === trace.receiverApplyTick;
          }
        },
      });

      const allPending = [...pendingByTickAndPasser.values()].flat();
      const unmatched = allPending.filter(item => !item.matched);
      const matchedCount = allPending.length - unmatched.length;

      const missingReceiverApply = traces.filter(
        trace =>
          trace.receiverId !== null &&
          trace.receiverAtApply === null
      );

      const resolveCalls = resolveSpy.mock.calls.length;
      const applyCalls = passSpy.mock.calls.length;

      const distanceDecisionToApply = traces.map(
        trace => trace.distanceDecisionToApply
      );
      const distanceDecisionToResolve = traces
        .map(trace => trace.distanceDecisionToResolve)
        .filter((value): value is number => value !== null);
      const distanceDecisionToApplyReceiver = traces
        .map(trace => trace.distanceDecisionToApplyReceiver)
        .filter((value): value is number => value !== null);
      const distanceApplyToResolve = traces
        .map(trace => trace.distanceApplyToResolve)
        .filter((value): value is number => value !== null);
      const distanceApplyToApplyReceiver = traces
        .map(trace => trace.distanceApplyToApplyReceiver)
        .filter((value): value is number => value !== null);

      const targetEqualCount = traces.filter(
        trace => trace.decisionTargetEqualsApplyTarget
      ).length;

      const receiverEqualCount = traces.filter(
        trace => trace.receiverAtResolveEqualsApply
      ).length;

      const receiverTickEqualCount = traces.filter(
        trace => trace.receiverResolveTickEqualsApply
      ).length;

      const center = traces.filter(
        trace => trace.applyTick === CENTER_TICK
      );

      console.log('');
      console.log('=== V9.3 TARGET SNAPSHOT DISAMBIGUATION ===');
      console.log('resolvePassAction calls=' + resolveCalls);
      console.log('applyPass calls=' + applyCalls);
      console.log('matched=' + matchedCount);
      console.log('unmatched resolvePassAction=' + unmatched.length);
      console.log(
        'multipleResolveSameTickDetected=' +
          [...resolveSequenceInTick.values()].some(value => value > 1)
      );

      console.log('');
      console.log('AGGREGATE');
      console.log('total matched=' + traces.length);
      console.log(
        'median distance(decisionTarget, applyTarget)=' +
          (median(distanceDecisionToApply)?.toFixed(3) ?? 'n/a')
      );
      console.log(
        'median distance(decisionTarget, receiverAtResolve)=' +
          (median(distanceDecisionToResolve)?.toFixed(3) ?? 'n/a')
      );
      console.log(
        'median distance(decisionTarget, receiverAtApply)=' +
          (median(distanceDecisionToApplyReceiver)?.toFixed(3) ?? 'n/a')
      );
      console.log(
        'median distance(applyTarget, receiverAtResolve)=' +
          (median(distanceApplyToResolve)?.toFixed(3) ?? 'n/a')
      );
      console.log(
        'median distance(applyTarget, receiverAtApply)=' +
          (median(distanceApplyToApplyReceiver)?.toFixed(3) ?? 'n/a')
      );
      console.log(
        'count decisionTargetEqualsApplyTarget=' +
          targetEqualCount +
          ' (' +
          ((targetEqualCount / traces.length) * 100).toFixed(2) +
          '%)'
      );
      console.log(
        'count receiverAtResolveEqualsApply=' +
          receiverEqualCount +
          ' (' +
          ((receiverEqualCount / traces.length) * 100).toFixed(2) +
          '%)'
      );
      console.log(
        'count receiverResolveTickEqualsApply=' +
          receiverTickEqualCount +
          ' (' +
          ((receiverTickEqualCount / traces.length) * 100).toFixed(2) +
          '%)'
      );
      console.log(
        'receiver@apply missing=' + missingReceiverApply.length
      );

      console.log('');
      console.log('=== V9.3 CENTER TRACE ===');

      if (center.length === 0) {
        console.log('applyPass @ ' + CENTER_TICK + ' NOT FOUND');
      } else {
        for (const trace of center) {
          console.log('applyPass @ ' + trace.applyTick);
          console.log('  passer            = ' + trace.passerId);
          console.log(
            '  receiver          = ' +
              (trace.receiverId ?? 'null')
          );
          console.log(
            '  decision.timestamp = ' +
              trace.decisionTimestamp.toFixed(12)
          );
          console.log(
            '  decisionTick       = ' + trace.decisionTick
          );
          console.log(
            '  resolveTick        = ' + trace.resolveTick
          );
          console.log(
            '  applyTick          = ' + trace.applyTick
          );
          console.log(
            '  decisionAgeTicks   = ' +
              trace.decisionAgeTicks
          );
          console.log(
            '  decisionTarget    = ' +
              formatVec(trace.decisionTarget)
          );
          console.log(
            '  applyTarget       = ' +
              formatVec(trace.applyTarget)
          );
          console.log(
            '  receiverAtResolve = ' +
              formatVec(trace.receiverAtResolve)
          );
          console.log(
            '  receiverAtApply   = ' +
              formatVec(trace.receiverAtApply)
          );
          console.log(
            '  receiverResolveTick = ' +
              (trace.receiverResolveTick ?? 'null')
          );
          console.log(
            '  receiverApplyTick   = ' +
              (trace.receiverApplyTick ?? 'null')
          );
          console.log(
            '  distance(decisionTarget, applyTarget) = ' +
              trace.distanceDecisionToApply.toFixed(3) +
              'm'
          );
          console.log(
            '  distance(decisionTarget, receiverAtResolve) = ' +
              (trace.distanceDecisionToResolve === null
                ? 'null'
                : trace.distanceDecisionToResolve.toFixed(3) + 'm')
          );
          console.log(
            '  distance(decisionTarget, receiverAtApply) = ' +
              (trace.distanceDecisionToApplyReceiver === null
                ? 'null'
                : trace.distanceDecisionToApplyReceiver.toFixed(3) + 'm')
          );
          console.log(
            '  distance(applyTarget, receiverAtResolve) = ' +
              (trace.distanceApplyToResolve === null
                ? 'null'
                : trace.distanceApplyToResolve.toFixed(3) + 'm')
          );
          console.log(
            '  distance(applyTarget, receiverAtApply) = ' +
              (trace.distanceApplyToApplyReceiver === null
                ? 'null'
                : trace.distanceApplyToApplyReceiver.toFixed(3) + 'm')
          );
          console.log('  flags:');
          console.log(
            '    decisionTargetEqualsApplyTarget = ' +
              trace.decisionTargetEqualsApplyTarget
          );
          console.log(
            '    receiverAtResolveEqualsApply = ' +
              trace.receiverAtResolveEqualsApply
          );
          console.log(
            '    receiverResolveTickEqualsApply = ' +
              trace.receiverResolveTickEqualsApply
          );
        }
      }

      expect(resolveCalls).toBeGreaterThan(0);
      expect(applyCalls).toBeGreaterThan(0);
      expect(traces.length).toBe(applyCalls);
      expect(matchedCount).toBe(applyCalls);
      expect(unmatched.length).toBe(resolveCalls - applyCalls);
      expect(missingReceiverApply.length).toBe(0);
      expect(
        traces.every(
          trace => trace.resolveTick === trace.applyTick
        )
      ).toBe(true);
      expect(
        traces.every(
          trace =>
            trace.receiverResolveTick === trace.resolveTick
        )
      ).toBe(true);
      expect(
        traces.every(
          trace =>
            trace.receiverApplyTick === trace.applyTick
        )
      ).toBe(true);
      expect(
        traces.every(
          trace =>
            Number.isInteger(trace.decisionAgeTicks) &&
            trace.decisionAgeTicks >= 0
        )
      ).toBe(true);
    },
    120 * 1000
  );
});
