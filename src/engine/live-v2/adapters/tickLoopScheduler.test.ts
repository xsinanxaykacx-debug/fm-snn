import { describe, expect, it } from 'vitest';
import { shouldEmitFrame, ticksPerFrame, totalFrames } from './tickLoopScheduler';

describe('live-v2 tick loop scheduler', () => {
  it('emits a frame on every 6th tick', () => {
    expect(Array.from({ length: 13 }, (_, tick) => shouldEmitFrame(tick, 6)))
      .toEqual([false, false, false, false, false, false, true, false, false, false, false, false, true]);
  });

  it('maps 5400 ticks to 900 frames', () => {
    expect(totalFrames(5400, 6)).toBe(900);
  });

  it('returns the configured ticks per frame', () => {
    expect(ticksPerFrame(6)).toBe(6);
  });

  it('is deterministic for identical inputs', () => {
    const input = [0, 1, 5, 6, 5399, 5400];
    expect(input.map(tick => shouldEmitFrame(tick, 6)))
      .toEqual(input.map(tick => shouldEmitFrame(tick, 6)));
    expect(totalFrames(5400, 6)).toBe(totalFrames(5400, 6));
  });

  it('handles boundary ticks correctly', () => {
    expect(shouldEmitFrame(0, 6)).toBe(false);
    expect(shouldEmitFrame(5399, 6)).toBe(false);
    expect(shouldEmitFrame(5400, 6)).toBe(true);
  });

  it('rejects invalid frame intervals', () => {
    expect(() => ticksPerFrame(0)).toThrow();
    expect(() => ticksPerFrame(-1)).toThrow();
    expect(() => shouldEmitFrame(6, 0)).toThrow();
    expect(() => totalFrames(5400, 0)).toThrow();
  });
});
