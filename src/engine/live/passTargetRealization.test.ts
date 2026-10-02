import { describe, it, expect, vi, afterEach } from 'vitest';
import * as ballModule from './ball';
import * as eventsModule from './events';
import { simulateMatchLive } from './liveMatch';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
  type DeterministicRandomHandle,
} from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';
import type { LiveMatchState, MatchEvent, Vec2, Vec3 } from '../types';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const TRACE_TICKS = 50;
const TRACE_SAMPLE_LIMIT = 5_000;
const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_PASS_TARGET_REALIZATION === '1';

type PassOutcome = 'boundary' | 'possession' | 'interception' | 'none';

interface PassTrace {
  id: number;
  applyTick: number;
  playerId: string | null;
  clubId: string | null;
  from: Vec3;
  target: Vec2;
  power: number;
  expectedSpeed: number;
  initialVelocity: Vec3;
  initialSpeed: number;
  directionErrorDeg: number;
  samples: Array<{
    tick: number;
    position: Vec3;
    velocity: Vec3;
    distanceToTarget: number;
    projectionAlongTarget: number;
  }>;
  minDistance: number;
  minDistanceTick: number | null;
  velocityAtMinDistance: Vec3 | null;
  passedTarget: boolean;
  overshootDistance: number;
  ticksAfterPassing: number;
  outcome: PassOutcome;
  terminalTick: number | null;
  sampleOverflow: boolean;
}

interface TickSample {
  tick: number;
  position: Vec3;
  velocity: Vec3;
  distanceToTarget: number;
  projectionAlongTarget: number;
}

