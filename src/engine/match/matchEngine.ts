// src/engine/match/matchEngine.ts

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

function pickInjuryType(severity: 'light' | 'medium' | 'severe'): string {
  const light = ['Kas Agrisi', 'Kucuk Burkulma', 'Hafif Darbe'];
  const medium = ['Hamstring', 'Ayak Bilegi', 'Diz Burkulmasi'];
  const severe = ['Capraz Bag', 'Kaval Kemigi Kirigi', 'Asil Tendonu'];
  const pool = severity === 'light' ? light : severity === 'medium' ? medium : severe;
  return pool[Math.floor(Math.random() * pool.length)];
}

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
// İSTATİSTİK GÜNCELLEME
// ═══════════════════════════════════════════════

interface StatsUpdate {
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  appearances?: number;
  rating?: number;
  minutesPlayed?: number;
  motm?: number;
}

function updateCareerStats(
  players: Record<string, Player>,
  playerId: string,
  update: StatsUpdate
): void {
  const player = players[playerId];
  if (!player) return;

  const stats = player.careerStats ?? {
    appearances: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: 0,
    minutesPlayed: 0,
    motm: 0,
  };

  // Sayaçları artır
  if (update.goals) stats.goals += update.goals;
  if (update.assists) stats.assists += update.assists;
  if (update.yellowCards) stats.yellowCards += update.yellowCards;
  if (update.redCards) stats.redCards += update.redCards;
  if (update.appearances) stats.appearances += update.appearances;
  if (update.minutesPlayed) stats.minutesPlayed += update.minutesPlayed;
  if (update.motm) stats.motm += update.motm;

  // Ortalama reyting hesapla — doğru formül
  if (update.rating !== undefined && update.rating > 0) {
    const previousTotal = stats.avgRating * Math.max(0, stats.appearances - 1);
    const newTotal = previousTotal + update.rating;
    const divisor = Math.max(1, stats.appearances);
    stats.avgRating = Math.round((newTotal / divisor) * 100) / 100;
  }

  players[playerId] = { ...player, careerStats: stats };
}

// ═══════════════════════════════════════════════
// ANA MOTOR
// ═══════════════════════════════════════════════

export function simulateMatch(
  home: Club,
  away: Club,
  players: Record<string, Player>,
  week: number,
  userLineup?: string[]
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
    userLineup,
  };

  ensureInjuredPlayers(state.home);
  ensureInjuredPlayers(state.away);

  const totalTicks = 36;
  const minutePerTick = 2.5;
  const sentOff = new Set<string>();
  const matchYellows = new Set<string>();

  // Maç başında forma giyen oyuncuları al
  const homeXI = getStartingXI(home.id, players, home.tactic.formation, home.isUser ? userLineup : undefined);
  const awayXI = getStartingXI(away.id, players, away.tactic.formation, away.isUser ? userLineup : undefined);

  // Maç başı — maç sayısı ve dakika ekle
  for (const p of homeXI) {
    updateCareerStats(players, p.id, { appearances: 1, minutesPlayed: 90 });
  }
  for (const p of awayXI) {
    updateCareerStats(players, p.id, { appearances: 1, minutesPlayed: 90 });
  }

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

    ensureInjuredPlayers(attackState);
    ensureInjuredPlayers(defendState);

    const { zone } = chooseAttackZone(state, attackState, defendState);

    const attackLineup = attackClub.isUser ? state.userLineup : undefined;
    const defendLineup = defendClub.isUser ? state.userLineup : undefined;

    const attackXI2 = getStartingXI(
      attackClub.id,
      players,
      attackClub.tactic.formation,
      attackLineup
    ).filter(p => !sentOff.has(p.id) && !isInjured(attackState, p.id));

    const defendXI2 = getStartingXI(
      defendClub.id,
      players,
      defendClub.tactic.formation,
      defendLineup
    ).filter(p => !sentOff.has(p.id) && !isInjured(defendState, p.id));

    if (attackXI2.length < 7 || defendXI2.length < 7) {
      consumeCondition(state);
      continue;
    }

    const sequence = createAttackSequence(attackState, defendState, attackXI2, defendXI2, zone);
    state.sequences.push(sequence);

    if (!sequence.resultedInShot || sequence.chanceQuality <= 30) {
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

    const shooter = pickShooter(attackXI2, sequence.finalZone) || attackXI2[0];
    if (!shooter) {
      consumeCondition(state);
      continue;
    }

    const chance = calculateChanceFromSequence(sequence, shooter, attackState, defendState);

    attackState.shots++;
    attackState.xG += chance.xG;

    const gk = defendXI2.find(p => p.position === 'GK') || null;
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

      // Gol istatistiği
      updateCareerStats(players, shooter.id, { goals: 1 });

      // Asist istatistiği — son pası yapan oyuncu
      const lastPass = sequence.actions
        .filter(a => a.success && (a.action === 'pass' || a.action === 'throughBall' || a.action === 'cross'))
        .slice(-1)[0];
      if (lastPass && lastPass.playerId !== shooter.id) {
        updateCareerStats(players, lastPass.playerId, { assists: 1 });
      }

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

  // ═══════════════════════════════════════════════
  // MAÇ SONUNDA TÜM OYUNCULARA REYTİNG VER
  // ═══════════════════════════════════════════════

  const allPlayers = [...homeXI, ...awayXI];

  // Takım sonuçları
  const homeGoalDiff = state.homeScore - state.awayScore;
  const awayGoalDiff = state.awayScore - state.homeScore;

  let bestPlayerId: string | null = null;
  let bestRating = 0;

  for (const p of allPlayers) {
    if (!p) continue;

    const isHomePlayer = homeXI.some(hp => hp.id === p.id);
    const teamGoals = isHomePlayer ? state.homeScore : state.awayScore;
    const oppGoals = isHomePlayer ? state.awayScore : state.homeScore;
    const goalDiff = isHomePlayer ? homeGoalDiff : awayGoalDiff;

    // Baz reyting
    let matchRating = 6.5;

    // Form bonusu (0-1.0)
    matchRating += (p.form / 100) * 1.0;

    // Kondisyon bonusu (0-0.5)
    matchRating += (p.condition / 100) * 0.5;

    // Takım sonucu bonusu
    matchRating += goalDiff * 0.3;

    // Atılan gol bonusu (gol atan oyunculara)
    const goalsThisMatch = (p.careerStats?.goals ?? 0);
    void goalsThisMatch;

    // Kaleci clean sheet bonusu
    if (p.position === 'GK' && oppGoals === 0) {
      matchRating += 1.0;
    }

    // Rastgelelik (±0.5)
    matchRating += (Math.random() - 0.5) * 1.0;

    // 4.0 - 9.5 arasına sıkıştır
    matchRating = Math.max(4.0, Math.min(9.5, matchRating));
    matchRating = Math.round(matchRating * 100) / 100;

    updateCareerStats(players, p.id, { rating: matchRating });

    if (matchRating > bestRating) {
      bestRating = matchRating;
      bestPlayerId = p.id;
    }
  }

  // MVP — en yüksek reytingli oyuncu
  if (bestPlayerId) {
    updateCareerStats(players, bestPlayerId, { motm: 1 });
  }

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

  const xi = getStartingXI(club.id, players, club.tactic.formation, club.isUser ? state.userLineup : undefined);
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
    updateCareerStats(players, player.id, { redCards: 1 });
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
    updateCareerStats(players, player.id, { redCards: 1 });
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
    updateCareerStats(players, player.id, { yellowCards: 1 });
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

  const xi = getStartingXI(club.id, players, club.tactic.formation, club.isUser ? state.userLineup : undefined);
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