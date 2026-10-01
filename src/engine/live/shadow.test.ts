import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordShadow,
  recordShadowMiss,
  getShadowStats,
  resetShadowStats,
  SHADOW_CONFIG,
  type ShadowSample,
} from './shadow';

function makeSample(overrides: Partial<ShadowSample> = {}): ShadowSample {
  return {
    tick: 1,
    tacklerId: 'T1',
    carrierId: 'C1',
    legacyRelativeSpeed: 3.0,
    legacyClosingSpeed: 2.0,
    newClosingSpeed: 2.0,
    ...overrides,
  };
}

describe('shadow stats', () => {
  beforeEach(() => {
    resetShadowStats();
  });

  it('matching: delta < epsilon', () => {
    recordShadow(makeSample({ legacyClosingSpeed: 2.0, newClosingSpeed: 2.0 }));
    const s = getShadowStats();
    expect(s.semantic.total).toBe(1);
    expect(s.semantic.matching).toBe(1);
    expect(s.semantic.mismatching).toBe(0);
  });

  it('mismatching: delta > epsilon', () => {
    recordShadow(makeSample({ legacyClosingSpeed: 2.0, newClosingSpeed: 3.0 }));
    const s = getShadowStats();
    expect(s.semantic.mismatching).toBe(1);
    expect(s.semantic.maxDelta).toBeCloseTo(1.0, 10);
  });

  it('maxDelta: en büyük sapma korunur', () => {
    recordShadow(makeSample({ legacyClosingSpeed: 1.0, newClosingSpeed: 1.5 }));
    recordShadow(makeSample({ legacyClosingSpeed: 1.0, newClosingSpeed: 3.0 }));
    recordShadow(makeSample({ legacyClosingSpeed: 1.0, newClosingSpeed: 2.0 }));
    const s = getShadowStats();
    expect(s.semantic.maxDelta).toBeCloseTo(2.0, 10);
  });

  it('mismatchSamples limiti aşılmaz', () => {
    for (let i = 0; i < 250; i++) {
      recordShadow(makeSample({ legacyClosingSpeed: 0, newClosingSpeed: 1 }));
    }
    const s = getShadowStats();
    expect(s.semantic.mismatching).toBe(250);
    expect(s.semantic.mismatchSamples.length).toBe(
      SHADOW_CONFIG.MAX_MISMATCH_SAMPLES,
    );
  });

  it('miss sayısı ve sample limiti', () => {
    for (let i = 0; i < 150; i++) {
      recordShadowMiss(i, 'T1', 'C1');
    }
    const s = getShadowStats();
    expect(s.semantic.misses).toBe(150);
    expect(s.semantic.missSamples.length).toBe(SHADOW_CONFIG.MAX_MISS_SAMPLES);
  });

  it('miss, semantic.total\'a dahil edilmez', () => {
    recordShadowMiss(1, 'T1', 'C1');
    const s = getShadowStats();
    expect(s.semantic.total).toBe(0);
    expect(s.semantic.misses).toBe(1);
  });

  it('A: highRel + positiveClose', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 5.0, newClosingSpeed: 4.0 }));
    const s = getShadowStats();
    expect(s.behavioral.highRelPositiveClose).toBe(1);
    expect(s.behavioral.total).toBe(1);
  });

  it('B: highRel + negativeClose', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 5.0, newClosingSpeed: -3.0 }));
    const s = getShadowStats();
    expect(s.behavioral.highRelNegativeClose).toBe(1);
  });

  it('C: lowRel + positiveClose', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 1.0, newClosingSpeed: 0.5 }));
    const s = getShadowStats();
    expect(s.behavioral.lowRelPositiveClose).toBe(1);
  });

  it('D: lowRel + negativeClose', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 1.0, newClosingSpeed: -0.5 }));
    const s = getShadowStats();
    expect(s.behavioral.lowRelNegativeClose).toBe(1);
  });

  it('threshold: tam 2.0 low olarak sınıflanır (>)', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 2.0, newClosingSpeed: 1.0 }));
    const s = getShadowStats();
    expect(s.behavioral.lowRelPositiveClose).toBe(1);
    expect(s.behavioral.highRelPositiveClose).toBe(0);
  });

  it('closingSpeed = 0 → negativeClose (closePositive > 0 değil)', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 5.0, newClosingSpeed: 0 }));
    const s = getShadowStats();
    expect(s.behavioral.highRelNegativeClose).toBe(1);
  });

  it('meanRelativeSpeed doğru hesaplanır', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 2.0 }));
    recordShadow(makeSample({ legacyRelativeSpeed: 4.0 }));
    recordShadow(makeSample({ legacyRelativeSpeed: 6.0 }));
    const s = getShadowStats();
    expect(s.behavioral.meanRelativeSpeed).toBeCloseTo(4.0, 10);
  });

  it('meanClosingSpeed doğru hesaplanır', () => {
    recordShadow(makeSample({ newClosingSpeed: 1.0 }));
    recordShadow(makeSample({ newClosingSpeed: -2.0 }));
    recordShadow(makeSample({ newClosingSpeed: 3.0 }));
    const s = getShadowStats();
    expect(s.behavioral.meanClosingSpeed).toBeCloseTo(2 / 3, 10);
  });

  it('meanAbsDifference doğru hesaplanır', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 5.0, newClosingSpeed: 2.0 }));
    recordShadow(makeSample({ legacyRelativeSpeed: 4.0, newClosingSpeed: 4.0 }));
    recordShadow(makeSample({ legacyRelativeSpeed: 1.0, newClosingSpeed: 4.0 }));
    const s = getShadowStats();
    expect(s.behavioral.meanAbsDifference).toBeCloseTo(2.0, 10);
  });

  it('maxDifference korunur', () => {
    recordShadow(makeSample({ legacyRelativeSpeed: 5.0, newClosingSpeed: 2.0 }));
    recordShadow(makeSample({ legacyRelativeSpeed: 1.0, newClosingSpeed: 4.0 }));
    recordShadow(makeSample({ legacyRelativeSpeed: 3.0, newClosingSpeed: 3.0 }));
    const s = getShadowStats();
    expect(s.behavioral.maxDifference).toBeCloseTo(3.0, 10);
  });

  it('resetShadowStats tüm sayaçları sıfırlar', () => {
    recordShadow(makeSample({ legacyClosingSpeed: 1, newClosingSpeed: 2 }));
    recordShadowMiss(1, 'T1', 'C1');
    resetShadowStats();
    const s = getShadowStats();
    expect(s.semantic.total).toBe(0);
    expect(s.semantic.matching).toBe(0);
    expect(s.semantic.mismatching).toBe(0);
    expect(s.semantic.misses).toBe(0);
    expect(s.semantic.maxDelta).toBe(0);
    expect(s.semantic.mismatchSamples.length).toBe(0);
    expect(s.semantic.missSamples.length).toBe(0);
    expect(s.behavioral.total).toBe(0);
    expect(s.behavioral.meanRelativeSpeed).toBe(0);
  });

  it('semantic.total === behavioral.total', () => {
    for (let i = 0; i < 10; i++) recordShadow(makeSample());
    const s = getShadowStats();
    expect(s.semantic.total).toBe(s.behavioral.total);
  });

  it('karışık örneklerde A/B/C/D toplamı behavioral.total\'a eşit', () => {
    const cases: Partial<ShadowSample>[] = [
      { legacyRelativeSpeed: 5, newClosingSpeed: 3 },
      { legacyRelativeSpeed: 5, newClosingSpeed: -3 },
      { legacyRelativeSpeed: 1, newClosingSpeed: 0.5 },
      { legacyRelativeSpeed: 1, newClosingSpeed: -0.5 },
      { legacyRelativeSpeed: 4, newClosingSpeed: 1 },
    ];
    for (const c of cases) recordShadow(makeSample(c));
    const s = getShadowStats();
    const sum =
      s.behavioral.highRelPositiveClose +
      s.behavioral.highRelNegativeClose +
      s.behavioral.lowRelPositiveClose +
      s.behavioral.lowRelNegativeClose;
    expect(sum).toBe(s.behavioral.total);
    expect(s.behavioral.total).toBe(5);
  });
});
