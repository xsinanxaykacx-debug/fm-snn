// src/engine/formation/zones.ts

import type { PitchZone, SlotPosition, PitchRow, PitchCol } from '../types';

// ═══════════════════════════════════════════════
// 6 SATIR × 3 SÜTUN = 16 BÖLGE (GK sadece orta)
// ═══════════════════════════════════════════════

// Satır 0 = FORVET (yukarı), Satır 5 = GK (aşağı)
// Sütun 0 = SOL, Sütun 1 = ORTA, Sütun 2 = SAĞ

export const ROW_NAMES: PitchRow[] = ['FORVET', 'ATAKORTA', 'ORTA', 'DEFANSIFORTA', 'DEFANS', 'GK'];
export const COL_NAMES: PitchCol[] = ['SOL', 'ORTA', 'SAG'];

// Her bölgenin önerilen pozisyonu
// [satır][sütun] = pozisyon
const SUGGESTED_POSITIONS: Record<number, Record<number, SlotPosition>> = {
  // Satır 0: FORVET
  0: {
    0: 'KFL',
    1: 'ST',
    2: 'KFR',
  },
  // Satır 1: ATAKORTA
  1: {
    0: 'AML',
    1: 'AMC',
    2: 'AMR',
  },
  // Satır 2: ORTA
  2: {
    0: 'ML',
    1: 'MC',
    2: 'MR',
  },
  // Satır 3: DEFANSİFORTA
  3: {
    0: 'WBL',
    1: 'DMC',
    2: 'WBR',
  },
  // Satır 4: DEFANS
  4: {
    0: 'DL',
    1: 'DC',
    2: 'DR',
  },
  // Satır 5: GK (sadece ORTA)
  5: {
    1: 'GK',
  },
};

// Pozisyonun hangi satır/sütuna ait olduğunu gösteren harita
export const POSITION_TO_ROW: Record<SlotPosition, PitchRow> = {
  'GK': 'GK',
  'DL': 'DEFANS', 'DC': 'DEFANS', 'DR': 'DEFANS',
  'WBL': 'DEFANSIFORTA', 'DMC': 'DEFANSIFORTA', 'WBR': 'DEFANSIFORTA',
  'ML': 'ORTA', 'MC': 'ORTA', 'MR': 'ORTA',
  'AML': 'ATAKORTA', 'AMC': 'ATAKORTA', 'AMR': 'ATAKORTA',
  'KFL': 'FORVET', 'GF': 'FORVET', 'KFR': 'FORVET', 'ST': 'FORVET',
};

export const POSITION_TO_COL: Record<SlotPosition, PitchCol> = {
  'GK': 'ORTA',
  'DL': 'SOL', 'DC': 'ORTA', 'DR': 'SAG',
  'WBL': 'SOL', 'DMC': 'ORTA', 'WBR': 'SAG',
  'ML': 'SOL', 'MC': 'ORTA', 'MR': 'SAG',
  'AML': 'SOL', 'AMC': 'ORTA', 'AMR': 'SAG',
  'KFL': 'SOL', 'GF': 'ORTA', 'KFR': 'SAG', 'ST': 'ORTA',
};

export function rowNameToIndex(row: PitchRow): number {
  return ROW_NAMES.indexOf(row);
}

export function colNameToIndex(col: PitchCol): number {
  return COL_NAMES.indexOf(col);
}

// ═══════════════════════════════════════════════
// BOŞ BÖLGE OLUŞTUR
// ═══════════════════════════════════════════════

export function createEmptyZones(): PitchZone[] {
  const zones: PitchZone[] = [];

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const suggested = SUGGESTED_POSITIONS[row]?.[col];
      if (!suggested) continue; // GK satırında sadece orta var

      zones.push({
        id: `r${row}_c${col}`,
        row,
        col,
        rowName: ROW_NAMES[row],
        colName: COL_NAMES[col],
        suggestedPosition: suggested,
        playerId: null,
      });
    }
  }

  return zones;
}

// ═══════════════════════════════════════════════
// OTOMATİK YERLEŞTİRME
// ═══════════════════════════════════════════════

/**
 * Belirli bir formasyona göre otomatik olarak oyuncuları bölgelere yerleştirir.
 */
export function getFormationZoneMapping(
  formation: string
): { row: number; col: number }[] {
  // Formasyona göre 11 bölge koordinatı
  switch (formation) {
    case '4-4-2':
      return [
        { row: 5, col: 1 }, // GK
        { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 1 }, { row: 4, col: 2 }, // DEF
        { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }, // MID
        { row: 0, col: 0 }, { row: 0, col: 2 }, // ST
      ];
    case '4-3-3':
      return [
        { row: 5, col: 1 },
        { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 1 }, { row: 4, col: 2 },
        { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
        { row: 1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 2 },
      ];
    case '3-5-2':
      return [
        { row: 5, col: 1 },
        { row: 4, col: 1 }, { row: 4, col: 1 }, { row: 4, col: 1 },
        { row: 3, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 2 },
        { row: 0, col: 0 }, { row: 0, col: 2 },
      ];
    case '4-2-3-1':
      return [
        { row: 5, col: 1 },
        { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 1 }, { row: 4, col: 2 },
        { row: 3, col: 1 }, { row: 3, col: 1 },
        { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
        { row: 0, col: 1 },
      ];
    default:
      return [];
  }
}

/**
 * Otomatik yerleştirme için bölgeleri döndürür.
 * Belirtilen satır/sütun kombinasyonuna en yakın boş bölgeyi bulur.
 */
export function findZoneByPosition(
  zones: PitchZone[],
  row: number,
  col: number,
  usedIds: Set<string>
): PitchZone | null {
  // Önce tam eşleşme
  const exact = zones.find(
    z => z.row === row && z.col === col && !usedIds.has(z.id)
  );
  if (exact) return exact;

  // Yoksa aynı satırda başka sütun
  const sameRow = zones.find(
    z => z.row === row && !usedIds.has(z.id)
  );
  if (sameRow) return sameRow;

  // Yoksa yakın satır
  for (let offset = 1; offset < 6; offset++) {
    const upRow = row - offset;
    const downRow = row + offset;
    const up = zones.find(z => z.row === upRow && !usedIds.has(z.id));
    if (up) return up;
    const down = zones.find(z => z.row === downRow && !usedIds.has(z.id));
    if (down) return down;
  }

  return null;
}