function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function speed3D(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function directionErrorDegrees(
  from: Vec3,
  target: Vec2,
  velocity: Vec3
): number {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const targetLen = Math.hypot(dx, dy);
  const velocityLen = Math.hypot(velocity.x, velocity.y);

  if (targetLen < 1e-9 || velocityLen < 1e-9) return 180;

  const dot =
    (dx * velocity.x + dy * velocity.y) /
    (targetLen * velocityLen);

  const clamped = Math.max(-1, Math.min(1, dot));
  return Math.acos(clamped) * (180 / Math.PI);
}

function projectionAlongTarget(
  from: Vec3,
  target: Vec2,
  position: Vec3
): number {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const targetDistance = Math.hypot(dx, dy);

  if (targetDistance < 1e-9) return 0;

  return (
    ((position.x - from.x) * dx +
      (position.y - from.y) * dy) /
    targetDistance
  );
}

function classifyRealization(trace: PassTrace): {
  minDistance: number;
  minDistanceTick: number | null;
  velocityAtMinDistance: Vec3 | null;
  passedTarget: boolean;
  overshootDistance: number;
  ticksAfterPassing: number;
} {
  if (trace.samples.length === 0) {
    return {
      minDistance: Number.POSITIVE_INFINITY,
      minDistanceTick: null,
      velocityAtMinDistance: null,
      passedTarget: false,
      overshootDistance: 0,
      ticksAfterPassing: 0,
    };
  }

  let minIndex = 0;

  for (let i = 1; i < trace.samples.length; i++) {
    if (
      trace.samples[i].distanceToTarget <
      trace.samples[minIndex].distanceToTarget
    ) {
      minIndex = i;
    }
  }

  const minSample = trace.samples[minIndex];

  // "Passed target" yalnızca hedef doğrultusunda hedef mesafesinin
  // ötesine geçiş ve minimum mesafeden sonra uzaklaşma ile kabul edilir.
  const targetDistance = distance2D(
    { x: trace.from.x, y: trace.from.y },
    trace.target
  );

  let passedTarget = false;
  let overshootDistance = 0;
  let ticksAfterPassing = 0;

  for (let i = minIndex + 1; i < trace.samples.length; i++) {
    const sample = trace.samples[i];

    if (
      sample.projectionAlongTarget > targetDistance &&
      sample.distanceToTarget > minSample.distanceToTarget + 1e-6
    ) {
      passedTarget = true;
      overshootDistance = Math.max(
        overshootDistance,
        sample.projectionAlongTarget - targetDistance
      );
      ticksAfterPassing = trace.samples.length - i;
      break;
    }
  }

  return {
    minDistance: minSample.distanceToTarget,
    minDistanceTick: minSample.tick,
    velocityAtMinDistance: { ...minSample.velocity },
    passedTarget,
    overshootDistance,
    ticksAfterPassing,
  };
}

function targetBand(minDistance: number): 'reached' | 'near' | 'not_reached' {
  if (minDistance < 1) return 'reached';
  if (minDistance < 5) return 'near';
  return 'not_reached';
}

function formatVec(v: Vec3 | Vec2): string {
  return `(${v.x.toFixed(3)},${v.y.toFixed(3)}${'z' in v ? `,${v.z.toFixed(3)}` : ''})`;
}

describe('Pass Target Realization Diagnostic V9', () => {
  let random: DeterministicRandomHandle | null = null;
  let passSpy: ReturnType<typeof vi.spyOn> | null = null;
  let controlSpy: ReturnType<typeof vi.spyOn> | null = null;
  let boundarySpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    passSpy?.mockRestore();
    controlSpy?.mockRestore();
    boundarySpy?.mockRestore();
    random?.restore();

    passSpy = null;
    controlSpy = null;
    boundarySpy = null;
    random = null;
  });

  it(
    'measures every applyPass target realization without changing production behavior',
    ({ skip }) => {
      if (!RUN) skip();

      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);

      const traces: PassTrace[] = [];
      let active: PassTrace | null = null;
      let currentTick = 0;
      let nextPassId = 1;

      const originalPass = ballModule.applyPass;
      passSpy = vi
        .spyOn(ballModule, 'applyPass')
        .mockImplementation((ball, from, to, power, physics, playerId, clubId) => {
          const result = originalPass(
            ball,
            from,
            to,
            power,
            physics,
            playerId,
            clubId
          );

          const initialVelocity = { ...result.velocity };
          const initialSpeed = speed3D(initialVelocity);
          const expectedSpeed = 4 + Math.max(0, Math.min(1, power)) * 21;

          active = {
            id: nextPassId++,
            applyTick: currentTick + 1,
            playerId: playerId ?? null,
            clubId: clubId ?? null,
            from: { ...from },
            target: { ...to },
            power,
            expectedSpeed,
            initialVelocity,
            initialSpeed,
            directionErrorDeg: directionErrorDegrees(
              from,
              to,
              initialVelocity
            ),
            samples: [],
            minDistance: Number.POSITIVE_INFINITY,
            minDistanceTick: null,
            velocityAtMinDistance: null,
            passedTarget: false,
            overshootDistance: 0,
            ticksAfterPassing: 0,
            outcome: 'none',
            terminalTick: null,
            sampleOverflow: false,
          };

          traces.push(active);
          return result;
        });

      const originalControl = ballModule.controlBall;
      controlSpy = vi
        .spyOn(ballModule, 'controlBall')
        .mockImplementation((ball, playerId, clubId) => {
          const result = originalControl(ball, playerId, clubId);

          if (
            active !== null &&
            active.outcome === 'none' &&
            currentTick + 1 > active.applyTick
          ) {
            active.outcome =
              clubId === active.clubId ? 'possession' : 'interception';
            active.terminalTick = currentTick + 1;
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
            result.type !== 'none' &&
            currentTick + 1 > active.applyTick
          ) {
            active.outcome = 'boundary';
            active.terminalTick = currentTick + 1;
          }

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
        onTick: (state: LiveMatchState) => {
          currentTick = state.tick;

          if (active === null || active.outcome !== 'none') {
            return;
          }

          const ticksSinceApply = state.tick - active.applyTick + 1;

          if (
            ticksSinceApply < 1 ||
            ticksSinceApply > TRACE_TICKS
          ) {
            return;
          }

          if (active.samples.length >= TRACE_SAMPLE_LIMIT) {
            active.sampleOverflow = true;
            return;
          }

          const sample: TickSample = {
            tick: state.tick,
            position: { ...state.ball.position },
            velocity: { ...state.ball.velocity },
            distanceToTarget: distance2D(
              { x: state.ball.position.x, y: state.ball.position.y },
              active.target
            ),
            projectionAlongTarget: projectionAlongTarget(
              active.from,
              active.target,
              state.ball.position
            ),
          };

          active.samples.push(sample);

          if (ticksSinceApply === TRACE_TICKS) {
            active.outcome = 'none';
            active.terminalTick = null;
          }
        },
      });

      // Yukarıdaki aktif-trace modeli terminal olayla erken kapanır.
      // Terminal olmayan son paslar için zaten 50 tick'e kadar sample alınmıştır.
      // Şimdi her trace'in realization ölçülerini hesaplıyoruz.
      for (const trace of traces) {
        const realization = classifyRealization(trace);
        trace.minDistance = realization.minDistance;
        trace.minDistanceTick = realization.minDistanceTick;
        trace.velocityAtMinDistance = realization.velocityAtMinDistance;
        trace.passedTarget = realization.passedTarget;
        trace.overshootDistance = realization.overshootDistance;
        trace.ticksAfterPassing = realization.ticksAfterPassing;
      }

      const speedMismatches = traces.filter(
        trace => Math.abs(trace.initialSpeed - trace.expectedSpeed) > 1e-9
      );

      const reached = traces.filter(
        trace => targetBand(trace.minDistance) === 'reached'
      );
      const near = traces.filter(
        trace => targetBand(trace.minDistance) === 'near'
      );
      const notReached = traces.filter(
        trace => targetBand(trace.minDistance) === 'not_reached'
      );
      const passed = traces.filter(trace => trace.passedTarget);

      const outcomeCounts: Record<PassOutcome, number> = {
        boundary: 0,
        possession: 0,
        interception: 0,
        none: 0,
      };

      for (const trace of traces) {
        outcomeCounts[trace.outcome]++;
      }

      const overshoots = passed
        .map(trace => trace.overshootDistance)
        .sort((a, b) => a - b);

      const minDistances = traces
        .map(trace => trace.minDistance)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      const median = (values: number[]): number | null => {
        if (values.length === 0) return null;
        const mid = Math.floor(values.length / 2);
        return values.length % 2 === 0
          ? (values[mid - 1] + values[mid]) / 2
          : values[mid];
      };

      const target53497 = traces.filter(
        trace => trace.applyTick === 53497
      );

      const boundaryTraces = traces.filter(
        trace => trace.outcome === 'boundary'
      );

      console.log('');
      console.log('=== V9 PASS TARGET REALIZATION ===');
      console.log(`seed=${MATCH_SEED} ticks=${MATCH_TICKS}`);
      console.log(`traceWindow=${TRACE_TICKS} ticks`);
      console.log(`total applyPass calls=${traces.length}`);
      console.log('');
      console.log('--- speed / direction integrity ---');
      console.log(`speed formula mismatches=${speedMismatches.length}`);
      console.log(
        `max direction error deg=${
          Math.max(
            0,
            ...traces.map(trace => trace.directionErrorDeg)
          ).toFixed(6)
        }`
      );
      console.log('');
      console.log('--- target realization aggregate ---');
      console.log(`target reached (<1m)=${reached.length}`);
      console.log(`target near (1-5m)=${near.length}`);
      console.log(`target not reached (>5m)=${notReached.length}`);
      console.log(`passed target=${passed.length}`);
      console.log(
        `median overshoot=${
          median(overshoots)?.toFixed(3) ?? 'N/A'
        } m`
      );
      console.log(
        `median min distance=${
          median(minDistances)?.toFixed(3) ?? 'N/A'
        } m`
      );
      console.log('');
      console.log('--- pass outcomes ---');
      console.log(`boundary=${outcomeCounts.boundary}`);
      console.log(`possession=${outcomeCounts.possession}`);
      console.log(`interception=${outcomeCounts.interception}`);
      console.log(`none=${outcomeCounts.none}`);
      console.log('');
      console.log('--- 53497 center case ---');

      for (const trace of target53497) {
        console.log(
          `applyPass @ ${trace.applyTick} player=${trace.playerId ?? 'null'} club=${trace.clubId ?? 'null'}`
        );
        console.log(
          `  from=${formatVec(trace.from)} target=${formatVec(trace.target)}`
        );
        console.log(
          `  initial v=${formatVec(trace.initialVelocity)} speed=${trace.initialSpeed.toFixed(6)} expected=${trace.expectedSpeed.toFixed(6)}`
        );
        console.log(
          `  direction error=${trace.directionErrorDeg.toFixed(6)} deg`
        );
        console.log(
          `  min distance=${Number.isFinite(trace.minDistance) ? trace.minDistance.toFixed(6) : 'N/A'} m at tick=${trace.minDistanceTick ?? 'N/A'}`
        );
        console.log(
          `  velocity at min distance=${trace.velocityAtMinDistance ? formatVec(trace.velocityAtMinDistance) : 'N/A'}`
        );
        console.log(
          `  passed target=${trace.passedTarget}`
        );
        console.log(
          `  overshoot distance=${trace.overshootDistance.toFixed(6)} m`
        );
        console.log(
          `  ticks after passing=${trace.ticksAfterPassing}`
        );
        console.log(
          `  outcome=${trace.outcome} terminalTick=${trace.terminalTick ?? 'N/A'}`
        );
        console.log(
          `  samples=${trace.samples.length} sampleOverflow=${trace.sampleOverflow}`
        );

        for (const sample of trace.samples.slice(0, TRACE_TICKS)) {
          console.log(
            `    t=${sample.tick} pos=${formatVec(sample.position)} v=${formatVec(sample.velocity)} d=${sample.distanceToTarget.toFixed(3)} proj=${sample.projectionAlongTarget.toFixed(3)}`
          );
        }
      }

      console.log('');
      console.log('--- boundary-result traces ---');
      for (const trace of boundaryTraces) {
        console.log(
          `tick=${trace.applyTick} player=${trace.playerId ?? 'null'} outcome=boundary minDist=${Number.isFinite(trace.minDistance) ? trace.minDistance.toFixed(3) : 'N/A'} minTick=${trace.minDistanceTick ?? 'N/A'} passed=${trace.passedTarget} overshoot=${trace.overshootDistance.toFixed(3)}`
        );
      }

      console.log('');
      console.log('=== V9 REQUIRED CHECKS ===');
      console.log(`53497 count=${target53497.length}`);
      console.log(`speedFormulaCheck=${speedMismatches.length === 0}`);
      console.log(
        `partitionCheck=${
          reached.length + near.length + notReached.length === traces.length
        }`
      );

      expect(traces.length).toBeGreaterThan(0);
      expect(speedMismatches.length).toBe(0);
      expect(target53497.length).toBe(1);
      expect(
        reached.length + near.length + notReached.length
      ).toBe(traces.length);
    },
    10 * 60 * 1000
  );
});
