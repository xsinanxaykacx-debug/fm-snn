// src/engine/match/matchEngine.ts

import type { Club, Match, MatchEvent, Player } from '../types';
import { getStartingXI } from '../data/generateData';
import { analyzeTeam, eff } from './teamAnalysis';
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
import { pickShooter, pickScorer } from './attack';

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

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
    appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
    avgRating: 0, minutesPlayed: 0, motm: 0,
    seasonAppearances: 0, seasonGoals: 0, seasonAssists: 0,
    seasonYellowCards: 0, seasonRedCards: 0, seasonAvgRating: 0,
    seasonMinutesPlayed: 0, seasonMotm: 0,
  };

  if (update.goals) stats.goals += update.goals;
  if (update.assists) stats.assists += update.assists;
  if (update.yellowCards) stats.yellowCards += update.yellowCards;
  if (update.redCards) stats.redCards += update.redCards;
  if (update.appearances) stats.appearances += update.appearances;
  if (update.minutesPlayed) stats.minutesPlayed += update.minutesPlayed;
  if (update.motm) stats.motm += update.motm;

  if (update.goals) stats.seasonGoals += update.goals;
  if (update.assists) stats.seasonAssists += update.assists;
  if (update.yellowCards) stats.seasonYellowCards += update.yellowCards;
  if (update.redCards) stats.seasonRedCards += update.redCards;
  if (update.appearances) stats.seasonAppearances += update.appearances;
  if (update.minutesPlayed) stats.seasonMinutesPlayed += update.minutesPlayed;
  if (update.motm) stats.seasonMotm += update.motm;

  if (update.rating !== undefined && update.rating > 0) {
    const previousTotal = stats.avgRating * Math.max(0, stats.appearances - 1);
    const newTotal = previousTotal + update.rating;
    const divisor = Math.max(1, stats.appearances);
    stats.avgRating = Math.round((newTotal / divisor) * 100) / 100;

    const prevSeasonTotal = stats.seasonAvgRating * Math.max(0, stats.seasonAppearances - 1);
    const newSeasonTotal = prevSeasonTotal + update.rating;
    const seasonDivisor = Math.max(1, stats.seasonAppearances);
    stats.seasonAvgRating = Math.round((newSeasonTotal / seasonDivisor) * 100) / 100;
  }

  let recentRatings = player.recentRatings ?? [];
  if (update.rating !== undefined && update.rating > 0) {
    recentRatings = [...recentRatings, update.rating].slice(-5);
  }

  players[playerId] = { ...player, careerStats: stats, recentRatings };
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

  // 🎯 Her oyuncunun GERÇEK oynadığı dakikayı takip et
  const minutesPlayed: Record<string, number> = {};
  const lastActiveMinute: Record<string, number> = {};

  const homeXI = getStartingXI(home.id, players, home.tactic.formation, home.isUser ? userLineup : undefined);
  const awayXI = getStartingXI(away.id, players, away.tactic.formation, away.isUser ? userLineup : undefined);

  // Maç başında herkes 0 dakika
  for (const p of [...homeXI, ...awayXI]) {
    minutesPlayed[p.id] = 0;
    lastActiveMinute[p.id] = 0;
  }

  // Maç içi yardımcı: oyuncu aktifse dakikasını güncelle
  function updateMinutes(playerId: string, currentMinute: number): void {
    if (lastActiveMinute[playerId] !== undefined) {
      const elapsed = currentMinute - lastActiveMinute[playerId];
      if (elapsed > 0) {
        minutesPlayed[playerId] = (minutesPlayed[playerId] ?? 0) + elapsed;
      }
    }
    lastActiveMinute[playerId] = currentMinute;
  }

  // Maç içi yardımcı: tüm aktif oyuncuların dakikalarını güncelle
  function updateAllMinutes(currentMinute: number, sentOffSet: Set<string>): void {
    for (const p of [...homeXI, ...awayXI]) {
      if (!sentOffSet.has(p.id)) {
        updateMinutes(p.id, currentMinute);
      }
    }
  }

  for (let tick = 0; tick < totalTicks; tick++) {
    const baseMinute = Math.floor(tick * minutePerTick) + 1;
    const currentMinute = Math.min(90, baseMinute + Math.floor(Math.random() * 3));
    const prevMinute = state.minute;

    // 🎯 Dakika farkını aktif oyunculara ekle
    updateAllMinutes(currentMinute, sentOff);

    state.minute = currentMinute;

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

    // 🎯 Gerçek golcü
    const scorer = pickScorer(attackXI2, sequence.finalZone, shooter);

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

      // 🎯 GOLCÜYÜ kaydet
      updateCareerStats(players, scorer.id, { goals: 1 });

      // 🎯 ASİST — %75 ihtimalle asist var
      const assistChance = 0.75;
      const hasAssist = Math.random() < assistChance;

      if (hasAssist) {
        const successfulPasses = sequence.actions.filter(a =>
          a.success &&
          a.playerId !== scorer.id &&
          (a.action === 'pass' || a.action === 'throughBall' || a.action === 'cross')
        );

        let assisterId: string | null = null;

        if (successfulPasses.length > 0) {
          assisterId = successfulPasses[successfulPasses.length - 1].playerId;
        } else {
          const assistCandidates = attackXI2.filter(p => {
            if (p.id === scorer.id) return false;
            if (p.position === 'GK') return false;
            return true;
          });

          if (assistCandidates.length > 0) {
            const weights = assistCandidates.map(p => {
              const passing = eff(p, 'passing');
              const vision = eff(p, 'vision');
              const crossing = eff(p, 'crossing');

              let positionWeight = 1;
              if (['MC', 'ML', 'MR', 'AMC', 'AML', 'AMR'].includes(p.position)) positionWeight = 3;
              else if (['WBL', 'WBR', 'DMC'].includes(p.position)) positionWeight = 2;
              else if (['ST', 'GF', 'KFL', 'KFR'].includes(p.position)) positionWeight = 1.5;
              else if (['DC', 'DL', 'DR'].includes(p.position)) positionWeight = 1;

              const attrWeight = passing * 0.5 + vision * 0.3 + crossing * 0.2;
              return Math.max(1, positionWeight * (attrWeight / 50));
            });

            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * totalWeight;
            for (let i = 0; i < assistCandidates.length; i++) {
              r -= weights[i];
              if (r <= 0) {
                assisterId = assistCandidates[i].id;
                break;
              }
            }
            if (!assisterId) {
              assisterId = assistCandidates[assistCandidates.length - 1].id;
            }
          }
        }

        if (assisterId) {
          updateCareerStats(players, assisterId, { assists: 1 });
        }
      }

      const zoneLabel = getZoneLabel(sequence.finalZone);

      pendingEvents.push({
        minute: state.minute,
        event: {
          minute: state.minute,
          type: 'goal',
          playerId: scorer.id,
          clubId: attackClub.id,
          description: `GOL! ${scorer.name} (${attackClub.shortName}) - ${zoneLabel} ${chance.distance.toFixed(0)}m (xG: ${chance.xG.toFixed(2)})`,
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

  // 🎯 Maç sonu: son dakikayı da ekle (90. dakika)
  updateAllMinutes(90, sentOff);

  // 🎯 APPEARANCES ve MINUTESPLAYED'i maç sonunda gerçek dakikalarla kaydet
  for (const p of [...homeXI, ...awayXI]) {
    const realMinutes = minutesPlayed[p.id] ?? 0;
    updateCareerStats(players, p.id, {
      appearances: 1,
      minutesPlayed: realMinutes,
    });
  }

  events.push(...pendingEvents.sort((a, b) => a.minute - b.minute).map(e => e.event));

  const possession = calculatePossession(state);

  // ═══ MAÇ SONU REYTİNG ═══
  const allPlayers = [...homeXI, ...awayXI];
  const homeGoalDiff = state.homeScore - state.awayScore;
  const awayGoalDiff = state.awayScore - state.homeScore;

  let bestPlayerId: string | null = null;
  let bestRating = 0;

  for (const p of allPlayers) {
    if (!p) continue;

    const isHomePlayer = homeXI.some(hp => hp.id === p.id);
    const oppGoals = isHomePlayer ? state.awayScore : state.homeScore;
    const goalDiff = isHomePlayer ? homeGoalDiff : awayGoalDiff;

    let matchRating = 6.5;
    matchRating += (p.form / 100) * 1.0;
    matchRating += (p.condition / 100) * 0.5;
    matchRating += goalDiff * 0.3;

    if (p.position === 'GK' && oppGoals === 0) {
      matchRating += 1.0;
    }

    matchRating += (Math.random() - 0.5) * 1.0;
    matchRating = Math.max(4.0, Math.min(9.5, matchRating));
    matchRating = Math.round(matchRating * 100) / 100;

    updateCareerStats(players, p.id, { rating: matchRating });

    if (matchRating > bestRating) {
      bestRating = matchRating;
      bestPlayerId = p.id;
    }
  }

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
    ['DC', 'DL', 'DR', 'DMC', 'MC'].includes(p.position)
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