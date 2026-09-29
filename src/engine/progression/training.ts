// src/engine/progression/training.ts

import type { Player } from '../types';

// ═══════════════════════════════════════════════
// OVERALL HESABI (1-20)
// ═══════════════════════════════════════════════

function computeOverall(a: Player['attributes'], position: string): number {
  let score: number;

  if (position === 'GK') {
    score = a.goalkeeper * 0.3 + a.reflexes * 0.25 + a.handling * 0.2 + a.oneOnOne * 0.15 + a.gkPositioning * 0.1;
  } else if (position === 'DC') {
    score = a.marking * 0.25 + a.tackling * 0.2 + a.defensivePositioning * 0.2 + a.anticipation * 0.15 + a.strength * 0.1 + a.heading * 0.1;
  } else if (position === 'DL' || position === 'DR') {
    score = a.marking * 0.2 + a.tackling * 0.2 + a.defensivePositioning * 0.15 + a.pace * 0.15 + a.acceleration * 0.1 + a.stamina * 0.1 + a.crossing * 0.1;
  } else if (position === 'DM') {
    score = a.passing * 0.2 + a.tackling * 0.2 + a.ballWinning * 0.15 + a.positioning * 0.15 + a.decisions * 0.15 + a.workRate * 0.15;
  } else if (position === 'MC') {
    score = a.passing * 0.25 + a.vision * 0.2 + a.decisions * 0.2 + a.technique * 0.15 + a.workRate * 0.1 + a.stamina * 0.1;
  } else if (position === 'ML' || position === 'MR') {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.2 + a.acceleration * 0.15 + a.technique * 0.15;
  } else if (position === 'AML' || position === 'AMR') {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.15 + a.finishing * 0.2 + a.offTheBall * 0.15;
  } else if (position === 'AMC') {
    score = a.passing * 0.2 + a.vision * 0.2 + a.technique * 0.2 + a.decisions * 0.15 + a.finishing * 0.15 + a.dribbling * 0.1;
  } else if (position === 'ST') {
    score = a.finishing * 0.3 + a.shooting * 0.2 + a.offTheBall * 0.2 + a.composure * 0.15 + a.technique * 0.15;
  } else {
    score = 10;
  }

  return Math.max(1, Math.min(20, Math.round(score)));
}

// ═══════════════════════════════════════════════
// DEĞER HESABI (1-20 reyting) — generateData.ts ile AYNI
// ═══════════════════════════════════════════════

export function calculateValue(overall: number, age: number): number {
  const ratingFactor = Math.max(0, (overall - 5) / 15);
  const baseValue = Math.pow(ratingFactor, 3) * 90_000_000;

  // 🔧 Yumuşak yaş eğrisi (lineer interpolasyon)
  let ageModifier: number;
  if (age <= 21) {
    ageModifier = 1.35;
  } else if (age <= 24) {
    // 21 → 1.35, 24 → 1.20
    ageModifier = 1.35 - (age - 21) * 0.05;
  } else if (age <= 27) {
    // 24 → 1.20, 27 → 1.00
    ageModifier = 1.20 - (age - 24) * 0.0667;
  } else if (age <= 30) {
    // 27 → 1.00, 30 → 0.75
    ageModifier = 1.00 - (age - 27) * 0.0833;
  } else if (age <= 33) {
    // 30 → 0.75, 33 → 0.45
    ageModifier = 0.75 - (age - 30) * 0.10;
  } else if (age <= 36) {
    // 33 → 0.45, 36 → 0.20
    ageModifier = 0.45 - (age - 33) * 0.0833;
  } else {
    // 36+ → kademeli düşüş
    ageModifier = Math.max(0.05, 0.20 - (age - 36) * 0.05);
  }

  return Math.max(50_000, Math.round(baseValue * ageModifier));
}

// ═══════════════════════════════════════════════
// YAŞ BAZLI GELİŞİM
// ═══════════════════════════════════════════════

interface AgeProgression {
  physical: number;
  technical: number;
  mental: number;
}

function getAgeProgression(age: number): AgeProgression {
  if (age <= 20) return { physical: 1.5, technical: 1.2, mental: 0.8 };
  if (age <= 23) return { physical: 1.0, technical: 1.0, mental: 0.8 };
  if (age <= 26) return { physical: 0.4, technical: 0.6, mental: 0.6 };
  if (age <= 28) return { physical: -0.2, technical: 0.3, mental: 0.5 };
  if (age <= 30) return { physical: -0.6, technical: 0.1, mental: 0.4 };
  if (age <= 32) return { physical: -1.2, technical: -0.1, mental: 0.3 };
  if (age <= 35) return { physical: -1.8, technical: -0.4, mental: 0.1 };
  return { physical: -2.5, technical: -0.6, mental: -0.3 };
}

// ═══════════════════════════════════════════════
// OYUNCU GELİŞİMİ (SEZON SONU)
// ═══════════════════════════════════════════════

