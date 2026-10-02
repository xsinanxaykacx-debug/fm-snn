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

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const CENTER_TICK = 53_497;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_PASS_DECISION_FRESHNESS === '1';

interface PendingResolution {
  resolveSequence: number;
  resolveTick: number;
  passerId: string;
  receiverId: string | null;
  decisionTarget: Vec2;
  probability: number;
  pressure: number;
  quality: number;
  defenderId: string | null;
  matched: boolean;
}

interface PassAudit {
  resolveSequence: number;
  resolveTick: number;
  applyTick: number;
  passerId: string;
  receiverId: string | null;
  decisionTarget: Vec2;
  applyTarget: Vec2;
  probability: number;
  pressure: number;
  quality: number;
  defenderId: string | null;
  completed: boolean;
}

function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function formatVec(value: Vec2): string {
  return '(' + value.x.toFixed(3) + ', ' + value.y.toFixed(3) + ')';
}

function pct(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

describe('Pass Resolution Probability Audit V9.4', () => {
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
    'audits resolve probability against pass completion without changing production behavior',
    ({ skip }) => {
      if (!RUN) skip();

      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

      const pendingByTickAndPasser = new Map<string, PendingResolution[]>();
      const audits: PassAudit[] = [];
      const unmatched: PendingResolution[] = [];

      let currentTick = 0;
      let resolveSequence = 0;

      const originalResolve = actionResolutionModule.resolvePassAction;

      resolveSpy = vi
        .spyOn(actionResolutionModule, 'resolvePassAction')
        .mockImplementation((owner, decision, state) => {
          const result = originalResolve(owner, decision, state);

          if (decision.target === null) {
            return result;
          }

          resolveSequence += 1;

          const decisionTarget = {
            x: decision.target.x,
            y: decision.target.y,
          };

          const receiverId =
            typeof decision.targetPlayerId === 'string'
              ? decision.targetPlayerId
              : null;

          const pending: PendingResolution = {
            resolveSequence,
            resolveTick: state.tick,
            passerId: owner.player.id,
            receiverId,
            decisionTarget,
            probability: result.probability,
            pressure: result.pressure,
            quality: result.quality,
            defenderId: result.defenderId,
            matched: false,
          };

          const key = state.tick + '|' + owner.player.id;
          const bucket = pendingByTickAndPasser.get(key) ?? [];
          bucket.push(pending);
          pendingByTickAndPasser.set(key, bucket);

          return result;
        });

      const originalPass = ballModule.applyPass;

      passSpy = vi
        .spyOn(ballModule, 'applyPass')
        .mockImplementation(
          (ball, from, to, power, physics, playerId, clubId) => {
            const applyTick = currentTick + 1;
            const passerId = playerId ?? '';
            const key = applyTick + '|' + passerId;
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

            const applyTarget = {
              x: to.x,
              y: to.y,
            };

            const completed =
              distance2D(applyTarget, pending.decisionTarget) < 0.01;

            audits.push({
              resolveSequence: pending.resolveSequence,
              resolveTick: pending.resolveTick,
              applyTick,
              passerId: pending.passerId,
              receiverId: pending.receiverId,
              decisionTarget: { ...pending.decisionTarget },
              applyTarget,
              probability: pending.probability,
              pressure: pending.pressure,
              quality: pending.quality,
              defenderId: pending.defenderId,
              completed,
            });

            return result;
          }
        );

      const fixture = buildFixture();

      simulateMatchLive(fixture.home, fixture.away, fixture.players, {
        seed: MATCH_SEED,
        maxTicks: MATCH_TICKS,
        onTick: (state: LiveMatchState) => {
          currentTick = state.tick;
        },
      });

      for (const bucket of pendingByTickAndPasser.values()) {
        for (const item of bucket) {
          if (!item.matched) unmatched.push(item);
        }
      }

      const resolveCalls = resolveSpy.mock.calls.length;
      const applyCalls = passSpy.mock.calls.length;

      const allProbabilities = [...pendingByTickAndPasser.values()]
        .flat()
        .map(item => item.probability);

      const matchedProbabilities = audits.map(audit => audit.probability);
      const completedProbabilities = audits
        .filter(audit => audit.completed)
        .map(audit => audit.probability);
      const failedProbabilities = audits
        .filter(audit => !audit.completed)
        .map(audit => audit.probability);

      const countBelow015 = matchedProbabilities.filter(p => p < 0.15).length;
      const count015To025 = matchedProbabilities.filter(
        p => p >= 0.15 && p < 0.25
      ).length;
      const count025To040 = matchedProbabilities.filter(
        p => p >= 0.25 && p < 0.40
      ).length;
      const count040To060 = matchedProbabilities.filter(
        p => p >= 0.40 && p < 0.60
      ).length;
      const count060To080 = matchedProbabilities.filter(
        p => p >= 0.60 && p < 0.80
      ).length;
      const countAbove080 = matchedProbabilities.filter(p => p >= 0.80).length;

      const pMean = mean(matchedProbabilities) ?? 0;
      const completionRate =
        audits.length === 0
          ? 0
          : audits.filter(audit => audit.completed).length / audits.length;

      const probabilityCompletionDelta = Math.abs(
        pMean - completionRate
      );

      const center = audits.filter(
        audit => audit.applyTick === CENTER_TICK
      );

      console.log('');
      console.log('=== V9.4 PASS RESOLUTION PROBABILITY AUDIT ===');
      console.log('resolvePassAction calls=' + resolveCalls);
      console.log('applyPass calls=' + applyCalls);
      console.log('matched=' + audits.length);
      console.log('unmatched resolvePassAction=' + unmatched.length);

      console.log('');
      console.log('ALL RESOLUTION PROBABILITIES (including unmatched)');
      console.log(
        'count=' +
          allProbabilities.length +
          ' mean=' +
          (mean(allProbabilities)?.toFixed(4) ?? 'n/a') +
          ' median=' +
          (median(allProbabilities)?.toFixed(4) ?? 'n/a') +
          ' min=' +
          (Math.min(...allProbabilities).toFixed(4)) +
          ' max=' +
          (Math.max(...allProbabilities).toFixed(4))
      );

      console.log('');
      console.log('MATCHED PASS AGGREGATE');
      console.log('count=' + matchedProbabilities.length);
      console.log(
        'mean probability=' +
          (mean(matchedProbabilities)?.toFixed(4) ?? 'n/a')
      );
      console.log(
        'median probability=' +
          (median(matchedProbabilities)?.toFixed(4) ?? 'n/a')
      );
      console.log(
        'min probability=' +
          (Math.min(...matchedProbabilities).toFixed(4))
      );
      console.log(
        'max probability=' +
          (Math.max(...matchedProbabilities).toFixed(4))
      );

      console.log('');
      console.log('DISTRIBUTION');
      console.log(
        '<0.15=' +
          countBelow015 +
          ' (' +
          pct(countBelow015 / matchedProbabilities.length) +
          ')'
      );
      console.log(
        '0.15–0.25=' +
          count015To025 +
          ' (' +
          pct(count015To025 / matchedProbabilities.length) +
          ')'
      );
      console.log(
        '0.25–0.40=' +
          count025To040 +
          ' (' +
          pct(count025To040 / matchedProbabilities.length) +
          ')'
      );
      console.log(
        '0.40–0.60=' +
          count040To060 +
          ' (' +
          pct(count040To060 / matchedProbabilities.length) +
          ')'
      );
      console.log(
        '0.60–0.80=' +
          count060To080 +
          ' (' +
          pct(count060To080 / matchedProbabilities.length) +
          ')'
      );
      console.log(
        '>0.80=' +
          countAbove080 +
          ' (' +
          pct(countAbove080 / matchedProbabilities.length) +
          ')'
      );

      console.log('');
      console.log('COMPLETED VS FAILED');
      console.log(
        'completed=true count=' +
          completedProbabilities.length +
          ' mean probability=' +
          (mean(completedProbabilities)?.toFixed(4) ?? 'n/a')
      );
      console.log(
        'completed=false count=' +
          failedProbabilities.length +
          ' mean probability=' +
          (mean(failedProbabilities)?.toFixed(4) ?? 'n/a')
      );

      console.log('');
      console.log('PROBABILITY / COMPLETION CONSISTENCY');
      console.log('P_mean=' + pMean.toFixed(4));
      console.log('C_rate=' + completionRate.toFixed(4));
      console.log(
        '|P_mean - C_rate|=' +
          probabilityCompletionDelta.toFixed(4)
      );
      console.log(
        'within_0.05=' +
          (probabilityCompletionDelta < 0.05)
      );

      console.log('');
      console.log('=== V9.4 CENTER TRACE ===');

      if (center.length === 0) {
        console.log('applyPass @ ' + CENTER_TICK + ' NOT FOUND');
      } else {
        for (const audit of center) {
          console.log('resolvePassAction @ ' + audit.resolveTick);
          console.log('  passer          = ' + audit.passerId);
          console.log(
            '  receiver        = ' +
              (audit.receiverId ?? 'null')
          );
          console.log(
            '  decision.target = ' +
              formatVec(audit.decisionTarget)
          );
          console.log(
            '  probability     = ' +
              audit.probability.toFixed(6)
          );
          console.log(
            '  pressure        = ' +
              audit.pressure.toFixed(6)
          );
          console.log(
            '  quality         = ' +
              audit.quality.toFixed(6)
          );
          console.log(
            '  defenderId      = ' +
              (audit.defenderId ?? 'null')
          );
          console.log('');
          console.log('applyPass @ ' + audit.applyTick);
          console.log('  to              = ' + formatVec(audit.applyTarget));
          console.log(
            '  decisionTarget  = ' +
              formatVec(audit.decisionTarget)
          );
          console.log(
            '  completed       = ' +
              audit.completed
          );
        }
      }

      expect(resolveCalls).toBeGreaterThan(0);
      expect(applyCalls).toBeGreaterThan(0);
      expect(audits.length).toBe(applyCalls);
      expect(unmatched.length).toBe(resolveCalls - applyCalls);
      expect(unmatched.length).toBe(2);
      expect(
        audits.every(audit => audit.resolveTick === audit.applyTick)
      ).toBe(true);
      expect(
        audits.every(audit => audit.probability >= 0.10)
      ).toBe(true);
      expect(
        audits.every(audit => audit.probability <= 0.96)
      ).toBe(true);
      expect(
        audits.filter(audit => audit.completed).length +
          audits.filter(audit => !audit.completed).length
      ).toBe(audits.length);
    },
    120 * 1000
  );
});
