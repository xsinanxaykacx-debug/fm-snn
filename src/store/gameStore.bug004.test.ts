import { describe, expect, it } from 'vitest';

describe('BUG-004 live match result persistence', () => {
  it('updates table, marks fixture played, advances week, and persists to storage', async () => {
    const { useGameStore, getPersistedGameState } = await import('./gameStore');
    useGameStore.getState().newGame();

    const before = useGameStore.getState();
    const fixture = before.fixtures.find(
      match =>
        match.week === before.currentWeek &&
        !match.played &&
        (match.homeId === before.userClubId || match.awayId === before.userClubId)
    );

    expect(fixture?.id).toBeTruthy();
    expect(fixture?.homeId).toBeTruthy();
    expect(fixture?.awayId).toBeTruthy();

    if (!fixture?.id || !fixture.homeId || !fixture.awayId) return;

    const isUserHome = fixture.homeId === before.userClubId;
    const homeScore = isUserHome ? 10 : 9;
    const awayScore = isUserHome ? 9 : 10;
    const previousPoints = before.table[before.userClubId].points;

    useGameStore.getState().applyLiveMatchResult({
      ...fixture,
      homeScore,
      awayScore,
      played: true,
    });

    const after = useGameStore.getState();
    const savedFixture = after.fixtures.find(match => match.id === fixture.id);
    expect(after.table[before.userClubId].points).toBe(previousPoints + 3);
    expect(savedFixture?.played).toBe(true);
    expect(savedFixture?.homeScore).toBe(homeScore);
    expect(savedFixture?.awayScore).toBe(awayScore);
    expect(after.currentWeek).toBe(before.currentWeek + 1);
    const persisted = getPersistedGameState(after);
    expect(persisted.currentWeek).toBe(before.currentWeek + 1);
    expect(persisted.fixtures.find(match => match.id === fixture.id)?.played).toBe(true);
  });
});
