// src/engine/match/chance.ts

import type {
  Player,
  AttackSequence,
} from '../types';

import type {
  TeamMatchState,
} from './matchState';

import { eff } from './teamAnalysis';
import type { MatchRng } from './rng';

export interface Chance {
  shooter: Player;
  distance: number;
  angle: number;
  pressure: number;

  type:
    | 'open_play'
    | 'counter'
    | 'cross'
    | 'long_shot'
    | 'set_piece'
    | 'big_chance';

  xG: number;

  positionMultiplier: number;

  chanceQuality: number;
}

// ═══════════════════════════════════════════════
// ŞANS / xG HESABI
// ═══════════════════════════════════════════════
//
// Ev sahibi avantajı burada gerçek xG hesabına
// dahil edilir.
//
// ÖNEMLİ:
//
// Possession avantajı ayrı katmandır.
//
// Buradaki avantaj ise:
//
// possession
//    ↓
// attack sequence
//    ↓
// chance
//    ↓
// xG
//
// zincirinin son bölümünde uygulanır.
//
// Böylece "ev sahibi + rastgele gol" yapılmaz.
// Gerçek bir gol pozisyonunun kalitesine küçük
// bir bağlamsal avantaj uygulanır.
// ═══════════════════════════════════════════════

export function calculateChanceFromSequence(
  sequence: AttackSequence,
  shooter: Player,
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState,
  isHome: boolean = false,
  rng: MatchRng = Math.random
): Chance {
  // Parametreler motor sözleşmesinin parçası.
  // Şimdilik takım state'leri sequence tarafından
  // zaten hesaplanan kaliteyi desteklemek için
  // korunuyor.
  void attackingTeam;
  void defendingTeam;

  // ═══════════════════════════════════════════
  // POZİSYON KALİTESİ
  // ═══════════════════════════════════════════

  const quality =
    Math.max(
      0,
      Math.min(
        100,
        sequence.chanceQuality
      )
    );

  // ═══════════════════════════════════════════
  // MESAFE
  // ═══════════════════════════════════════════

  let distance =
    25 -
    (quality / 100) * 19;

  if (
    sequence.finalZone ===
    'centerAttack'
  ) {
    distance =
      Math.max(
        6,
        distance - 3
      );
  } else if (
    sequence.finalZone ===
      'leftAttack' ||
    sequence.finalZone ===
      'rightAttack'
  ) {
    distance =
      Math.max(
        8,
        distance
      );
  }

  distance =
    Math.max(
      5,
      Math.min(
        30,
        distance +
          (rng() - 0.5) *
            4
      )
    );

  // ═══════════════════════════════════════════
  // AÇI
  // ═══════════════════════════════════════════

  let angle: number;

  if (
    sequence.finalZone ===
    'centerAttack'
  ) {
    angle =
      45 +
      (quality / 100) *
        60;
  } else {
    angle =
      25 +
      (quality / 100) *
        50;
  }

  angle =
    Math.max(
      15,
      Math.min(
        120,
        angle +
          (rng() - 0.5) *
            15
      )
    );

  // ═══════════════════════════════════════════
  // BASKI
  // ═══════════════════════════════════════════

  const pressure =
    Math.max(
      10,
      Math.min(
        95,
        sequence.finalPressure
      )
    );

  // ═══════════════════════════════════════════
  // OYUNCU KALİTESİ
  // ═══════════════════════════════════════════

  const finishing =
    eff(
      shooter,
      'finishing'
    );

  const composure =
    eff(
      shooter,
      'composure'
    );

  const technique =
    eff(
      shooter,
      'technique'
    );

  // ═══════════════════════════════════════════
  // MESAFE FAKTÖRÜ
  // ═══════════════════════════════════════════

  let distanceFactor: number;

  if (
    distance <= 6
  ) {
    distanceFactor = 1.6;
  } else if (
    distance <= 12
  ) {
    distanceFactor = 1.15;
  } else if (
    distance <= 18
  ) {
    distanceFactor = 0.8;
  } else if (
    distance <= 25
  ) {
    distanceFactor = 0.5;
  } else {
    distanceFactor = 0.25;
  }

  // ═══════════════════════════════════════════
  // TEMEL xG
  // ═══════════════════════════════════════════

  let xg =
    0.20 *
    distanceFactor;

  // Bitiricilik
  xg *=
    0.85 +
    (finishing / 100) *
      0.30;

  // Soğukkanlılık
  xg *=
    0.90 +
    (composure / 100) *
      0.20;

  // Teknik
  xg *=
    0.95 +
    (technique / 100) *
      0.10;

  // Baskı
  xg *=
    1 -
    (pressure / 100) *
      0.5;

  // ═══════════════════════════════════════════
  // AÇI FAKTÖRÜ
  // ═══════════════════════════════════════════

  if (
    angle > 90
  ) {
    xg *= 0.7;
  } else if (
    angle > 70
  ) {
    xg *= 0.9;
  } else if (
    angle > 50
  ) {
    xg *= 1.0;
  } else {
    xg *= 1.15;
  }

  // ═══════════════════════════════════════════
  // POZİSYON / HÜCUM TİPİ
  // ═══════════════════════════════════════════

  let positionMultiplier =
    1.0;

  let chanceType:
    Chance['type'] =
      'open_play';

  if (
    sequence.finalZone ===
      'leftAttack' ||
    sequence.finalZone ===
      'rightAttack'
  ) {
    positionMultiplier =
      1.15;

    chanceType =
      'cross';
  } else if (
    sequence.totalActions >=
    4
  ) {
    positionMultiplier =
      1.2;

    chanceType =
      'counter';
  } else if (
    distance > 20
  ) {
    positionMultiplier =
      0.7;

    chanceType =
      'long_shot';
  }

  xg *=
    positionMultiplier;

  // ═══════════════════════════════════════════
  // BÜYÜK FIRSAT
  // ═══════════════════════════════════════════

  if (
    distance <= 10 &&
    pressure < 50 &&
    angle > 60
  ) {
    xg *= 1.4;

    chanceType =
      'big_chance';
  }

  // ═══════════════════════════════════════════
  // EV SAHİBİ / DEPLASMAN ETKİSİ
  // ═══════════════════════════════════════════
  //
  // Home:
  //   +8%
  //
  // Away:
  //   -3%
  //
  // Neden simetrik değil?
  //
  // Ev sahibi avantajı yalnızca rakibin
  // dezavantajından oluşmaz.
  //
  // Saha aşinalığı, seyirci, hakem baskısı,
  // oyun ritmi ve risk alma davranışı gibi
  // faktörlerin tamamını tek tek modellemek yerine
  // kontrollü bir toplu katsayı kullanıyoruz.
  //
  // Bu katsayı:
  //
  // - sequence sayısını değiştirmez
  // - şut sayısını doğrudan değiştirmez
  // - oyuncu özelliklerini değiştirmez
  //
  // Sadece oluşmuş pozisyonun gol değerini
  // küçük miktarda değiştirir.
  // ═══════════════════════════════════════════

  const venueMultiplier =
    isHome
      ? 1.08
      : 0.97;

  xg *=
    venueMultiplier;

  // ═══════════════════════════════════════════
  // xG SINIRI
  // ═══════════════════════════════════════════

  const finalXG =
    Math.max(
      0.01,
      Math.min(
        0.95,
        xg
      )
    );

  return {
    shooter,

    distance:
      Math.round(
        distance * 10
      ) / 10,

    angle:
      Math.round(
        angle
      ),

    pressure:
      Math.round(
        pressure
      ),

    type:
      chanceType,

    xG:
      finalXG,

    positionMultiplier,

    chanceQuality:
      quality,
  };
}

