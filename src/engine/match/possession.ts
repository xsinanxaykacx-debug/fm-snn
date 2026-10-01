
import type { MatchState, TeamMatchState } from './matchState';

export type ZoneKey =
  | 'leftDefense'
  | 'centerDefense'
  | 'rightDefense'
  | 'leftMidfield'
  | 'centerMidfield'
  | 'rightMidfield'
  | 'leftAttack'
  | 'centerAttack'
  | 'rightAttack';

// ═══════════════════════════════════════════════
// TOPA SAHİP OLACAK TAKIM
// ═══════════════════════════════════════════════
//
// Possession üç ana bileşenden oluşur:
//
//   Orta saha gücü  → %60
//   Pressing        → %20
//   Momentum        → %20
//
// Ev sahibi için kontrollü +6 avantaj uygulanır.
//
// Amaç:
// - Ev sahibine gerçekçi saha avantajı vermek
// - Takım kalitesini ezmemek
// - Possession'ı doğrudan sonuca bağlamamak
//
// Sonuçların hâlâ diğer motor katmanlarından
// doğal olarak çıkması gerekir.
// ═══════════════════════════════════════════════

export function choosePossessionTeam(
  state: MatchState
): 'home' | 'away' {
  const home = state.home;
  const away = state.away;

  const homePower =
    home.analysis.midfield * 0.60 +
    home.analysis.pressing * 0.20 +
    home.momentum * 0.20;

  const awayPower =
    away.analysis.midfield * 0.60 +
    away.analysis.pressing * 0.20 +
    away.momentum * 0.20;

  // Kontrollü ev sahibi avantajı.
  //
  // Önceki değer +3 idi.
  // +6 ile yaklaşık 2-3 puanlık possession etkisi
  // oluşturması beklenir.
  const homeBonus = 6;

  const total =
    homePower +
    awayPower +
    homeBonus;

  if (total <= 0) {
    return Math.random() < 0.5
      ? 'home'
      : 'away';
  }

  const homeProb =
    (homePower + homeBonus) /
    total;

  return Math.random() < homeProb
    ? 'home'
    : 'away';
}

// ═══════════════════════════════════════════════
// HÜCUM BÖLGESİ SEÇİMİ
// ═══════════════════════════════════════════════
//
// Hücum eden takımın:
//
//   sol hücum  ↔ rakip sağ savunma
//   merkez     ↔ rakip merkez savunma
//   sağ hücum  ↔ rakip sol savunma
//
// karşılaştırılır.
//
// sigmoid() sonucu 0-100 arası avantaj üretir.
// Daha sonra softmax benzeri exp ağırlığıyla
// bölge seçilir.
// ═══════════════════════════════════════════════

export function chooseAttackZone(
  state: MatchState,
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): {
  zone: ZoneKey;
  advantagePct: number;
} {
  // state parametresi API uyumluluğu için korunuyor.
  void state;

  const leftAdv =
    sigmoid(
      attackingTeam.analysis.zones.leftAttack,
      defendingTeam.analysis.zones.rightDefense
    );

  const centerAdv =
    sigmoid(
      attackingTeam.analysis.zones.centerAttack,
      defendingTeam.analysis.zones.centerDefense
    );

  const rightAdv =
    sigmoid(
      attackingTeam.analysis.zones.rightAttack,
      defendingTeam.analysis.zones.leftDefense
    );

  // Aşırı baskın bölgenin her şeyi belirlemesini
  // engellemek için ölçek kontrollü tutuluyor.
  const wLeft =
    Math.exp(leftAdv / 15);

  const wCenter =
    Math.exp(centerAdv / 15);

  const wRight =
    Math.exp(rightAdv / 15);

  const total =
    wLeft +
    wCenter +
    wRight;

  let r =
    Math.random() * total;

  if (r < wLeft) {
    return {
      zone: 'leftAttack',
      advantagePct: leftAdv,
    };
  }

  r -= wLeft;

  if (r < wCenter) {
    return {
      zone: 'centerAttack',
      advantagePct: centerAdv,
    };
  }

  return {
    zone: 'rightAttack',
    advantagePct: rightAdv,
  };
}

// ═══════════════════════════════════════════════
// ORTA SAHA BÖLGESİ SEÇİMİ
// ═══════════════════════════════════════════════
//
// Sol / merkez / sağ orta saha eşleşmeleri:
//
//   sol orta    ↔ rakip sağ orta
//   merkez      ↔ rakip merkez
//   sağ orta   ↔ rakip sol orta
// ═══════════════════════════════════════════════

export function chooseMidfieldZone(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): ZoneKey {
  const leftAdv =
    sigmoid(
      attackingTeam.analysis.zones.leftMidfield,
      defendingTeam.analysis.zones.rightMidfield
    );

  const centerAdv =
    sigmoid(
      attackingTeam.analysis.zones.centerMidfield,
      defendingTeam.analysis.zones.centerMidfield
    );

  const rightAdv =
    sigmoid(
      attackingTeam.analysis.zones.rightMidfield,
      defendingTeam.analysis.zones.leftMidfield
    );

  const wLeft =
    Math.exp(leftAdv / 15);

  const wCenter =
    Math.exp(centerAdv / 15);

  const wRight =
    Math.exp(rightAdv / 15);

  const total =
    wLeft +
    wCenter +
    wRight;

  let r =
    Math.random() * total;

  if (r < wLeft) {
    return 'leftMidfield';
  }

  r -= wLeft;

  if (r < wCenter) {
    return 'centerMidfield';
  }

  return 'rightMidfield';
}

// ═══════════════════════════════════════════════
// TOP KAYBI OLASILIĞI
// ═══════════════════════════════════════════════
//
// Savunma baskısı:
//
//   pressing       %40
//   midfield       %30
//   discipline     %15
//   momentum       %15
//
// Hücum kontrolü:
//
//   midfield       %35
//   canPass        %25
//   pressing       %20
//   momentum       %20
//
// Sonuç 0.03 - 0.18 arasında tutulur.
// ═══════════════════════════════════════════════

export function calculateTurnoverChance(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): number {
  const attackControl =
    attackingTeam.analysis.midfield * 0.35 +
    attackingTeam.analysis.canPass * 0.25 +
    attackingTeam.analysis.pressing * 0.20 +
    attackingTeam.momentum * 0.20;

  const defensePress =
    defendingTeam.analysis.pressing * 0.40 +
    defendingTeam.analysis.midfield * 0.30 +
    defendingTeam.analysis.discipline * 0.15 +
    defendingTeam.momentum * 0.15;

  let turnoverChance =
    0.05 +
    (defensePress - attackControl) / 700;

  return clamp(
    turnoverChance,
    0.03,
    0.18
  );
}

// ═══════════════════════════════════════════════
// SIGMOID
// ═══════════════════════════════════════════════
//
// İki takım/bölge arasındaki farkı:
//
//   0  → çok kötü
//   50 → dengeli
//   100 → çok iyi
//
// şeklinde sıkıştırır.
// ═══════════════════════════════════════════════

export function sigmoid(
  a: number,
  b: number
): number {
  return (
    100 /
    (
      1 +
      Math.exp(-(a - b) / 8)
    )
  );
}

// ═══════════════════════════════════════════════
// CLAMP
// ═══════════════════════════════════════════════

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

