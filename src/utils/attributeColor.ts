// src/utils/attributeColor.ts

/**
 * FM tarzı attribute renkleri (1-20)
 * 1-5:   🔴 Kırmızı (Kötü)
 * 6-9:   🟠 Turuncu (Zayıf)
 * 10-13: 🟡 Sarı (Orta)
 * 14-17: 🟢 Yeşil (İyi)
 * 18-20: 🔵 Cyan (Dünya Klası)
 */
export function getAttrColor(value: number): string {
  if (value <= 5) return 'text-red-400';
  if (value <= 9) return 'text-orange-400';
  if (value <= 13) return 'text-yellow-400';
  if (value <= 17) return 'text-green-400';
  return 'text-cyan-400';
}

/**
 * FM tarzı bg + text kombinasyonu
 */
export function getAttrBadgeStyle(value: number): string {
  if (value <= 5) return 'bg-red-500/20 text-red-400 border-red-500/40';
  if (value <= 9) return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
  if (value <= 13) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  if (value <= 17) return 'bg-green-500/20 text-green-400 border-green-500/40';
  return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
}

/**
 * FM tarzı bar rengi (Tailwind bg-)
 */
export function getAttrBarColor(value: number): string {
  if (value <= 5) return 'bg-red-500';
  if (value <= 9) return 'bg-orange-500';
  if (value <= 13) return 'bg-yellow-500';
  if (value <= 17) return 'bg-green-500';
  return 'bg-cyan-500';
}

/**
 * FM tarzı hex renk (radar grafiği için)
 */
export function getAttrHex(value: number): string {
  if (value <= 5) return '#ef4444';    // red
  if (value <= 9) return '#f97316';    // orange
  if (value <= 13) return '#eab308';   // yellow
  if (value <= 17) return '#22c55e';   // green
  return '#06b6d4';                    // cyan
}

/**
 * Genel reyting (1-20) için özel renkler
 * Biraz farklı — çünkü genel reyting daha önemli
 */
export function getOverallColor(rating: number): string {
  if (rating <= 7) return 'text-red-400';
  if (rating <= 11) return 'text-orange-400';
  if (rating <= 14) return 'text-yellow-400';
  if (rating <= 17) return 'text-green-400';
  return 'text-cyan-400';
}

/**
 * Genel reyting badge stili
 */
export function getOverallBadgeStyle(rating: number): string {
  if (rating <= 7) return 'bg-red-500/20 text-red-400 border-red-500/40';
  if (rating <= 11) return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
  if (rating <= 14) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  if (rating <= 17) return 'bg-green-500/20 text-green-400 border-green-500/40';
  return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
}