import { describe, expect, it } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('BUG-004 live match result persistence', () => {
  it('updates table, marks fixture played, advances week, and persists to storage', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });

    const { useGameStore } = await import('./gameStore');
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
    const savedPayload = globalThis.localStorage.getItem('fm-clone-save');
    const persisted = savedPayload ? JSON.parse(savedPayload).state : null;

    expect(after.table[before.userClubId].points).toBe(previousPoints + 3);
    expect(savedFixture?.played).toBe(true);
    expect(savedFixture?.homeScore).toBe(homeScore);
    expect(savedFixture?.awayScore).toBe(awayScore);
    expect(after.currentWeek).toBe(before.currentWeek + 1);
    expect(persisted?.currentWeek).toBe(before.currentWeek + 1);
    expect(persisted?.fixtures?.find((match: { id: string }) => match.id === fixture.id)?.played).toBe(true);
  });
});
