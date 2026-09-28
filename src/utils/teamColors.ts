// src/utils/teamColors.ts

/**
 * Takım renkleri — her kulüp ID'sine göre tutarlı renk atar.
 * Aynı kulüp her zaman aynı rengi alır.
 */

export interface TeamColor {
  bg: string;      // Ana renk (hex)
  fg: string;      // Yazı rengi (okunabilirlik için)
  light: string;   // Açık ton (arka plan için)
  border: string;  // Border rengi
  name: string;    // Renk adı (debug için)
}

const PALETTE: TeamColor[] = [
  { bg: '#ef4444', fg: '#ffffff', light: 'rgba(239,68,68,0.15)',  border: '#ef4444', name: 'red' },
  { bg: '#3b82f6', fg: '#ffffff', light: 'rgba(59,130,246,0.15)', border: '#3b82f6', name: 'blue' },
  { bg: '#22c55e', fg: '#ffffff', light: 'rgba(34,197,94,0.15)',  border: '#22c55e', name: 'green' },
  { bg: '#eab308', fg: '#000000', light: 'rgba(234,179,8,0.15)',  border: '#eab308', name: 'yellow' },
  { bg: '#a855f7', fg: '#ffffff', light: 'rgba(168,85,247,0.15)', border: '#a855f7', name: 'purple' },
  { bg: '#f97316', fg: '#ffffff', light: 'rgba(249,115,22,0.15)', border: '#f97316', name: 'orange' },
  { bg: '#06b6d4', fg: '#ffffff', light: 'rgba(6,182,212,0.15)',  border: '#06b6d4', name: 'cyan' },
  { bg: '#ec4899', fg: '#ffffff', light: 'rgba(236,72,153,0.15)', border: '#ec4899', name: 'pink' },
  { bg: '#14b8a6', fg: '#ffffff', light: 'rgba(20,184,166,0.15)', border: '#14b8a6', name: 'teal' },
  { bg: '#8b5cf6', fg: '#ffffff', light: 'rgba(139,92,246,0.15)', border: '#8b5cf6', name: 'violet' },
  { bg: '#f43f5e', fg: '#ffffff', light: 'rgba(244,63,94,0.15)',  border: '#f43f5e', name: 'rose' },
  { bg: '#84cc16', fg: '#000000', light: 'rgba(132,204,22,0.15)', border: '#84cc16', name: 'lime' },
  { bg: '#0ea5e9', fg: '#ffffff', light: 'rgba(14,165,233,0.15)', border: '#0ea5e9', name: 'sky' },
  { bg: '#d946ef', fg: '#ffffff', light: 'rgba(217,70,239,0.15)', border: '#d946ef', name: 'fuchsia' },
  { bg: '#f59e0b', fg: '#000000', light: 'rgba(245,158,11,0.15)', border: '#f59e0b', name: 'amber' },
  { bg: '#10b981', fg: '#ffffff', light: 'rgba(16,185,129,0.15)', border: '#10b981', name: 'emerald' },
];

/**
 * Kulüp ID'sinden tutarlı bir renk üretir.
 */
export function getTeamColor(clubId: string): TeamColor {
  if (!clubId) return PALETTE[0];

  let hash = 0;
  for (let i = 0; i < clubId.length; i++) {
    hash = clubId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // 32-bit integer
  }

  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

/**
 * Kısa isimden baş harfleri üretir (max 3 karakter).
 * "İstanbul FK" → "İST"
 * "Ankara" → "ANK"
 */
export function getTeamInitials(shortName: string): string {
  if (!shortName) return '???';
  return shortName.slice(0, 3).toUpperCase();
}

/**
 * Takım için arka plan stili (linear-gradient).
 */
export function getTeamGradient(clubId: string): string {
  const color = getTeamColor(clubId);
  return `linear-gradient(135deg, ${color.bg}20 0%, ${color.bg}05 100%)`;
}