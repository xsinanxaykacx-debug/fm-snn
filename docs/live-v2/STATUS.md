# Live-v2 Status

## Son güncelleme
2026-10-06 — Tur 15b (E5 tamamlandı, E6 bekliyor)

## Repo / Branch / PR
- Repo: xsinanxaykacx-debug/fm-snn
- Aktif branch: live-v2-foundation
- HEAD: d6242bfdc28f9ed2b67511880cf3912fe1b69aeb
- Son GREEN CI: #786 (push, live-v2-foundation)
- E5 PR: #49 (merged)
- main: ded6ed03249b478bac2d247d19d841b99c1af475 (dokunulmuyor)

## Tamamlanan adımlar
- [x] A: perceive/decide — CI #706
- [x] B: decision→movement — CI #707
- [x] C: possession — CI #710
- [x] D: action resolution — CI #716
- [x] E1: RNG temel kontratı — CI #751
- [x] E2: RNG→MatchState — CI #760
- [x] E3: decision.ts RNG — CI #770/#771
- [x] E4: actionResolution PASS/SHOOT RNG — CI #780/#781
- [x] E5: DRIBBLE RNG — CI #785/#786
- [ ] E6: Simulation determinism acceptance
- [ ] F: 11v11 runtime acceptance
- [ ] G: realism calibration

## Şu anki adım
E6 bekliyor — Simulation determinism acceptance.

## Test durumu
- 169/169
- 43 test dosyası
- CI #785: 169/169 GREEN
- CI #786: 169/169 GREEN
- Yerel test: HAYIR — bu çalışma ortamında repo checkout/network erişimi yok; yerel doğrulama yapılamadı.

## Pipeline (gerçek)
restart → ball physics → boundary → perceive → decide → action → movement → possession

## Bilinen sorunlar
- Genel Güç düşüşü: sezon 1 H1 59.7 → H11 26.3 → sezon 2 H1 26.0
- E6 sonrası ayrı tur olarak ele alınacak

## E5 kararı
- DRIBBLE RNG kontrol sonucuna bağlandı; geometri RNG'den etkilenmiyor.
- İlk sürüm retain/lose oranı sabit %50.
- Gerekçe: E5'in amacı RNG kontratını ve deterministik state progression'ı izole etmek; oyuncu özellikleriyle olasılık ağırlığı eklemek G/kalibrasyon kapsamına bırakıldı.
- Gerçekten çözülen DRIBBLE tam 1 RNG tüketiyor.
- Geçersiz/çözülemeyen DRIBBLE RNG tüketmiyor.
- Lose sonucunda ownerId null; lastTouchId/lastTouchSide korunuyor ve top mevcut dribble geometrisi/velocity ile loose-ball state'e geçiyor.
- CHASE RNG tüketmiyor; PASS/SHOOT RNG davranışı korunuyor.
- Math.random() kullanılmıyor.

## Değişmez kurallar
1. Legacy src/engine/live/* dokunulmaz
2. Saf, immutable, deterministik
3. Math.random() yasak — sadece state.seed
4. 5400 tick = 90 dakika
5. Aynı seed + aynı input = aynı output
6. Test yazmadan kod yazılmaz
7. Local test çalıştırılmadan "geçti" denmez
8. CI yeşil değilse "tamamlandı" denmez
9. Her CI run'ı raporlanır (sadece sonuncusu değil)
10. Test gevşetme yasak
11. Deneme-yanılma commit yasak
12. "Assume passes" yasak
13. Her turda STATUS.md güncellenir (ayrı commit)
14. Her turda HANDOFF.md güncellenir (ayrı commit)
