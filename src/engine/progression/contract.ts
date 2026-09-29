// src/engine/progression/contract.ts

import type { Player } from '../types';

// ═══════════════════════════════════════════════
// SÖZLEŞME YÖNETİMİ
// ═══════════════════════════════════════════════

/**
 * Her sezon başında sözleşmeleri 1 yıl azaltır.
 * Sözleşmesi biten oyuncuları serbest bırakır.
 */
export function decrementContracts(
  players: Record<string, Player>,
  userClubId: string
): {
  updatedPlayers: Record<string, Player>;
  released: Player[];
  expiring: Player[];
} {
  const updatedPlayers: Record<string, Player> = { ...players };
  const released: Player[] = [];
  const expiring: Player[] = [];

  for (const id in updatedPlayers) {
    const p = updatedPlayers[id];
    if (!p.clubId) continue;

    // Sözleşme yaşını azalt
    const newYears = Math.max(0, (p.contractYears ?? 3) - 1);

    // Sözleşmesi biten oyuncular
    if (newYears <= 0) {
      // Kullanıcı takımındaysa → serbest bırak
      // AI takımındaysa → otomatik yenile
      if (p.clubId === userClubId) {
        released.push(p);
        updatedPlayers[id] = {
          ...p,
          clubId: null,
          contractYears: 0,
          squadRole: 'first',
        };
      } else {
        // AI otomatik 2-4 yıl yeniler
        updatedPlayers[id] = {
          ...p,
          contractYears: 2 + Math.floor(Math.random() * 3),
        };
      }
    } else {
      // Sözleşme devam ediyor
      updatedPlayers[id] = {
        ...p,
        contractYears: newYears,
      };

      // Bu sezon sonu sözleşmesi bitecek → uyarı listesine ekle
      if (newYears === 1 && p.clubId === userClubId) {
        expiring.push(updatedPlayers[id]);
      }
    }
  }

  return { updatedPlayers, released, expiring };
}

/**
 * Sözleşme yenileme teklifini değerlendirir.
 * Oyuncu, teklif edilen maaşa ve süreye göre kabul/red eder.
 */
export function evaluateContractOffer(
  player: Player,
  offeredWage: number,
  offeredYears: number
): { accepted: boolean; reason: string } {
  const currentWage = player.wage;
  const wageIncrease = offeredWage / currentWage;

  // Oyuncunun değerine göre beklenen maaş
  const expectedWage = Math.round(player.value / 400);
  const expectedRatio = offeredWage / expectedWage;

  // Yaş faktörü
  const ageFactor =
    player.age <= 23 ? 1.2 :   // Gençler daha kolay kabul
    player.age <= 27 ? 1.0 :
    player.age <= 30 ? 0.9 :
    0.8;                        // Yaşlılar daha zor

  // Overall faktörü (yüksek reyting = yüksek beklenti)
  const overallFactor = player.overall / 15;

  // Memnuniyet skoru
  let satisfaction = 0;
  satisfaction += (wageIncrease - 1) * 30;
  satisfaction += (expectedRatio - 1) * 40;
  satisfaction += (offeredYears - 1) * 5;
  satisfaction *= ageFactor;
  satisfaction += overallFactor * 10;

  // Rastgelelik
  satisfaction += (Math.random() - 0.5) * 20;

  // Memnuniyet 0+ ise kabul
  const accepted = satisfaction >= 0;

  let reason = '';
  if (accepted) {
    if (satisfaction > 30) reason = 'Oyuncu teklifi çok beğendi!';
    else if (satisfaction > 10) reason = 'Oyuncu teklifi kabul etti.';
    else reason = 'Oyuncu teklifi kabul etti (zoraki).';
  } else {
    if (wageIncrease < 1) reason = 'Oyuncu maaş artışı istiyor.';
    else if (expectedRatio < 0.8) reason = 'Oyuncu piyasa değerinin altında teklif aldı.';
    else if (offeredYears < 2) reason = 'Oyuncu daha uzun sözleşme istiyor.';
    else reason = 'Oyuncu teklifi reddetti.';
  }

  return { accepted, reason };
}

/**
 * Sözleşme yenileme tamamlandığında oyuncuyu günceller.
 */
export function applyContractRenewal(
  player: Player,
  offeredWage: number,
  offeredYears: number
): Player {
  return {
    ...player,
    wage: offeredWage,
    contractYears: offeredYears,
  };
}

/**
 * Kadro rolünü belirler (yaş + overall bazlı).
 */
export function determineSquadRole(player: Player): 'first' | 'rotation' | 'backup' | 'u21' {
  if (player.age <= 20) return 'u21';
  if (player.overall >= 14) return 'first';
  if (player.overall >= 11) return 'rotation';
  return 'backup';
}

/**
 * Oyuncunun sözleşme durumunu döndürür.
 */
export function getContractStatus(player: Player): {
  status: 'safe' | 'warning' | 'critical';
  color: string;
  label: string;
} {
  const years = player.contractYears ?? 3;

  if (years >= 3) return { status: 'safe', color: 'text-green-400', label: `${years} yıl` };
  if (years >= 2) return { status: 'safe', color: 'text-green-400', label: `${years} yıl` };
  if (years === 1) return { status: 'warning', color: 'text-yellow-400', label: '1 yıl' };
  return { status: 'critical', color: 'text-red-400', label: '⚠️ Bitiyor' };
}