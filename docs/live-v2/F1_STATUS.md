# F1 — live-v2 22 oyuncu foundation

## Branch
- Branch: feat/live-v2-22-player-foundation
- Base: main
- HEAD: 522809570d9a8b13549000be64fdfa924d3574b5
- Son GREEN CI: #812

## Kapsam
- 22 oyuncu (11 HOME + 11 AWAY)
- Test: simulation22.test.ts
- Test sayısı: 10
- Determinizm: 5400 tick
- Performans: 22 oyuncu 5400 tick = 579.48 ms; 2 oyuncu = 66.56 ms; oran = 8.71x

## Sonuç
- 22 oyuncu çalışıyor mu: ✅
- Determinizm: ✅
- 100 tick: ✅
- 900 tick (15 dk): ✅
- 5400 tick (90 dk): ✅
- Player count invariant: ✅
- NaN/Infinity: ✅
- Out-of-bounds: ✅
- Performans >30 sn: ❌ (ölçüm 0.579 sn)
- PR CI #812: GREEN
- CI toplam test: 154 passed
- Bu main baseline'ında live-v2 testleri: 104 passed

## Baseline uyumsuzluğu
F1 talimatında mevcut v2 test tabanı 175 olarak belirtilmişti. GitHub üzerinde F1 branch'i main'den açıldığında gerçek main baseline'ı CI #812 ile 154 toplam test / 104 live-v2 testi olarak doğrulandı.

175 testlik güncel v2 foundation ayrı bir live-v2-foundation branch'inde bulunuyor ve main ile diverged durumda. F1 kapsamını sessizce bu branch'e taşımadık; main'den başlama kuralı korundu.

Bu nedenle 22 oyuncu acceptance'ı kanıtlandı, ancak “175 v2 testi korunuyor” kabul kriteri mevcut main üzerinde doğrulanamadı.

## İlke
- Legacy'den hiçbir şey alınmadı.
- src/engine/live/* değiştirilmedi.
- UI değiştirilmedi.
- Math.random() kullanılmadı.
- Testler gevşetilmedi.
- Tüm F1 kodu v2 alanında sıfırdan test fixture/acceptance olarak yazıldı.

## Sıradaki
- F2: v2 → UI frame adapter
- Önkoşul: 175-test baseline uyumsuzluğu çözülmeli ve F1 merge/post-merge CI GREEN doğrulanmalı.
