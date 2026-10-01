// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

export const SHADOW_CONFIG = {
  BEHAVIORAL_REL_THRESHOLD: 2.0,
  SEMANTIC_MATCH_EPSILON: 1e-9,
  MAX_MISMATCH_SAMPLES: 100,
  MAX_MISS_SAMPLES: 100,
} as const;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ShadowSample {
  tick: number;
  tacklerId: string;
  carrierId: string;
  /** Mevcut tackle akışının gördüğü ham relatif hız (her zaman ≥ 0). */
  legacyRelativeSpeed: number;
  /** Legacy calculateClosingSpeed(tackler, carrier) sonucu. */
  legacyClosingSpeed: number;
  /** PhysicsSnapshot'tan okunan, tackler → carrier yönünde kapanma. */
  newClosingSpeed: number;
}

export interface ShadowMissSample {
  tick: number;
  tacklerId: string;
  carrierId: string;
}

export interface SemanticStats {
  total: number;
  matching: number;
  mismatching: number;
  misses: number;
  maxDelta: number;
  mismatchSamples: ShadowSample[];
  missSamples: ShadowMissSample[];
}

export interface BehavioralStats {
  total: number;
  highRelPositiveClose: number;
  highRelNegativeClose: number;
  lowRelPositiveClose: number;
  lowRelNegativeClose: number;
  meanRelativeSpeed: number;
  meanClosingSpeed: number;
  meanAbsDifference: number;
  maxDifference: number;
}

export interface ShadowStats {
  semantic: SemanticStats;
  behavioral: BehavioralStats;
}

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

function createEmptyStats(): ShadowStats {
  return {
    semantic: {
      total: 0,
      matching: 0,
      mismatching: 0,
      misses: 0,
      maxDelta: 0,
      mismatchSamples: [],
      missSamples: [],
    },
    behavioral: {
      total: 0,
      highRelPositiveClose: 0,
      highRelNegativeClose: 0,
      lowRelPositiveClose: 0,
      lowRelNegativeClose: 0,
      meanRelativeSpeed: 0,
      meanClosingSpeed: 0,
      meanAbsDifference: 0,
      maxDifference: 0,
    },
  };
}

let stats: ShadowStats = createEmptyStats();

// ─────────────────────────────────────────────────────────────
// Recording
// ─────────────────────────────────────────────────────────────

export function recordShadow(sample: ShadowSample): void {
  const { SEMANTIC_MATCH_EPSILON, BEHAVIORAL_REL_THRESHOLD } = SHADOW_CONFIG;

  const semanticDelta = Math.abs(
    sample.legacyClosingSpeed - sample.newClosingSpeed,
  );

  stats.semantic.total++;

  if (semanticDelta < SEMANTIC_MATCH_EPSILON) {
    stats.semantic.matching++;
  } else {
    stats.semantic.mismatching++;

    if (semanticDelta > stats.semantic.maxDelta) {
      stats.semantic.maxDelta = semanticDelta;
    }

    if (
      stats.semantic.mismatchSamples.length <
      SHADOW_CONFIG.MAX_MISMATCH_SAMPLES
    ) {
      stats.semantic.mismatchSamples.push(sample);
    }
  }

  const n = stats.behavioral.total + 1;
  const relHigh = sample.legacyRelativeSpeed > BEHAVIORAL_REL_THRESHOLD;
  const closePositive = sample.newClosingSpeed > 0;

  if (relHigh && closePositive) {
    stats.behavioral.highRelPositiveClose++;
  } else if (relHigh && !closePositive) {
    stats.behavioral.highRelNegativeClose++;
  } else if (!relHigh && closePositive) {
    stats.behavioral.lowRelPositiveClose++;
  } else {
    stats.behavioral.lowRelNegativeClose++;
  }

  stats.behavioral.meanRelativeSpeed =
    (stats.behavioral.meanRelativeSpeed * (n - 1) +
      sample.legacyRelativeSpeed) /
    n;

  stats.behavioral.meanClosingSpeed =
    (stats.behavioral.meanClosingSpeed * (n - 1) +
      sample.newClosingSpeed) /
    n;

  const absDiff = Math.abs(
    sample.legacyRelativeSpeed - sample.newClosingSpeed,
  );

  stats.behavioral.meanAbsDifference =
    (stats.behavioral.meanAbsDifference * (n - 1) + absDiff) / n;

  if (absDiff > stats.behavioral.maxDifference) {
    stats.behavioral.maxDifference = absDiff;
  }

  stats.behavioral.total = n;
}

export function recordShadowMiss(
  tick: number,
  tacklerId: string,
  carrierId: string,
): void {
  stats.semantic.misses++;

  if (stats.semantic.missSamples.length < SHADOW_CONFIG.MAX_MISS_SAMPLES) {
    stats.semantic.missSamples.push({ tick, tacklerId, carrierId });
  }
}

// ─────────────────────────────────────────────────────────────
// Inspection
// ─────────────────────────────────────────────────────────────

export function getShadowStats(): ShadowStats {
  return stats;
}

export function resetShadowStats(): void {
  stats = createEmptyStats();
}

// ─────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────

export function printShadowReport(): void {
  const { semantic: s, behavioral: b } = stats;

  console.log('\n=== PHYSICS SHADOW REPORT ===\n');

  console.log('Semantic:');
  console.log(`  total:        ${s.total}`);
  console.log(`  matching:     ${s.matching}`);
  console.log(`  mismatching:  ${s.mismatching}`);
  console.log(`  misses:       ${s.misses}`);
  console.log(`  maxDelta:     ${s.maxDelta}`);

  console.log('\nBehavioral:');
  console.log(`  total:                    ${b.total}`);
  console.log(`  A (highRel + close):      ${b.highRelPositiveClose}`);
  console.log(`  B (highRel - close):      ${b.highRelNegativeClose}`);
  console.log(`  C (lowRel  + close):      ${b.lowRelPositiveClose}`);
  console.log(`  D (lowRel  - close):      ${b.lowRelNegativeClose}`);
  console.log(`  meanRelativeSpeed:        ${b.meanRelativeSpeed.toFixed(3)}`);
  console.log(`  meanClosingSpeed:         ${b.meanClosingSpeed.toFixed(3)}`);
  console.log(`  meanAbsDifference:        ${b.meanAbsDifference.toFixed(3)}`);
  console.log(`  maxDifference:            ${b.maxDifference.toFixed(3)}`);

  if (s.mismatchSamples.length > 0) {
    console.log('\nFirst mismatch samples:');
    console.table(s.mismatchSamples.slice(0, 10));
  }

  if (s.missSamples.length > 0) {
    console.log('\nFirst miss samples:');
    console.table(s.missSamples.slice(0, 10));
  }

  console.log('\n=============================\n');
}
