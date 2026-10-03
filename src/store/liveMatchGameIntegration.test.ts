import { describe, expect, it } from 'vitest';
import { simulateMatchLive } from '../engine/live/liveMatch';
import { useGameStore } from './gameStore';

describe('live match -> career state integration', () => {
  it('writes a completed live fixture into the store and advances the week', () => {
    const store = useGameStore.getState();
    store.newGame();
    store.setUseLiveEngine(true);

    const before = useGameStore.getState();
    const fixture = before.fixtures.find(
      match =>
        match.week === before.currentWeek &&
        !match.played &&
        (match.homeId === before.userClubId ||
          match.awayId === before.userClubId),
    );

    expect(fixture).toBeDefined();
    if (!fixture) return;

    const home = before.clubs[fixture.homeId!];
    const away = before.clubs[fixture.awayId!];
    expect(home).toBeDefined();
    expect(away).toBeDefined();

    const players = structuredClone(before.players);
    const trackedPlayerId = Object.values(players).find(
      player =>
        player.clubId === before.userClubId &&
        player.squadRole !== 'u21' &&
        player.injuryWeeks === 0 &&
        player.suspensionWeeks === 0,
    )?.id;

    expect(trackedPlayerId).toBeDefined();
    if (!trackedPlayerId) return;

    const appearancesBefore =
      players[trackedPlayerId].careerStats.appearances;

    const result = simulateMatchLive(home, away, players, {
      week: fixture.week,
      userLineup: before.userLineup,
      seed: 123456,
      maxTicks: 1,
      matchId: fixture.id,
    });

    expect(result.id).toBe(fixture.id);
    expect(result.played).toBe(true);
    expect(result.week).toBe(fixture.week);

    store.applyLiveMatchResult(result, players);

    const afterResult = useGameStore.getState();
    const savedFixture = afterResult.fixtures.find(
      match => match.id === fixture.id,
    );

    expect(savedFixture?.played).toBe(true);
    expect(savedFixture?.homeScore).toBe(result.homeScore);
    expect(savedFixture?.awayScore).toBe(result.awayScore);
    expect(afterResult.players[trackedPlayerId].careerStats.appearances).toBe(
      appearancesBefore + 1,
    );

    store.playWeek();

    const afterWeek = useGameStore.getState();

    expect(afterWeek.currentWeek).toBe(before.currentWeek + 1);
    expect(
      afterWeek.fixtures.find(match => match.id === fixture.id)?.played,
    ).toBe(true);
  });
});
