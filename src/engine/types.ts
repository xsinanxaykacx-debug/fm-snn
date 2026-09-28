export type Position = 'GK' | 'DC' | 'DL' | 'DR' | 'DM' | 'MC' | 'ML' | 'MR' | 'AMC' | 'AML' | 'AMR' | 'ST';

// ═══════════════════════════════════════════════
// 30 OYUNCU ÖZELLİĞİ
// ═══════════════════════════════════════════════
export interface Attributes {
  // TEKNİK (9)
  passing: number;         // Pas
  firstTouch: number;      // İlk Kontrol
  dribbling: number;       // Dripling
  crossing: number;        // Orta
  shooting: number;        // Şut
  finishing: number;       // Bitiricilik
  technique: number;       // Teknik
  heading: number;         // Kafa
  setPieces: number;       // Duran Top

  // ZİHİNSEL (10)
  decisions: number;       // Karar
  vision: number;          // Vizyon
  anticipation: number;    // Sezgi
  positioning: number;     // Pozisyon
  offTheBall: number;      // Topsuz Alan
  concentration: number;   // Konsantrasyon
  composure: number;       // Soğukkanlılık
  workRate: number;        // Çalışkanlık
  teamwork: number;        // Takım Oyunu
  bravery: number;         // Cesaret

  // FİZİKSEL (6)
  pace: number;            // Hız
  acceleration: number;    // İvme
  agility: number;         // Çeviklik
  stamina: number;         // Dayanıklılık
  strength: number;        // Güç
  balance: number;         // Denge

  // SAVUNMA (4)
  marking: number;         // Markaj
  tackling: number;        // Müdahale
  ballWinning: number;     // Top Kapma
  defensivePositioning: number; // Savunma Pozisyonu

  // KALECİ (5) — sadece GK için
  reflexes: number;        // Refleks
  gkPositioning: number;   // Kaleci Pozisyonu
  handling: number;        // Elle Kontrol
  oneOnOne: number;        // Bire Bir
  aerialReach: number;     // Hava Topu
}

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string;
  position: Position;
  attributes: Attributes;
  condition: number;       // 0-100
  morale: number;          // 0-100
  form: number;            // 0-100
  wage: number;
  value: number;
  clubId: string | null;
  injuryWeeks: number;
  injuryType: string | null;
  yellowCards: number;
  suspensionWeeks: number;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';

export interface Tactic {
  formation: Formation;
  mentality: 'defensive' | 'balanced' | 'attacking';
  pressing: 'low' | 'medium' | 'high';
  tempo: 'slow' | 'normal' | 'fast';
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  budget: number;
  wageBudget: number;
  stadiumCapacity: number;
  reputation: number;
  formation: Formation;
  tactic: Tactic;
  isUser: boolean;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'injury' | 'chance' | 'save' | 'miss';
  playerId?: string;
  clubId: string;
  description: string;
}

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  onTarget: { home: number; away: number };
  chances: { home: number; away: number };
}

export interface Match {
  id: string;
  week: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  stats: MatchStats;
  played: boolean;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export type TrainingFocus = 'attack' | 'defense' | 'physical' | 'tactical' | 'balanced';

export interface TrainingState {
  focus: TrainingFocus;
  intensity: 'light' | 'normal' | 'intense';
}

export interface GameState {
  season: number;
  currentWeek: number;
  userClubId: string;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Match[];
  table: Record<string, TableRow>;
  transferList: string[];
  news: string[];
  seasonOver: boolean;
  training: TrainingState;
}

// ═══════════════════════════════════════════════
// TAKIM BİRİMLERİ (6 boyut — Katman 3)
// ═══════════════════════════════════════════════
export interface TeamUnits {
  attack: number;       // Hücum gücü (0-100)
  midfield: number;     // Orta saha kontrolü (0-100)
  defense: number;      // Savunma sağlamlığı (0-100)
  wings: number;        // Kanat oyunu (0-100)
  transition: number;   // Geçiş/kontra hızı (0-100)
  goalkeeper: number;   // Kaleci kalitesi (0-100)
  overall: number;      // Genel ortalama
}

export interface UnitComparison {
  unit: string;
  icon: string;
  homeValue: number;
  awayValue: number;
  advantagePct: number;  // 0-100 (50 = eşit)
  favored: 'home' | 'away' | 'neutral';
}