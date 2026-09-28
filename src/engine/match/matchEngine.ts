import type { Club, Match, MatchEvent, Player } from '../types';
import { getStartingXI } from '../data/generateData';
import { analyzeTeam } from './teamAnalysis';
import {
  createTeamMatchState,
  updateDynamicTactics,
  consumeCondition,
  calculatePossession,
  type MatchState,
} from './matchState';
import {
  choosePossessionTeam,
  chooseAttackZone,
} from './possession';
import { createAttackSequence } from './attackSequence';
import { calculateChanceFromSequence } from './chance';
import { resolveShot } from './goalkeeper';
import { pickShooter } from './attack';

function randomMinute(): number {
  return Math.floor(Math.random() * 90) + 1;
}

function pickInjuryType(severity: 'light' | 'medium' | 'severe'): string {
  const light = ['Kas Agrisi', 'Kucuk Burkulma', 'Hafif Darbe'];
  const medium = ['Hamstring', 'Ayak Bilegi', 'Diz Burkulmasi'];
  const severe = ['Capraz Bag', 'Kaval Kemigi Kirigi', 'Asil Tendonu'];
  const pool = severity === 'light' ? light : severity === 'medium' ? medium : severe;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ═══════════════════════════════════════════════
// YARDIMCI: injuredPlayers guvenli erisim
// ═══════════════════════════════════════════════

function isInjured(teamState: any, playerId: string): boolean {
  if (!teamState.injuredPlayers) return false;
  return teamState.injuredPlayers.includes(playerId);
}

function ensureInjuredPlayers(teamState: any): void {
  if (!teamState.injuredPlayers) {
    teamState.injuredPlayers = [];
  }
}

// ═══════════════════════════════════════════════
// ANA MOTOR
// ═══════════════════════════════════════════════

export function simulateMatch(
  home: Club,
  away: Club,
  players: Record<string, Player>,
  week: number
): Match {
  const events: MatchEvent[] = [];
  const pendingEvents: { minute: number; event: MatchEvent }[] = [];

  const homeAnalysis = analyzeTeam(home, players);
  const awayAnalysis = analyzeTeam(away, players);

  const state: MatchState = {
    minute: 0,
    home: createTeamMatchState(home, homeAnalysis),
    away: createTeamMatchState(away, awayAnalysis),
    homeScore: 0,
    awayScore: 0,
    possessionTeam: 'home',
    ballZone: 'centerMidfield',
    events: [],
    possessionCount: { home: 0, away: 0 },
    sequences: [],
  };

  // injuredPlayers guvenli
  ensureInjuredPlayers(state.home);
  ensureInjuredPlayers(state.away);

  const totalTicks = 36;
  const minutePerTick = 2.5;
  const sentOff = new Set<string>();
  const matchYellows = new Set<string>();

  for (let tick = 0; tick < totalTicks; tick++) {
    const baseMinute = Math.floor(tick * minutePerTick) + 1;
    state.minute = Math.min(90, baseMinute + Math.floor(Math.random() * 3));

    updateDynamicTactics(state);
    processCardsInMatch(state, players, sentOff, matchYellows, pendingEvents);
    processInjuriesInMatch(state, players, sentOff, pendingEvents);

    const possessionTeam = choosePossessionTeam(state);
    state.possessionCount[possessionTeam]++;
    state.possessionTeam = possessionTeam;

    const attackState = possessionTeam === 'home' ? state.home : state.away;
    const defendState = possessionTeam === 'home' ? state.away : state.home;
    const attackClub = attackState.club;
    const defendClub = defendState.club;

    // Guvenli erisim
    ensureInjuredPlayers(attackState);
    ensureInjuredPlayers(defendState);

    const { zone } = chooseAttackZone(state, attackState, defendState);

    const attackXI = getStartingXI(attackClub.id, players, attackClub.tactic.formation)
      .filter(p => !sentOff.has(p.id) && !isInjured(attackState, p.id));
    const defendXI = getStartingXI(defendClub.id, players, defendClub.tactic.formation)
      .filter(p => !sentOff.has(p.id) && !isInjured(defendState, p.id));

    if (attackXI.length < 7 || defendXI.length < 7) {
      consumeCondition(state);
      continue;
    }

    const sequence = createAttackSequence(attackState, defendState, attackXI, defendXI, zone);
    state.sequences.push(sequence);

    if (!sequence.resultedInShot || sequence.chanceQuality <= 20) {
      if (sequence.actions.length > 0) {
        const lastAction = sequence.actions[sequence.actions.length - 1];
        if (!lastAction.success) {
          attackState.turnovers++;
          defendState.recoveries++;
        }
      }
      consumeCondition(state);
      continue;
    }

    const shooter = pickShooter(attackXI, sequence.finalZone) || attackXI[0];
    if (!shooter) {
      consumeCondition(state);
      continue;
    }

    const chance = calculateChanceFromSequence(sequence, shooter, attackState, defendState);

    attackState.shots++;
    attackState.xG += chance.xG;

    const gk = defendXI.find(p => p.position === 'GK') || null;
    const shotResult = resolveShot(chance, gk, defendState);

    const isHome = possessionTeam === 'home';

    if (shotResult.outcome === 'goal') {
      if (isHome) {
        state.homeScore++;
        attackState.score++;
      } else {
        state.awayScore++;
        attackState.score++;
      }
      attackState.onTarget++;
      attackState.dangerousAttacks++;

      const zoneLabel = getZoneLabel(sequence.finalZone);

      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'goal',
          playerId: shooter.id,
          clubId: attackClub.id,
          description: `GOL! ${shooter.name} (${attackClub.shortName}) - ${zoneLabel} ${chance.distance.toFixed(0)}m (xG: ${chance.xG.toFixed(2)})`,
        },
      });
    } else if (shotResult.outcome === 'save') {
      attackState.onTarget++;
      attackState.dangerousAttacks++;
      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'save',
          playerId: shooter.id,
          clubId: attackClub.id,
          description: `${shooter.name} sutunu ${gk?.name ?? 'kaleci'} kurtardi (${attackClub.shortName})`,
        },
      });
    } else if (shotResult.outcome === 'blocked') {
      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'miss',
          playerId: shooter.id,
          clubId: attackClub.id,
          description: `${shooter.name} sutu savunmaya carpti (${attackClub.shortName})`,
        },
      });
    } else {
      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'miss',
          playerId: shooter.id,
          clubId: attackClub.id,
          description: `${shooter.name} sutu auta gitti (${attackClub.shortName})`,
        },
      });
    }

    consumeCondition(state);
  }

  events.push(...pendingEvents.sort((a, b) => a.minute - b.minute).map(e => e.event));

  const possession = calculatePossession(state);

  return {
    id: `match_${week}_${home.id}_${away.id}`,
    week,
    homeId: home.id,
    awayId: away.id,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    events,
    stats: {
      possession: { home: possession.home, away: possession.away },
      shots: { home: state.home.shots, away: state.away.shots },
      onTarget: { home: state.home.onTarget, away: state.away.onTarget },
      chances: { home: state.home.dangerousAttacks, away: state.away.dangerousAttacks },
      xG: { home: Math.round(state.home.xG * 100) / 100, away: Math.round(state.away.xG * 100) / 100 },
      passes: { home: state.home.passes, away: state.away.passes },
      passesCompleted: { home: state.home.passesCompleted, away: state.away.passesCompleted },
      dribbles: { home: state.home.dribbles, away: state.away.dribbles },
      dribblesSuccess: { home: state.home.dribblesSuccess, away: state.away.dribblesSuccess },
      crosses: { home: state.home.crosses, away: state.away.crosses },
      crossesSuccess: { home: state.home.crossesSuccess, away: state.away.crossesSuccess },
      dangerousAttacks: { home: state.home.dangerousAttacks, away: state.away.dangerousAttacks },
      recoveries: { home: state.home.recoveries, away: state.away.recoveries },
    },
    played: true,
  };
}