// ═══════════════════════════════════════════════
// KALECİ ETKİSİ
// ═══════════════════════════════════════════════

export function applyGoalkeeper(
  gk: Player | null,
  xg: number
): {
  goalProb: number;
  saveProb: number;
} {
  if (!gk) {
    const goalProb =
      Math.max(
        0.01,
        Math.min(
          0.95,
          xg * 1.15
        )
      );

    return {
      goalProb,

      saveProb:
        1 - goalProb,
    };
  }

  const reflexes =
    eff(
      gk,
      'reflexes'
    );

  const positioning =
    eff(
      gk,
      'gkPositioning'
    );

  const handling =
    eff(
      gk,
      'handling'
    );

  const oneOnOne =
    eff(
      gk,
      'oneOnOne'
    );

  const gkRating =
    reflexes * 0.30 +
    positioning * 0.30 +
    handling * 0.20 +
    oneOnOne * 0.20;

  const gkFactor =
    1.0 -
    (gkRating - 50) /
      150;

  const adjustedXG =
    xg *
    gkFactor;

  const goalProb =
    Math.max(
      0.01,
      Math.min(
        0.95,
        adjustedXG
      )
    );

  return {
    goalProb,

    saveProb:
      1 - goalProb,
  };
}

// ═══════════════════════════════════════════════
// İSABETLİ ŞUT OLASILIĞI
// ═══════════════════════════════════════════════

export function onTargetProbability(
  shooter: Player,
  xg: number
): number {
  const shooting =
    eff(
      shooter,
      'shooting'
    );

  const technique =
    eff(
      shooter,
      'technique'
    );

  const finishing =
    eff(
      shooter,
      'finishing'
    );

  const quality =
    shooting * 0.4 +
    technique * 0.3 +
    finishing * 0.3;

  let probability =
    0.42 +
    (quality - 50) /
      180;

  probability +=
    xg * 0.22;

  return Math.max(
    0.25,
    Math.min(
      0.88,
      probability
    )
  );
}

