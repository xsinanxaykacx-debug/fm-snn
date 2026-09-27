import type { Player } from '../types';

export function developPlayers(players: Record<string, Player>): Record<string, Player> {
  const updated = { ...players };
  for (const id in updated) {
    const p = { ...updated[id] };
    const a = { ...p.attributes };

    // Genç oyuncular gelişir, yaşlılar düşer
    const ageFactor = p.age < 24 ? 1.5 : p.age < 28 ? 0.5 : p.age < 31 ? -0.3 : -1.0;
    const potential = p.age < 24 ? 1 : 0.3;

    const keys: (keyof typeof a)[] = ['pace', 'passing', 'shooting', 'defending', 'physical', 'mental', 'goalkeeping'];
    for (const k of keys) {
      if (Math.random() < 0.35 * potential) {
        a[k] = Math.max(1, Math.min(20, a[k] + (Math.random() < 0.5 ? 1 : 0) * Math.sign(ageFactor)));
      }
    }
    p.attributes = a;

    // Yaşlanma
    p.age++;
    p.value = Math.round(
      ((a.pace + a.passing + a.shooting + a.defending + a.physical + a.mental + a.goalkeeping) / 7) ** 2
      * 50_000
      * Math.max(0.3, (30 - p.age) / 10)
    );

    // Kondisyon ve moral sıfırla
    p.condition = 100;
    p.form = Math.max(30, Math.min(100, p.form + Math.round((Math.random() - 0.4) * 15)));
    p.morale = Math.max(30, Math.min(100, p.morale + Math.round((Math.random() - 0.4) * 10)));

    updated[id] = p;
  }
  return updated;
}