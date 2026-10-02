// src/engine/live/diagnostics/counterPressDiagnostic.ts
//
// Counter-press chain diagnostic — B (aggregate)
// =================================================
//
// Ölçüm zinciri:
//   attempt → rollPassed → tackle outcome → recovery
//
// Diagnostic-only. Production davranışını değiştirmez.
// console.log parse etmez.
// import.meta.env.DEV'e bağımlı değildir.

import type {
  LiveMatchState,
  TackleOutcome,
} from '../../types';

export interface CounterPressStatsSnapshot {
  counterPressAttempts: number;
  counterPressRollsPassed: number;
  counterPressTackleWins: number;
  counterPressTackleFailures: number;
  counterPressTackleFouls: number;
  counterPressRecoveries: number;
  counterPressCleanRecoveries: number;
  counterPressLooseBallRecoveries: number;

  counterPressTackleWinChanceSum: number;
  counterPressTackleWinChanceMin: number;
  counterPressTackleWinChanceMax: number;
  counterPressTackleRelativeSpeedSum: number;
  counterPressTackleDistanceSum: number;
}

function snapshotStats(state: LiveMatchState): CounterPressStatsSnapshot {
  const s = state.stats;

  return {
    counterPressAttempts: s.counterPressAttempts,
    counterPressRollsPassed: s.counterPressRollsPassed,
    counterPressTackleWins: s.counterPressTackleWins,
    counterPressTackleFailures: s.counterPressTackleFailures,
    counterPressTackleFouls: s.counterPressTackleFouls,
    counterPressRecoveries: s.counterPressRecoveries,
    counterPressCleanRecoveries: s.counterPressCleanRecoveries,
    counterPressLooseBallRecoveries: s.counterPressLooseBallRecoveries,

    counterPressTackleWinChanceSum:
      s.counterPressTackleWinChanceSum,
    counterPressTackleWinChanceMin:
      s.counterPressTackleWinChanceMin,
    counterPressTackleWinChanceMax:
      s.counterPressTackleWinChanceMax,
    counterPressTackleRelativeSpeedSum:
      s.counterPressTackleRelativeSpeedSum,
    counterPressTackleDistanceSum:
      s.counterPressTackleDistanceSum,
  };
}

export interface TackleOutcomeRecord {
  tick: number;
  type: 'won' | 'failed' | 'foul';
  tacklerId: string;
  ballCarrierId: string;
  newOwnerId: string | null;
  winChance: number | null;
  cleanChance: number | null;
  relativeSpeed: number | null;
  distance: number | null;
}

export interface CounterPressReport {
  final: CounterPressStatsSnapshot;
  tackleOutcomes: TackleOutcomeRecord[];
  tickDeltas: Array<{
    tick: number;
    attempts: number;
    rollsPassed: number;
    wins: number;
    failures: number;
    fouls: number;
    recoveries: number;
    cleanRecoveries: number;
    looseBallRecoveries: number;
  }>;
}

export class CounterPressDiagnostic {
  private initialized = false;
  private prev: CounterPressStatsSnapshot | null = null;
  private readonly outcomes: TackleOutcomeRecord[] = [];
  private readonly deltas: CounterPressReport['tickDeltas'] = [];
  private lastTick = 0;

  onTick(state: LiveMatchState): void {
    const snap = snapshotStats(state);
    this.lastTick = state.tick;

    if (!this.initialized) {
      this.prev = snap;
      this.initialized = true;
      return;
    }

    const prev = this.prev;

    const d = {
      tick: state.tick,
      attempts:
        snap.counterPressAttempts - prev.counterPressAttempts,
      rollsPassed:
        snap.counterPressRollsPassed -
        prev.counterPressRollsPassed,
      wins:
        snap.counterPressTackleWins -
        prev.counterPressTackleWins,
      failures:
        snap.counterPressTackleFailures -
        prev.counterPressTackleFailures,
      fouls:
        snap.counterPressTackleFouls -
        prev.counterPressTackleFouls,
      recoveries:
        snap.counterPressRecoveries -
        prev.counterPressRecoveries,
      cleanRecoveries:
        snap.counterPressCleanRecoveries -
        prev.counterPressCleanRecoveries,
      looseBallRecoveries:
        snap.counterPressLooseBallRecoveries -
        prev.counterPressLooseBallRecoveries,
    };

    if (
      d.attempts !== 0 ||
      d.rollsPassed !== 0 ||
      d.wins !== 0 ||
      d.failures !== 0 ||
      d.fouls !== 0 ||
      d.recoveries !== 0 ||
      d.cleanRecoveries !== 0 ||
      d.looseBallRecoveries !== 0
    ) {
      this.deltas.push(d);
    }

    this.prev = snap;
  }