// ═══════════════════════════════════════════════
// MAC ICI KARTLAR
// ═══════════════════════════════════════════════

function processCardsInMatch(
  state: MatchState,
  players: Record<string, Player>,
  sentOff: Set<string>,
  matchYellows: Set<string>,
  pendingEvents: { minute: number; event: MatchEvent }[]
): void {
  if (Math.random() > 0.08) return;

  const isHome = Math.random() < 0.5;
  const club = isHome ? state.home.club : state.away.club;
  const teamState = isHome ? state.home : state.away;
  ensureInjuredPlayers(teamState);

  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const activePlayers = xi.filter(p =>
    !sentOff.has(p.id) && !isInjured(teamState, p.id)
  );

  const defenders = activePlayers.filter(p =>
    ['DC', 'DL', 'DR', 'DM', 'MC'].includes(p.position)
  );
  const pool = defenders.length > 0 ? defenders : activePlayers;
  if (pool.length === 0) return;

  const player = pool[Math.floor(Math.random() * pool.length)];
  if (!player) return;

  const cardMinute = state.minute;

  if (matchYellows.has(player.id)) {
    players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
    teamState.redCards++;
    sentOff.add(player.id);
    pendingEvents.push({
      minute: cardMinute,
      event: {
        minute: cardMinute,
        type: 'red',
        playerId: player.id,
        clubId: club.id,
        description: `KIRMIZI! ${player.name} ikinci saridan atildi (${club.shortName})`,
      },
    });
    return;
  }

  const red = Math.random() < 0.06;
  if (red) {
    players[player.id] = { ...player, suspensionWeeks: 2, yellowCards: 0 };
    teamState.redCards++;
    sentOff.add(player.id);
    pendingEvents.push({
      minute: cardMinute,
      event: {
        minute: cardMinute,
        type: 'red',
        playerId: player.id,
        clubId: club.id,
        description: `KIRMIZI! ${player.name} oyundan atildi (${club.shortName})`,
      },
    });
  } else {
    matchYellows.add(player.id);
    const newYellow = (player.yellowCards ?? 0) + 1;
    if (newYellow >= 4) {
      players[player.id] = { ...player, yellowCards: 0, suspensionWeeks: 1 };
      pendingEvents.push({
        minute: cardMinute,
        event: {
          minute: cardMinute,
          type: 'yellow',
          playerId: player.id,
          clubId: club.id,
          description: `${player.name} 4. saridan ceza aldi (${club.shortName})`,
        },
      });
    } else {
      players[player.id] = { ...player, yellowCards: newYellow };
      pendingEvents.push({
        minute: cardMinute,
        event: {
          minute: cardMinute,
          type: 'yellow',
          playerId: player.id,
          clubId: club.id,
          description: `${player.name} sari kart gordu (${newYellow}/4) (${club.shortName})`,
        },
      });
    }
  }
}

