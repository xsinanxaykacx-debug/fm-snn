import { describe, expect, it } from 'vitest';
import { resolveBoundary } from './boundary';
import type { BallState, Pitch } from './types';

const pitch: Pitch = { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 };

function ball(lastTouchSide: BallState['lastTouchSide']): BallState {
  return { position: { x: 0, y: 32, z: 0.11 }, velocity: { x: 0, y: 0, z: 0 }, ownerId: null, lastTouchId: null, lastTouchSide };
}

describe('live-v2 boundary', () => {
  it('returns no event while the ball remains inside', () => {
    const result = resolveBoundary(pitch, { x: 10, y: 32, z: 0.11 }, { x: 11, y: 32, z: 0.11 }, ball('AWAY'));
    expect(result.event).toBeNull();
    expect(result.crossing).toBeNull();
  });

  it('detects a normal inside-to-outside goal crossing', () => {
    const result = resolveBoundary(pitch, { x: 0.8, y: 32, z: 0.11 }, { x: -0.8, y: 32, z: 0.11 }, ball('AWAY'));
    expect(result.event).toEqual({ type: 'goal', scorerSide: 'AWAY', point: { x: 0, y: 32 } });
    expect(result.crossing?.recovered).toBe(false);
  });

  it('detects a goal when both points are already outside', () => {
    const result = resolveBoundary(pitch, { x: -0.2, y: 32, z: 0.11 }, { x: -2, y: 32, z: 0.11 }, ball('AWAY'));
    expect(result.event).toMatchObject({ type: 'goal', scorerSide: 'AWAY' });
    expect(result.crossing?.recovered).toBe(true);
  });

  it('detects a throw-in when the ball is already beyond the touchline', () => {
    const result = resolveBoundary(pitch, { x: 50, y: 64.2, z: 0.11 }, { x: 50, y: 66, z: 0.11 }, ball('HOME'));
    expect(result.event).toEqual({ type: 'throw_in', side: 'AWAY', point: { x: 50, y: 64 } });
  });

  it('uses interpolated crossing z for a high ball over the goal mouth', () => {
    const result = resolveBoundary(pitch, { x: 0.8, y: 32, z: 3 }, { x: -0.8, y: 32, z: 3 }, ball('AWAY'));
    expect(result.event).toMatchObject({ type: 'goal_kick', side: 'HOME' });
  });

  it('does not treat an outside point outside the goal mouth as a goal', () => {
    const result = resolveBoundary(pitch, { x: -0.2, y: 10, z: 0.11 }, { x: -2, y: 10, z: 0.11 }, ball('AWAY'));
    expect(result.event?.type).toBe('goal_kick');
  });

  it('is deterministic for identical inputs', () => {
    const args = [pitch, { x: 0.8, y: 32, z: 0.11 }, { x: -0.8, y: 32, z: 0.11 }, ball('AWAY')] as const;
    expect(resolveBoundary(...args)).toEqual(resolveBoundary(...args));
  });
});