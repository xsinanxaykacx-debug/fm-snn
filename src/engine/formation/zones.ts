// src/engine/formation/zones.ts

import type { PitchZone, SlotPosition, PitchRow, PitchCol } from '../types';

// ═══════════════════════════════════════════════
// 7 SATIR × 5 SÜTUN = 33 BÖLGE (GK tek ortada)
// ═══════════════════════════════════════════════

// Satır 0 = ST (en ileri), Satır 6 = GK (en geri)
// Sütun 0 = SOL, 1 = SOLORTA, 2 = ORTA, 3 = SAGORTA, 4 = SAG

export const ROW_NAMES: PitchRow[] = [
  'ST',
  'FORVET',
  'ATAKORTA',
  'ORTA',
  'DEFANSIFORTA',
  'DEFANS',
  'GK',
];

export const COL_NAMES: PitchCol[] = ['SOL', 'SOLORTA', 'ORTA', 'SAGORTA', 'SAG'];

// Her bölgenin önerilen pozisyonu
// [satır][sütun] = pozisyon
const SUGGESTED_POSITIONS: Record<number, Record<number, SlotPosition>> = {
  // Satır 0: ST (en ileri)
  0: {
    0: 'ST',
    1: 'ST',
    2: 'ST',
    3: 'ST',
    4: 'ST',
  },
  // Satır 1: FORVET
  1: {
    0: 'KFL',
    1: 'GF',
    2: 'GF',
    3: 'GF',
    4: 'KFR',
  },
  // Satır 2: ATAKORTA
  2: {
    0: 'AML',
    1: 'AMC',
    2: 'AMC',
    3: 'AMC',
    4: 'AMR',
  },
  // Satır 3: ORTA SAHA
  3: {
    0: 'ML',
    1: 'MC',
    2: 'MC',
    3: 'MC',
    4: 'MR',
  },
  // Satır 4: DEFANSİF ORTA
  4: {
    0: 'WBL',
    1: 'DMC',
    2: 'DMC',
    3: 'DMC',
    4: 'WBR',
  },
  // Satır 5: DEFANS
  5: {
    0: 'DL',
    1: 'DC',
    2: 'DC',
    3: 'DC',
    4: 'DR',
  },
  // Satır 6: GK (tek, ortada)
  6: {
    2: 'GK', // ORTA sütun
  },
};

// Pozisyonun hangi satır/sütuna ait olduğunu gösteren harita
export const POSITION_TO_ROW: Record<SlotPosition, PitchRow> = {
  'GK': 'GK',
  'DL': 'DEFANS', 'DC': 'DEFANS', 'DR': 'DEFANS',
  'WBL': 'DEFANSIFORTA', 'DMC': 'DEFANSIFORTA', 'WBR': 'DEFANSIFORTA',
  'ML': 'ORTA', 'MC': 'ORTA', 'MR': 'ORTA',
  'AML': 'ATAKORTA', 'AMC': 'ATAKORTA', 'AMR': 'ATAKORTA',
  'KFL': 'FORVET', 'GF': 'FORVET', 'KFR': 'FORVET',
  'ST': 'ST',
};

export const POSITION_TO_COL: Record<SlotPosition, PitchCol> = {
  'GK': 'ORTA',
  'DL': 'SOL', 'DC': 'SOLORTA', 'DR': 'SAG',
  'WBL': 'SOL', 'DMC': 'SOLORTA', 'WBR': 'SAG',
  'ML': 'SOL', 'MC': 'SOLORTA', 'MR': 'SAG',
  'AML': 'SOL', 'AMC': 'SOLORTA', 'AMR': 'SAG',
  'KFL': 'SOL', 'GF': 'SOLORTA', 'KFR': 'SAG',
  'ST': 'ORTA',
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

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      const suggested = SUGGESTED_POSITIONS[row]?.[col];
      if (!suggested) continue;

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
 * Belirli bir formasyona göre 11 bölge koordinatı döndürür.
 * 7 satır × 5 sütun sistemine göre:
 *  Row 0 = ST, 1 = FORVET, 2 = ATAKORTA, 3 = ORTA, 4 = DEFANSIF, 5 = DEFANS, 6 = GK
 *  Col 0 = SOL, 1 = SOLORTA, 2 = ORTA, 3 = SAGORTA, 4 = SAG
 */
export function getFormationZoneMapping(
  formation: string
): { row: number; col: number }[] {
  switch (formation) {
    case '4-4-2':
      return [
        { row: 6, col: 2 }, // GK (orta)
        // DEFANS (4)
        { row: 5, col: 0 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 4 },
        // ORTA SAHA (4)
        { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 3 }, { row: 3, col: 4 },
        // FORVET (2)
        { row: 1, col: 1 }, { row: 1, col: 3 },
      ];
    case '4-3-3':
      return [
        { row: 6, col: 2 }, // GK
        // DEFANS (4)
        { row: 5, col: 0 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 4 },
        // ORTA SAHA (3)
        { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
        // HÜCUM (3)
        { row: 2, col: 0 }, { row: 0, col: 2 }, { row: 2, col: 4 },
      ];
    case '3-5-2':
      return [
        { row: 6, col: 2 }, // GK
        // DEFANS (3 DC)
        { row: 5, col: 1 }, { row: 5, col: 2 }, { row: 5, col: 3 },
        // KANAT BEK (2) + ORTA (3)
        { row: 4, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 4, col: 4 },
        // FORVET (2)
        { row: 1, col: 1 }, { row: 1, col: 3 },
      ];
    case '4-2-3-1':
      return [
        { row: 6, col: 2 }, // GK
        // DEFANS (4)
        { row: 5, col: 0 }, { row: 5, col: 1 }, { row: 5, col: 3 }, { row: 5, col: 4 },
        // DEFANSİF ORTA (2)
        { row: 4, col: 1 }, { row: 4, col: 3 },
        // ATAK ORTA (3)
        { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
        // ST (1)
        { row: 0, col: 2 },
      ];
    default:
      return [];
  }
}

/**
 * Belirtilen satır/sütuna en yakın boş bölgeyi bulur.
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

  // Aynı satırda başka sütun
  const sameRow = zones.find(
    z => z.row === row && !usedIds.has(z.id)
  );
  if (sameRow) return sameRow;

  // Yakın satır
  for (let offset = 1; offset < 7; offset++) {
    const upRow = row - offset;
    const downRow = row + offset;
    const up = zones.find(z => z.row === upRow && !usedIds.has(z.id));
    if (up) return up;
    const down = zones.find(z => z.row === downRow && !usedIds.has(z.id));
    if (down) return down;
  }

  return null;
}