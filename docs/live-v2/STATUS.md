# Live-v2 Status

## Son güncelleme
2026-10-06 — Tur 16 (E6 tamamlandı, E adımı kapandı)

## Repo / Branch / PR
- Repo: xsinanxaykacx-debug/fm-snn
- Aktif branch: live-v2-foundation
- HEAD: 0637fd0d687edf8ecc7633130ea69404be3092af
- Son GREEN CI: #790 (push, live-v2-foundation)
- E6 PR: #50 (merged)
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
- [x] E6: Simulation determinism acceptance — CI #789/#790
- [ ] F: 11v11 runtime acceptance
- [ ] G: realism calibration

## E adımı
**TAMAMLANDI — E1–E6 tamamlandı.**

## Şu anki adım
Genel Güç turu — ayrı branch, ayrı oturum. F/G sonraya bırakıldı.

## Test durumu
- 175/175
- 44 test dosyası
- CI #789: 175/175 GREEN
- CI #790: 175/175 GREEN
- 5400 tick determinism testi CI içinde çalıştı; run #789 toplam test süresi 135.79s, run #790 toplam test süresi 132.58s.
- Yerel test: HAYIR — bu çalışma ortamında repo checkout/network erişimi olmadığı için local doğrulama yapılamadı.

## E6 acceptance invariant'ları
1. 1 tick: aynı seed + aynı input → tam aynı MatchState
2. 100 tick: aynı seed + aynı input → tam aynı MatchState
3. 1000 tick: aynı seed + aynı input → tam aynı MatchState
4. 5400 tick: aynı seed + aynı input → tam aynı MatchState
5. RNG tüketilen koşulda farklı seed → farklı final state mümkün
6. Aynı seed ile N tick sonunda seed progression deterministik

## Pipeline (gerçek)
restart → ball physics → boundary → perceive → decide → action → movement → possession

## Bilinen sorunlar
- **Genel Güç düşüşü:** sezon 1 H1 59.7 → H11 26.3 → sezon 2 H1 26.0
- Artık öncelikli çalışma konusu.
- F/G sonraya bırakıldı.

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
