# Live-v2 — Sıradaki Adım

> Bu dosya sadece bir sonraki adımı anlatır.
> Her adım tamamlandığında yeniden yazılır.

## Sıradaki: E — RNG Entegrasyonu

### Ne yapılacak

v2 karar ve action-resolution katmanındaki gelecekteki rastgele seçimler
`Math.random()` kullanmadan, `MatchState.seed` üzerinden deterministik RNG
ile çözülecek.

Mevcut `rng.ts` seeded LCG olarak hazır; henüz decision/action katmanına
bağlı değil.

### Neden

- Aynı seed + aynı input = aynı output korunmalı.
- Rastgele seçimler merkezi ve tekrar üretilebilir olmalı.
- Testlerde maç davranışı deterministik olarak yeniden üretilebilmeli.
- Legacy `src/engine/live/*` ile hiçbir bağımlılık kurulmayacak.

### Nerede

- `src/engine/live-v2/rng.ts`
- `src/engine/live-v2/decision.ts`
- `src/engine/live-v2/actionResolution.ts`

### API

Mevcut RNG API:

```ts
export type RngState = { seed: number };

export function nextRandom(
  state: RngState,
): [number, RngState];

export function randomSequence(
  state: RngState,
  count: number,
): [number[], RngState];
```

Entegrasyon, `state.seed` değerini başlangıç RNG durumu olarak kullanmalı ve
üretilen yeni seed'i immutable biçimde state'e taşımalı veya karar/action
katmanının açık çıktısında deterministik olarak tüketmelidir. API değişikliği
gerekirse önce test ile sözleşme netleştirilmeli.

### Test

Yeni/ek testler en az şunları kanıtlamalı:

- aynı seed + aynı state → aynı decision sonucu
- aynı seed + aynı action input → aynı action sonucu
- farklı seed → RNG kullanan seçimlerde farklı sonuç üretebilir
- input state mutasyona uğramaz
- `Math.random()` kullanılmaz
- RNG ilerlemesi deterministik ve tekrar üretilebilirdir

### Kısıtlar

- Legacy `src/engine/live/*` DOKUNMA.
- Her modül saf, immutable, deterministik.
- `Math.random()` YASAK.
- 90 dakika = 5400 tick.
- Aynı seed + aynı input = aynı output.
- Test yazmadan kod yazılmaz.
- CI yeşil değilse E tamamlandı denmez.

### Bitince

- `npx vitest run src/engine/live-v2/` → hepsi geçmeli
- `npx tsc --noEmit` → temiz
- CI yeşil olmalı
- STATUS.md güncellenmeli
- Sonraki adım F — 11v11 runtime acceptance olmalı
