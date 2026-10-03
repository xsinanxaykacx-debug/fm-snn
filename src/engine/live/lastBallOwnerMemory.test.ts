import { describe, expect, it } from 'vitest';

import type { LiveMatchState } from '../types';
import { syncBallOwnerFlags } from './liveMatch';

describe('Last non-null ball owner memory', () => {
  it('loose ball sırasında son sahibin kimliği korunur', () => {
    const state = {
      players: {
        A: { player: { id: 'A' }, isBallOwner: true },
        B: { player: { id: 'B' }, isBallOwner: false },
      },
      ball: { ownerId: 'A' },
      lastBallOwnerId: 'A',
    } as unknown as LiveMatchState;

    syncBallOwnerFlags(state);
    expect(state.lastBallOwnerId).toBe('A');

    state.ball.ownerId = null;
    syncBallOwnerFlags(state);

    expect(state.lastBallOwnerId).toBe('A');
    expect(state.players.A.isBallOwner).toBe(false);
    expect(state.players.B.isBallOwner).toBe(false);
  });

  it('aynı tickte yeni owner oluşursa hafıza yeni ownera ilerler', () => {
    const state = {
      players: {
        A: { player: { id: 'A' }, isBallOwner: true },
        B: { player: { id: 'B' }, isBallOwner: false },
      },
      ball: { ownerId: 'A' },
      lastBallOwnerId: 'A',
    } as unknown as LiveMatchState;

    state.ball.ownerId = 'B';
    syncBallOwnerFlags(state);

    expect(state.lastBallOwnerId).toBe('B');
    expect(state.players.A.isBallOwner).toBe(false);
    expect(state.players.B.isBallOwner).toBe(true);
  });
});
