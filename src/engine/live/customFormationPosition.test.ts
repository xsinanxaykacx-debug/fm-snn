import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { createEmptyZones } from '../formation/zones';
import { simulateMatchLive } from './liveMatch';

describe('Live custom formation positioning', () => {
  it('uses the formation editor zone for the player start position', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const players = structuredClone(data.players);

    const firstPlayerId = Object.values(players).find(
      player => player.clubId === home.id && player.injuryWeeks === 0 && player.suspensionWeeks === 0
    )?.id;

    expect(firstPlayerId).toBeDefined();

    const zones = createEmptyZones();
    const attackLeft = zones.find(zone => zone.row === 0 && zone.col === 0);
    expect(attackLeft).toBeDefined();
    attackLeft!.playerId = firstPlayerId!;

    home.formation = 'CUSTOM';
    home.tactic = { ...home.tactic, formation: 'CUSTOM' };
    home.customFormation = { id: 'test-custom', name: 'Test Custom', zones };

    let firstTickHomePosition: { x: number; y: number } | null = null;

    simulateMatchLive(home, away, players, {
      seed: 12345,
      userLineup: [firstPlayerId!],
      maxTicks: 1,
      onTick: state => {
        const live = state.players[firstPlayerId!];
        if (live) firstTickHomePosition = { ...live.homePosition };
      },
    });

    expect(firstTickHomePosition).not.toBeNull();
    expect(firstTickHomePosition!.x).toBeCloseTo(104, 6);
    expect(firstTickHomePosition!.y).toBeCloseTo(0, 6);
  }, 60000);
});