  onTackleResolved(outcome: TackleOutcome): void {
    // onTackleResolved, resolveCounterPressContest içindeki
    // probability roll'u geçtikten sonra çağrılır. Bu nedenle her
    // kayıt bir çözülmüş counter-press tackle'ı temsil eder.
    //
    // onTick maç tick'inin sonunda çalıştığı için burada görülen
    // lastTick, callback'in gerçek tick'inin bir gerisinde olabilir.
    // Aggregate amaçlı olduğundan tick yalnızca yardımcı bilgi olarak
    // tutulur; sınıflandırma bunun üzerine kurulmaz.
    const tick = this.lastTick + 1;

    this.outcomes.push({
      tick,
      type: outcome.type,
      tacklerId: outcome.tacklerId,
      ballCarrierId: outcome.ballCarrierId,
      newOwnerId:
        outcome.type === 'won'
          ? outcome.newOwnerId
          : null,
      winChance: outcome.debug?.winChance ?? null,
      cleanChance:
        outcome.type === 'won'
          ? outcome.debug?.cleanChance ?? null
          : null,
      relativeSpeed: outcome.debug?.relativeSpeed ?? null,
      distance: outcome.debug?.distance ?? null,
    });
  }

  report(): CounterPressReport {
    if (!this.prev) {
      throw new Error(
        'CounterPressDiagnostic: simulation hiç onTick üretmedi.',
      );
    }

    const final = this.prev;
    const resolved = this.outcomes.length;

    console.log('=== COUNTER-PRESS CHAIN (aggregate) ===');
    console.table({
      attempts: final.counterPressAttempts,
      rollsPassed: final.counterPressRollsPassed,
      tackleWins: final.counterPressTackleWins,
      tackleFailures: final.counterPressTackleFailures,
      tackleFouls: final.counterPressTackleFouls,
      recoveries: final.counterPressRecoveries,
      cleanRecoveries: final.counterPressCleanRecoveries,
      looseBallRecoveries:
        final.counterPressLooseBallRecoveries,
      resolvedOutcomes: resolved,
    });

    if (resolved > 0) {
      console.log(
        '=== WIN CHANCE / SPEED / DISTANCE (resolved tackle başına) ===',
      );
      console.table({
        winChanceAvg:
          final.counterPressTackleWinChanceSum / resolved,
        winChanceMin:
          final.counterPressTackleWinChanceMin,
        winChanceMax:
          final.counterPressTackleWinChanceMax,
        relativeSpeedAvg:
          final.counterPressTackleRelativeSpeedSum / resolved,
        distanceAvg:
          final.counterPressTackleDistanceSum / resolved,
      });
    }

    console.log('=== TACKLE OUTCOMES (onTackleResolved) ===');
    console.table({
      won: this.outcomes.filter(o => o.type === 'won').length,
      failed: this.outcomes.filter(o => o.type === 'failed').length,
      foul: this.outcomes.filter(o => o.type === 'foul').length,
    });

    console.log('=== KARAR NOKTASI (counter-press) ===');

    if (final.counterPressAttempts === 0) {
      console.log(
        'A) Attempt = 0 → test/oyun koşulu problemi',
      );
    } else if (final.counterPressRollsPassed === 0) {
      console.log(
        'B) Attempt > 0, rollPassed = 0 → probability zinciri',
      );
    } else if (final.counterPressTackleWins === 0) {
      console.log(
        'C) rollPassed > 0, tackleWins = 0 → resolveTackle/winChance',
      );
    } else if (final.counterPressRecoveries === 0) {
      console.log(
        'D) tackleWins > 0, recoveries = 0 → applyTackleWon/knock',
      );
    } else {
      console.log(
        'Zincir tutarlı: attempt → roll → tackleWin → recovery',
      );
    }

    console.log('=== TICK DELTALARI (ilk 50) ===');
    console.table(this.deltas.slice(0, 50));

    return {
      final,
      tackleOutcomes: [...this.outcomes],
      tickDeltas: [...this.deltas],
    };
  }
}
