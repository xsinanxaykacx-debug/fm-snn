# Overall Rating Decay — Handoff

## Yeni oturum başlangıcı — okuma sırası
1. Bu dosya
2. docs/overall-rating/STATUS.md
3. Son tur raporu

## Tur geçmişi

### G1 — Tanı
- Tarih: 2026-10-06
- Konu: Genel Güç formülü + sezon geçişi analizi
- Sonuç: ✅ TAMAMLANDI
- Kök neden: advanceSeason() condition resetlemiyor
- Hipotezler: A elendi, B kanıtlandı (ana), C yan etki

### G2 — UI doğrulaması + fix
- Tarih: 2026-10-06
- Konu: UI gösterim doğrulaması + condition = 100 fix
- Sonuç: ✅ TAMAMLANDI
- CI: #796 GREEN — 41 test files / 144 tests
- Commit: 46a56dd55ecc06cd51a79e4993ccfce08aac8c8c
- Açık noktalar:
  - Form/moral reset tasarım kararı yapılmadı.
  - UI kaynak kodunda Form/Kond/Moral doğrudan player alanlarından geliyor; 100'e dönüşüm bulunmadı. Kullanıcının 100 gözlemi kaynak kodla doğrulanamıyor.
  - G2 testlerinde form/moral taşınması özellikle korunuyor.
- Sıradaki: G3 (opsiyonel form/moral tasarım kararı) veya ayrı UI runtime incelemesi

## G2 kanıt özeti
- src/components/Squad.tsx Form/Kond/Moral hücreleri: p.form / p.condition / p.morale
- src/store/gameStore.ts advanceSeason(): p.condition = 100
- Form ve moral için reset eklenmedi.
- src/engine/live-v2/* dokunulmadı.

## Açık noktalar
- Form/moral reset tasarım kararı (G3?)
- UI 100 gözlemi için gerekirse ayrı runtime/UI incelemesi

## Karar kuralları (bu branch için)
- live-v2-foundation dokunulmaz
- src/engine/live-v2/* dokunulmaz
- Math.random() yeni kodda kullanılmaz
- Test gevşetme yasak
- CI GREEN olmadan sonraki tura geçme
- STATUS.md ve HANDOFF.md bu branch için docs/overall-rating/ altında tutulur
