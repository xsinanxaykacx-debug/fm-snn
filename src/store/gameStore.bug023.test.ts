import { describe, expect, it } from 'vitest';

import { useGameStore } from './gameStore';

describe('BUG-023 player availability recovery', () => {
  it('clears transient injury and sending-off flags when their timers expire', () => {
    useGameStore.getState().newGame();
    const state = useGameStore.getState();
    const player = Object.values(state.players).find(
      p => p.clubId === state.userClubId && p.squadRole !== 'u21'
    );

    if (!player) throw new Error('No user player available for BUG-023 regression');

    useGameStore.setState({
      players: {
        ...state.players,
        [player.id]: {
          ...player,
          injuryWeeks: 1,
          injured: true,
          suspensionWeeks: 1,
          sentOff: true,
          redCard: true,
        },
      },
    });

    useGameStore.getState().playWeek();

    const recovered = useGameStore.getState().players[player.id];

    expect(recovered.injuryWeeks).toBe(0);
    expect(recovered.injured).toBe(false);
    expect(recovered.suspensionWeeks).toBe(0);
    expect(recovered.sentOff).toBe(false);
    expect(recovered.redCard).toBe(false);
  });
});
