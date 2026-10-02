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
const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_PASS_DECISION_FRESHNESS === '1';

type FreshnessClass =
  | 'NEW_DECISION'
  | 'STALE_SHORT'
  | 'STALE_LONG';

interface PassTrace {
  applyTick: number;
  passerId: string;
  receiverId: string | null;
  decisionTimestamp: number;
  decisionTick: number;
  decisionAgeTicks: number;
  freshness: FreshnessClass;
  target: Vec2;
  receiverPosAtResolve: Vec2 | null;
  receiverPosAtApply: Vec2 | null;
  distanceTargetToResolve: number | null;
  distanceTargetToApply: number | null;
  impossibleFreshLargeDistance: boolean;
}

interface PendingResolution {
  applyTick: number;
  passerId: string;
  receiverId: string | null;
  decisionTimestamp: number;
  decisionTick: number;
  decisionAgeTicks: number;
  target: Vec2;
  receiverPosAtResolve: Vec2 | null;
  matched: boolean;
  trace: PassTrace | null;
}

function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyAge(age: number): FreshnessClass {
  if (age === 0) return 'NEW_DECISION';
  if (age <= 3) return 'STALE_SHORT';
  return 'STALE_LONG';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function maxOrNull(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
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

describe('Pass Decision Freshness Diagnostic V9.2', () => {
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
    'verifies resolvePassAction exposes decision.timestamp and state.tick',
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
      console.log('=== V9.2 SPY ACCESS CHECK ===');
      console.log('ticks=' + SPY_ACCESS_TICKS);
      console.log(
        'resolvePassAction calls=' + resolveSpy.mock.calls.length
      );
      console.log(
        'spyAccessCheck=' + (resolveSpy.mock.calls.length > 0)
      );

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
    'measures decision freshness for every applied pass without changing production behavior',
    ({ skip }) => {
      if (!RUN) skip();

      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

      const traces: PassTrace[] = [];
      const pendingByTick = new Map<number, PendingResolution[]>();
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

          const receiver =
            receiverId !== null ? state.players[receiverId] : undefined;

          const receiverPosAtResolve = receiver
            ? { ...receiver.position }
            : null;

          /*
           * resolvePassAction is called during tick N.
           * V9.1 established the actual applyPass/onTick pairing as
           * currentTick + 1, so V9.2 preserves that exact convention.
           */
          const applyTick = currentTick + 1;

          /*
           * Decision.timestamp is production Decision creation time.
           * config.ts defines TICK_DURATION = 0.1s.
           *
           * decisionTick is derived from timestamp with Math.round so
           * accumulated floating-point error in state.time cannot create
           * a false one-tick age.
           */
          const decisionTick = Math.round(
            decision.timestamp / TICK_DURATION
          );

          const decisionAgeTicks = applyTick - decisionTick;

          expect(Number.isInteger(decisionAgeTicks)).toBe(true);
          expect(decisionAgeTicks).toBeGreaterThanOrEqual(0);

          const target = { ...decision.target };

          const pending: PendingResolution = {
            applyTick,
            passerId: owner.player.id,
            receiverId,
            decisionTimestamp: decision.timestamp,
            decisionTick,
            decisionAgeTicks,
            target,
            receiverPosAtResolve,
            matched: false,
            trace: null,
          };

          const bucket = pendingByTick.get(applyTick) ?? [];
          bucket.push(pending);
          pendingByTick.set(applyTick, bucket);

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

            const applyTick = currentTick + 1;
            const bucket = pendingByTick.get(applyTick) ?? [];

            const pending =
              bucket.find(
                item =>
                  !item.matched &&
                  item.passerId === (playerId ?? '')
              ) ?? null;

            expect(pending).not.toBeNull();

            if (pending === null) {
              return result;
            }

            pending.matched = true;

            const freshness = classifyAge(
              pending.decisionAgeTicks
            );

            const trace: PassTrace = {
              applyTick,
              passerId: pending.passerId,
              receiverId: pending.receiverId,
              decisionTimestamp: pending.decisionTimestamp,
              decisionTick: pending.decisionTick,
              decisionAgeTicks: pending.decisionAgeTicks,
              freshness,
              target: { ...to },
              receiverPosAtResolve:
                pending.receiverPosAtResolve,
              receiverPosAtApply: null,
              distanceTargetToResolve:
                pending.receiverPosAtResolve === null
                  ? null
                  : distance2D(
                      pending.target,
                      pending.receiverPosAtResolve
                    ),
              distanceTargetToApply: null,
              impossibleFreshLargeDistance: false,
            };

            traces.push(trace);
            pending.trace = trace;

            return result;
          }
        );

      const fixture = buildFixture();

      simulateMatchLive(fixture.home, fixture.away, fixture.players, {
        seed: MATCH_SEED,
        maxTicks: MATCH_TICKS,
        onTick: (state: LiveMatchState) => {
          currentTick = state.tick;

          /*
           * onTick observes the post-tick state. Because V9.1 pairs
           * applyPass with currentTick + 1, state.tick === applyTick
           * is the receiver@apply snapshot we want.
           */
          const tracesAtTick = traces.filter(
            trace =>
              trace.applyTick === state.tick &&
              trace.receiverId !== null &&
              trace.receiverPosAtApply === null
          );

          for (const trace of tracesAtTick) {
            const receiver = state.players[trace.receiverId!];

            if (!receiver) continue;

            trace.receiverPosAtApply = {
              ...receiver.position,
            };

            trace.distanceTargetToApply = distance2D(
              trace.target,
              trace.receiverPosAtApply
            );

            /*
             * A fresh decision uses the receiver position as the
             * decision target. With a 10 Hz engine and player speeds
             * in the normal ~5-6 m/s range, a fresh decision cannot
             * legitimately explain a 10m target displacement in one
             * tick. We deliberately flag rather than assume.
             */
            trace.impossibleFreshLargeDistance =
              trace.decisionAgeTicks === 0 &&
              trace.distanceTargetToApply > 1.0;
          }
        },
      });

      const unmatched =
        [...pendingByTick.values()]
          .flat()
          .filter(item => !item.matched);

      const unresolvedReceiverSnapshots = traces.filter(
        trace =>
          trace.receiverId !== null &&
          trace.receiverPosAtApply === null
      );

      const newDecisions = traces.filter(
        trace => trace.freshness === 'NEW_DECISION'
      );

      const staleShort = traces.filter(
        trace => trace.freshness === 'STALE_SHORT'
      );

      const staleLong = traces.filter(
        trace => trace.freshness === 'STALE_LONG'
      );

      const withResolveDistance = traces.filter(
        trace => trace.distanceTargetToResolve !== null
      );

      const withApplyDistance = traces.filter(
        trace => trace.distanceTargetToApply !== null
      );

      const reportGroup = (
        name: string,
        group: PassTrace[]
      ): void => {
        const applyDistances = group
          .map(trace => trace.distanceTargetToApply)
          .filter((value): value is number => value !== null);

        const resolveDistances = group
          .map(trace => trace.distanceTargetToResolve)
          .filter((value): value is number => value !== null);

        console.log('');
        console.log(name);
        console.log(
          'count=' + group.length
        );
        console.log(
          'median distance(target, receiver@resolve)=' +
            (median(resolveDistances)?.toFixed(3) ?? 'n/a')
        );
        console.log(
          'median distance(target, receiver@apply)=' +
            (median(applyDistances)?.toFixed(3) ?? 'n/a')
        );
        console.log(
          'max distance(target, receiver@apply)=' +
            (maxOrNull(applyDistances)?.toFixed(3) ?? 'n/a')
        );
      };

      const ages = traces.map(
        trace => trace.decisionAgeTicks
      );

      console.log('');
      console.log('=== V9.2 DECISION FRESHNESS ===');
      console.log('total applyPass=' + traces.length);
      console.log(
        'NEW_DECISION (age=0)=' + newDecisions.length
      );
      console.log(
        'STALE_SHORT (age 1-3)=' + staleShort.length
      );
      console.log(
        'STALE_LONG (age >=4)=' + staleLong.length
      );
      console.log(
        'median decisionAgeTicks=' +
          (median(ages)?.toFixed(3) ?? 'n/a')
      );
      console.log(
        'max decisionAgeTicks=' +
          (maxOrNull(ages) ?? 'n/a')
      );
      console.log(
        'decisionAgeTicks=0 but distance>1m=' +
          traces.filter(
            trace => trace.impossibleFreshLargeDistance
          ).length
      );
      console.log(
        'unmatched resolvePassAction=' + unmatched.length
      );
      console.log(
        'receiver@apply missing=' +
          unresolvedReceiverSnapshots.length
      );

      reportGroup('NEW_DECISION DETAILS', newDecisions);
      reportGroup('STALE_SHORT DETAILS', staleShort);
      reportGroup('STALE_LONG DETAILS', staleLong);

      const center = traces.filter(
        trace => trace.applyTick === CENTER_TICK
      );

      console.log('');
      console.log('=== V9.2 CENTER TRACE ===');

      if (center.length === 0) {
        console.log('applyPass @ ' + CENTER_TICK + ' NOT FOUND');
      } else {
        for (const trace of center) {
          console.log(
            'applyPass @ ' + trace.applyTick
          );
          console.log(
            '  passer = ' + trace.passerId
          );
          console.log(
            '  receiver = ' + (trace.receiverId ?? 'null')
          );
          console.log(
            '  decision.timestamp = ' +
              trace.decisionTimestamp.toFixed(12)
          );
          console.log(
            '  decisionTick = ' + trace.decisionTick
          );
          console.log(
            '  decisionAgeTicks = ' +
              trace.decisionAgeTicks
          );
          console.log(
            '  freshness = ' + trace.freshness
          );
          console.log(
            '  decision.target = ' +
              '(' +
              trace.target.x.toFixed(3) +
              ', ' +
              trace.target.y.toFixed(3) +
              ')'
          );
          console.log(
            '  receiver@resolve = ' +
              (trace.receiverPosAtResolve === null
                ? 'null'
                : '(' +
                  trace.receiverPosAtResolve.x.toFixed(3) +
                  ', ' +
                  trace.receiverPosAtResolve.y.toFixed(3) +
                  ')')
          );
          console.log(
            '  receiver@apply = ' +
              (trace.receiverPosAtApply === null
                ? 'null'
                : '(' +
                  trace.receiverPosAtApply.x.toFixed(3) +
                  ', ' +
                  trace.receiverPosAtApply.y.toFixed(3) +
                  ')')
          );
          console.log(
            '  distance(target, receiver@resolve) = ' +
              (trace.distanceTargetToResolve === null
                ? 'null'
                : trace.distanceTargetToResolve.toFixed(3) + 'm')
          );
          console.log(
            '  distance(target, receiver@apply) = ' +
              (trace.distanceTargetToApply === null
                ? 'null'
                : trace.distanceTargetToApply.toFixed(3) + 'm')
          );
          console.log(
            '  impossibleFreshLargeDistance = ' +
              trace.impossibleFreshLargeDistance
          );
        }
      }

      /*
       * Hard integrity checks:
       * - Every applyPass must pair with exactly one resolve record.
       * - Every receiver-target pass must have an onTick apply snapshot.
       * - Age must never be negative.
       *
       * The >1m fresh-distance condition is diagnostic evidence, not
       * a test assumption about production physics, so it is reported
       * separately and not used to hide data.
       */
      expect(traces.length).toBeGreaterThan(0);
      expect(unmatched.length).toBe(0);
      expect(unresolvedReceiverSnapshots.length).toBe(0);
      expect(traces.every(
        trace => trace.decisionAgeTicks >= 0
      )).toBe(true);

      expect(
        withResolveDistance.length
      ).toBe(newDecisions.length + staleShort.length + staleLong.length);

      expect(
        withApplyDistance.length
      ).toBe(traces.length);
    },
    120 * 1000
  );
});