// ═══════════════════════════════════════════════
// MAC ICI SAKATLIKLAR
// ═══════════════════════════════════════════════

function processInjuriesInMatch(
  state: MatchState,
  players: Record<string, Player>,
  sentOff: Set<string>,
  pendingEvents: { minute: number; event: MatchEvent }[]
): void {
  if (Math.random() > 0.015) return;

  const isHome = Math.random() < 0.5;
  const club = isHome ? state.home.club : state.away.club;
  const teamState = isHome ? state.home : state.away;
  ensureInjuredPlayers(teamState);

  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const activePlayers = xi.filter(p =>
    !sentOff.has(p.id) && !isInjured(teamState, p.id)
  );
  if (activePlayers.length === 0) return;

  const player = activePlayers[Math.floor(Math.random() * activePlayers.length)];
  if (!player) return;

  const injuryRoll = Math.random();
  let weeks: number;
  let type: string;
  if (injuryRoll < 0.6) { weeks = 1; type = pickInjuryType('light'); }
  else if (injuryRoll < 0.88) { weeks = 2 + Math.floor(Math.random() * 3); type = pickInjuryType('medium'); }
  else { weeks = 5 + Math.floor(Math.random() * 4); type = pickInjuryType('severe'); }

  const injMinute = state.minute;
  players[player.id] = { ...player, injuryWeeks: weeks, injuryType: type };
  teamState.injuredPlayers.push(player.id);

  pendingEvents.push({
    minute: injMinute,
    event: {
      minute: injMinute,
      type: 'injury',
      playerId: player.id,
      clubId: club.id,
      description: `${player.name} sakatlandi - ${type} (${weeks} hafta)`,
    },
  });
}

function getZoneLabel(zone: string): string {
  const labels: Record<string, string> = {
    'leftAttack': 'sol kanattan',
    'centerAttack': 'merkezden',
    'rightAttack': 'sag kanattan',
    'leftMidfield': 'sol orta',
    'centerMidfield': 'merkez orta',
    'rightMidfield': 'sag orta',
  };
  return labels[zone] || zone;
}