export function developPlayers(
  players: Record<string, Player>
): Record<string, Player> {
  const newPlayers: Record<string, Player> = {};

  for (const id in players) {
    const p = { ...players[id] };
    const a = { ...p.attributes };

    // Yaş ilerle
    p.age = p.age + 1;

    // Yaşa göre gelişim
    const progression = getAgeProgression(p.age);
    const r = () => (Math.random() - 0.5) * 0.8;

    // ─────────────────────────────────────────
    // FİZİKSEL
    // ─────────────────────────────────────────
    a.pace = Math.max(1, Math.min(20, Math.round(a.pace + progression.physical + r())));
    a.acceleration = Math.max(1, Math.min(20, Math.round(a.acceleration + progression.physical + r())));
    a.stamina = Math.max(1, Math.min(20, Math.round(a.stamina + progression.physical * 0.5 + r())));
    a.strength = Math.max(1, Math.min(20, Math.round(a.strength + progression.physical * 0.5 + r())));
    a.agility = Math.max(1, Math.min(20, Math.round(a.agility + progression.physical * 0.7 + r())));
    a.balance = Math.max(1, Math.min(20, Math.round(a.balance + progression.physical * 0.5 + r())));

    // ─────────────────────────────────────────
    // TEKNİK
    // ─────────────────────────────────────────
    a.passing = Math.max(1, Math.min(20, Math.round(a.passing + progression.technical + r())));
    a.firstTouch = Math.max(1, Math.min(20, Math.round(a.firstTouch + progression.technical + r())));
    a.dribbling = Math.max(1, Math.min(20, Math.round(a.dribbling + progression.technical + r())));
    a.crossing = Math.max(1, Math.min(20, Math.round(a.crossing + progression.technical + r())));
    a.shooting = Math.max(1, Math.min(20, Math.round(a.shooting + progression.technical + r())));
    a.finishing = Math.max(1, Math.min(20, Math.round(a.finishing + progression.technical + r())));
    a.technique = Math.max(1, Math.min(20, Math.round(a.technique + progression.technical + r())));
    a.longShots = Math.max(1, Math.min(20, Math.round(a.longShots + progression.technical * 0.7 + progression.mental * 0.3 + r())));
    a.setPieces = Math.max(1, Math.min(20, Math.round(a.setPieces + progression.technical * 0.8 + r())));

    // ─────────────────────────────────────────
    // ZİHİNSEL
    // ─────────────────────────────────────────
    a.decisions = Math.max(1, Math.min(20, Math.round(a.decisions + progression.mental + r())));
    a.vision = Math.max(1, Math.min(20, Math.round(a.vision + progression.mental + r())));
    a.anticipation = Math.max(1, Math.min(20, Math.round(a.anticipation + progression.mental + r())));
    a.positioning = Math.max(1, Math.min(20, Math.round(a.positioning + progression.mental + r())));
    a.offTheBall = Math.max(1, Math.min(20, Math.round(a.offTheBall + progression.mental + r())));
    a.concentration = Math.max(1, Math.min(20, Math.round(a.concentration + progression.mental + r())));
    a.composure = Math.max(1, Math.min(20, Math.round(a.composure + progression.mental + r())));
    a.workRate = Math.max(1, Math.min(20, Math.round(a.workRate + progression.mental + r())));
    a.teamwork = Math.max(1, Math.min(20, Math.round(a.teamwork + progression.mental + r())));
    a.bravery = Math.max(1, Math.min(20, Math.round(a.bravery + progression.mental * 0.5 + progression.physical * 0.3 + r())));
    a.aggression = Math.max(1, Math.min(20, Math.round(a.aggression + progression.physical * 0.4 + progression.mental * 0.3 + r())));

    // ─────────────────────────────────────────
    // 🛡️ SAVUNMA (YENİ EKLENDİ)
    // ─────────────────────────────────────────
    a.marking = Math.max(1, Math.min(20, Math.round(a.marking + progression.technical * 0.7 + progression.mental * 0.3 + r())));
    a.tackling = Math.max(1, Math.min(20, Math.round(a.tackling + progression.technical * 0.7 + progression.mental * 0.3 + r())));
    a.defensivePositioning = Math.max(1, Math.min(20, Math.round(a.defensivePositioning + progression.mental + r())));
    a.heading = Math.max(1, Math.min(20, Math.round(a.heading + progression.physical * 0.4 + progression.technical * 0.3 + r())));
    a.ballWinning = Math.max(1, Math.min(20, Math.round(a.ballWinning + progression.mental * 0.7 + progression.physical * 0.3 + r())));

    // ─────────────────────────────────────────
    // 🧤 KALECİ (YENİ EKLENDİ)
    // ─────────────────────────────────────────
    a.goalkeeper = Math.max(1, Math.min(20, Math.round(a.goalkeeper + progression.technical * 0.5 + progression.mental * 0.5 + r())));
    a.reflexes = Math.max(1, Math.min(20, Math.round(a.reflexes + progression.physical * 0.6 + progression.technical * 0.4 + r())));
    a.gkPositioning = Math.max(1, Math.min(20, Math.round(a.gkPositioning + progression.mental + r())));
    a.handling = Math.max(1, Math.min(20, Math.round(a.handling + progression.technical * 0.7 + progression.mental * 0.3 + r())));
    a.oneOnOne = Math.max(1, Math.min(20, Math.round(a.oneOnOne + progression.mental + progression.technical * 0.3 + r())));
    a.aerialReach = Math.max(1, Math.min(20, Math.round(a.aerialReach + progression.physical * 0.5 + progression.mental * 0.3 + r())));

    p.attributes = a;

    // 🔧 Overall güncelle
    const newOverall = computeOverall(a, p.position);
    p.overall = newOverall;

    // 🔧 Value ve wage YENİ formülle
    p.value = calculateValue(newOverall, p.age);
    p.wage = Math.round(p.value / 500);

    // Emeklilik
    if (p.age >= 40) {
      p.clubId = null;
    }

    newPlayers[id] = p;
  }

  return newPlayers;
}