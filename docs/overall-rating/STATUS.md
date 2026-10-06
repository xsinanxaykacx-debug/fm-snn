# Overall Rating Decay — Status

## Son güncelleme
2026-10-06 — Tur G2 (UI doğrulaması + kondisyon reset fix)

## Repo / Branch / PR
- Branch: fix/overall-rating-decay
- Base: main
- HEAD: 46a56dd55ecc06cd51a79e4993ccfce08aac8c8c
- Son GREEN CI: #796

## Sorun
- S1 H1: Genel Güç 59.7
- S1 H11: Genel Güç 26.3
- S2 H1: Genel Güç 26.0 (düzelmiyor)

## Kök neden (G1)
- ANA: advanceSeason() condition resetlemiyor
- YAN: age += 1 + attribute progression

## UI doğrulaması (G2)
- Squad.tsx Form/Kond/Moral kolonları doğrudan player.form, player.condition, player.morale değerlerini render ediyor.
- UI tarafında 100'e ölçekleme, yuvarlama veya farklı bir alan tespit edilmedi.
- generateData.ts yeni oyuncuları condition=100, form=40–80, morale=50–90 ile başlatıyor.
- Sonuç: "S1 H1 Form=100, Moral=100" gözlemi mevcut kaynak kodla doğrulanamıyor; UI gösteriminde ayrı bir dönüşüm bulunamadı.

## Fix (G2)
- advanceSeason() içinde condition = 100 eklendi.
- Form/moral dokunulmadı (ayrı tasarım kararı).
- src/engine/live-v2/* değiştirilmedi.

## Test durumu
- Base main: 40 test files / 139 tests — GREEN (#793)
- G2 regression: 41 test files / 144 tests — GREEN (#796)
- Yeni regression testleri: 5
  - condition reset
  - form taşınması
  - moral taşınması
  - yaş/gelişim/sezon istatistikleri regresyonu
  - düşük kondisyonlu takımın Genel Güç toparlanması

## Sıradaki
- G3: Form/moral reset tasarım kararı (opsiyonel)
- UI gösterim çelişkisi: kaynak kod açısından çözüldü; 100 gözlemi için ayrı runtime/UI incelemesi gerekirse bağımsız tur açılabilir.
