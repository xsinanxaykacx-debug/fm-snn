import { describe, expect, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { createBall } from './ball';
import { DEFAULT_PITCH_DIMENSIONS } from './pitch';
import { createRng } from './rng';
import { applyBoundaryOutcome } from './liveMatch';

describe('BUG-020 regression', () => {
  it('resolves a non-shot goal-mouth crossing when no pending shot is bound', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);
    const home = clubList[0];
    const away = clubList[1];
    const ownGoalPlayer = Object.values(players).find(
      player => player.clubId === home.id && player.squadRole !== 'u21'
    );

    if (!ownGoalPlayer) {
      throw new Error('No eligible player found for BUG-020 regression');
    }

    const pitch = DEFAULT_PITCH_DIMENSIONS;
    const ball = createBall(pitch);
    ball.lastTouchId = ownGoalPlayer.id;
    ball.lastTouchClubId = home.id;

    const goalkeeperPlayer = Object.values(players).find(
      player =>
        player.clubId === home.id &&
        player.position === 'GK' &&
        player.squadRole !== 'u21'
    );

    if (!goalkeeperPlayer) {
      throw new Error('No eligible goalkeeper found for BUG-020 regression');
    }

    const state = {
      time: 1,
      tick: 1,
      phase: 'first_half',
      addedTime: 0,
      pitch,
      home: { club: home, players: [], formation: home.formation, tactic: home.tactic, mentality: home.tactic.mentality, hasPossession: false, isHome: true, attackingDirection: 1, formationZones: [] },
      away: { club: away, players: [], formation: away.formation, tactic: away.tactic, mentality: away.tactic.mentality, hasPossession: false, isHome: false, attackingDirection: -1, formationZones: [] },
      ball,
      players: {
        [goalkeeperPlayer.id]: {
          player: goalkeeperPlayer,
          role: 'GK',
          isHome: true,
          clubId: home.id,
          position: { x: 5, y: pitch.width / 2 },
        },
      },
      score: { home: 0, away: 0 },
      stats: {
        possession: { home: 50, away: 50 },
        shots: { home: 0, away: 0 },
        onTarget: { home: 0, away: 0 },
        chances: { home: 0, away: 0 },
        xG: { home: 0, away: 0 },
        passes: { home: 0, away: 0 },
        passesCompleted: { home: 0, away: 0 },
        dribbles: { home: 0, away: 0 },
        dribblesSuccess: { home: 0, away: 0 },
        crosses: { home: 0, away: 0 },
        crossesSuccess: { home: 0, away: 0 },
        dangerousAttacks: { home: 0, away: 0 },
        recoveries: { home: 0, away: 0 },
        counterPressAttempts: 0,
        counterPressRecoveries: 0,
        counterPressRollsPassed: 0,
        counterPressTackleWins: 0,
        counterPressTackleFailures: 0,
        counterPressTackleFouls: 0,
        counterPressCleanRecoveries: 0,
        counterPressLooseBallRecoveries: 0,
        counterPressTackleWinChanceSum: 0,
        counterPressTackleWinChanceMin: 1,
        counterPressTackleWinChanceMax: 0,
        counterPressTackleRelativeSpeedSum: 0,
        counterPressTackleDistanceSum: 0,
        fouls: { home: 0, away: 0 },
        yellowCards: { home: 0, away: 0 },
        redCards: { home: 0, away: 0 },
        corners: { home: 0, away: 0 },
        throwIns: { home: 0, away: 0 },
        goalKicks: { home: 0, away: 0 },
        offsides: { home: 0, away: 0 },
        ticks: 0,
        simulationSeconds: 0,
      },
      events: [
        {
          minute: 1,
          type: 'shot',
          playerId: ownGoalPlayer.id,
          clubId: home.id,
          xG: 0.7,
          description: 'Eski şut',
        },
        {
          minute: 1,
          type: 'pass',
          playerId: ownGoalPlayer.id,
          clubId: home.id,
          description: 'Sonraki pas',
        },
      ],
      setPiece: null,
      decisions: {},
      sequences: [],
      rng: createRng(1),
      perceptionCache: {},
      lastBallOwnerId: null,
      isStopped: false,
      isFinished: false,
    } as any;

    state.pendingShot = {
      playerId: ownGoalPlayer.id,
      outcome: 'save',
      goalkeeperId: goalkeeperPlayer.id,
    };

    applyBoundaryOutcome(
      {
        type: 'goal',
        scorerSide: 'AWAY',
        ownGoal: true,
        point: { x: 0, y: pitch.width / 2 },
      },
      state,
      players
    );

    // Regression contract: the old implementation searched backward for any
    // historical shot by lastTouchId and could turn this non-shot own-goal
    // boundary into a goalkeeper save. The current implementation must bind
    // save resolution to the immediate preceding event only.
    expect(state.score.away).toBe(1);
    expect(state.score.home).toBe(0);
    expect(state.events.at(-1)?.type).toBe('kickoff');
    expect(state.pendingShot).toBeUndefined();
  });
});
