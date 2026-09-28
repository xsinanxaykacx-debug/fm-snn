import type { MatchState, TeamMatchState } from './matchState';

export type ZoneKey =
  | 'leftDefense' | 'centerDefense' | 'rightDefense'
  | 'leftMidfield' | 'centerMidfield' | 'rightMidfield'
  | 'leftAttack' | 'centerAttack' | 'rightAttack';

export function choosePossessionTeam(state: MatchState): 'home' | 'away' {
  const home = state.home;
  const away = state.away;

  const homePower = home.analysis.midfield * 0.55 + home.analysis.pressing * 0.25 + home.momentum * 0.2;
  const awayPower = away.analysis.midfield * 0.55 + away.analysis.pressing * 0.25 + away.momentum * 0.2;

  const homeBonus = 3;

  const total = homePower + awayPower + homeBonus;
  const homeProb = (homePower + homeBonus) / total;

  return Math.random() < homeProb ? 'home' : 'away';
}

export function chooseAttackZone(
  state: MatchState,
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): { zone: ZoneKey; advantagePct: number } {
  const leftAdv = sigmoid(
    attackingTeam.analysis.zones.leftAttack,
    defendingTeam.analysis.zones.rightDefense
  );
  const centerAdv = sigmoid(
    attackingTeam.analysis.zones.centerAttack,
    defendingTeam.analysis.zones.centerDefense
  );
  const rightAdv = sigmoid(
    attackingTeam.analysis.zones.rightAttack,
    defendingTeam.analysis.zones.leftDefense
  );

  const wLeft = Math.exp(leftAdv / 15);
  const wCenter = Math.exp(centerAdv / 15);
  const wRight = Math.exp(rightAdv / 15);

  const total = wLeft + wCenter + wRight;
  let r = Math.random() * total;

  if (r < wLeft) return { zone: 'leftAttack', advantagePct: leftAdv };
  r -= wLeft;
  if (r < wCenter) return { zone: 'centerAttack', advantagePct: centerAdv };
  return { zone: 'rightAttack', advantagePct: rightAdv };
}

export function chooseMidfieldZone(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): ZoneKey {
  const leftAdv = sigmoid(
    attackingTeam.analysis.zones.leftMidfield,
    defendingTeam.analysis.zones.rightMidfield
  );
  const centerAdv = sigmoid(
    attackingTeam.analysis.zones.centerMidfield,
    defendingTeam.analysis.zones.centerMidfield
  );
  const rightAdv = sigmoid(
    attackingTeam.analysis.zones.rightMidfield,
    defendingTeam.analysis.zones.leftMidfield
  );

  const wLeft = Math.exp(leftAdv / 15);
  const wCenter = Math.exp(centerAdv / 15);
  const wRight = Math.exp(rightAdv / 15);

  const total = wLeft + wCenter + wRight;
  let r = Math.random() * total;

  if (r < wLeft) return 'leftMidfield';
  r -= wLeft;
  if (r < wCenter) return 'centerMidfield';
  return 'rightMidfield';
}

export function calculateTurnoverChance(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): number {
  const attackControl =
    attackingTeam.analysis.midfield * 0.35 +
    attackingTeam.analysis.canPass * 0.25 +
    attackingTeam.analysis.pressing * 0.20 +
    attackingTeam.momentum * 0.2;

  const defensePress =
    defendingTeam.analysis.pressing * 0.40 +
    defendingTeam.analysis.midfield * 0.30 +
    defendingTeam.analysis.discipline * 0.15 +
    defendingTeam.momentum * 0.15;

  let turnoverChance = 0.05 + (defensePress - attackControl) / 700;
  return clamp(turnoverChance, 0.03, 0.18);
}

export function sigmoid(a: number, b: number): number {
  return 100 / (1 + Math.exp(-(a - b) / 8));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}