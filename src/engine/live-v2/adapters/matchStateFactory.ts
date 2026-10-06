import type { RngState } from '../rng';
import type { MatchState, Pitch, PlayerState, TeamSide } from '../state';
import { attachFootball } from '../football/setup';

export type MatchLineupPlayer = {
  id: string;
};

export type MatchLineup = {
  clubId: string;
  players: MatchLineupPlayer[];
};

const HOME_SLOTS = [
  { x: 5, y: 32 },
  { x: 20, y: 10 },
  { x: 20, y: 25 },
  { x: 20, y: 39 },
  { x: 20, y: 54 },
  { x: 38, y: 10 },
  { x: 38, y: 25 },
  { x: 38, y: 39 },
  { x: 38, y: 54 },
  { x: 50, y: 24 },
  { x: 50, y: 40 },
];

function slotsFor(side: TeamSide, pitch: Pitch): Array<{ x: number; y: number }> {
  if (side === 'HOME') return HOME_SLOTS;

  return HOME_SLOTS.map(({ x, y }) => ({
    x: pitch.length - x,
    y,
  }));
}

function buildPlayers(
  lineup: MatchLineup,
  side: TeamSide,
  pitch: Pitch,
): Record<string, PlayerState> {
  if (lineup.players.length < 11) {
    throw new Error(`live-v2 factory: ${side} lineup must contain at least 11 players`);
  }

  const slots = slotsFor(side, pitch);
  const players: Record<string, PlayerState> = {};

  lineup.players.forEach((player, index) => {
    if (!player.id) throw new Error('live-v2 factory: player id is required');
    if (players[player.id]) throw new Error(`live-v2 factory: duplicate player id ${player.id}`);

    const position = slots[index] ?? { x: side === 'HOME' ? 5 : pitch.length - 5, y: pitch.width / 2 };
    players[player.id] = {
      id: player.id,
      team: side,
      position: { ...position },
      velocity: { x: 0, y: 0 },
      onPitch: index < 11,
    };
  });

  return players;
}

export function createMatchState(
  home: MatchLineup,
  away: MatchLineup,
  seed: RngState,
  pitch: Pitch,
): MatchState {
  const homePlayers = buildPlayers(home, 'HOME', pitch);
  const awayPlayers = buildPlayers(away, 'AWAY', pitch);

  return attachFootball({
    seed: { ...seed },
    clockSeconds: 0,
    tick: 0,
    phase: 'kickoff',
    pitch: { ...pitch },
    score: { home: 0, away: 0 },
    ball: {
      position: {
        x: pitch.length / 2,
        y: pitch.width / 2,
        z: 0,
      },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: null,
      lastTouchId: null,
      lastTouchSide: null,
    },
    players: {
      ...homePlayers,
      ...awayPlayers,
    },
    teams: {
      HOME: {
        id: home.clubId,
        side: 'HOME',
        playerIds: home.players.map((player) => player.id),
      },
      AWAY: {
        id: away.clubId,
        side: 'AWAY',
        playerIds: away.players.map((player) => player.id),
      },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'kickoff',
      lastTick: 0,
      lastBallPosition: { x: pitch.length / 2, y: pitch.width / 2, z: 0 },
      lastBallVelocity: { x: 0, y: 0, z: 0 },
    },
  });
}
