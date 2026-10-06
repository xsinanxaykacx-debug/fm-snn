import { describe, expect, it } from 'vitest';
import { createMatchState, type MatchLineup } from './matchStateFactory';
import type { Pitch } from '../state';

const pitch: Pitch = {
  length: 104,
  width: 64,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalAreaDepth: 5.5,
};

const lineup = (prefix: string): MatchLineup => ({
  clubId: `${prefix}-club`,
  players: Array.from({ length: 11 }, (_, index) => ({ id: `${prefix}-${index + 1}` })),
});

describe('live-v2 MatchState factory', () => {
  it('creates exactly 22 players', () => {
    const state = createMatchState(lineup('H'), lineup('A'), { seed: 123 }, pitch);
    expect(Object.keys(state.players)).toHaveLength(22);
  });

  it('assigns HOME and AWAY correctly', () => {
    const state = createMatchState(lineup('H'), lineup('A'), { seed: 123 }, pitch);

    expect(Object.values(state.players).filter((player) => player.team === 'HOME')).toHaveLength(11);
    expect(Object.values(state.players).filter((player) => player.team === 'AWAY')).toHaveLength(11);
    expect(state.teams.HOME.playerIds).toEqual(lineup('H').players.map((player) => player.id));
    expect(state.teams.AWAY.playerIds).toEqual(lineup('A').players.map((player) => player.id));
  });

  it('creates the same state for the same input', () => {
    const home = lineup('H');
    const away = lineup('A');

    expect(createMatchState(home, away, { seed: 123 }, pitch))
      .toEqual(createMatchState(home, away, { seed: 123 }, pitch));
  });
});
