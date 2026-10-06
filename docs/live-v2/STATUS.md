# Live-v2 Status

## Son güncelleme
2026-10-06 — Tur 15a (E4 tamamlandı, E5 bekliyor)

## Repo / Branch / PR
- Repo: xsinanxaykacx-debug/fm-snn
- Aktif branch: live-v2-foundation
- HEAD: 2bc4d3ad58d68359107e0fbe20b0c8e7df6f2434
- Son GREEN CI: #781 (push, live-v2-foundation)
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
- [ ] E5: DRIBBLE RNG
- [ ] E6: Simulation determinism acceptance
- [ ] F: 11v11 runtime acceptance
- [ ] G: realism calibration

## Şu anki adım
E5 bekliyor — DRIBBLE RNG, test-first.

## Test durumu
- 160/160 (E4 sonrası)
- 43 test dosyası

## Pipeline (gerçek)
restart → ball physics → boundary → perceive → decide → action → movement → possession

## Bilinen sorunlar
- Genel Güç düşüşü: sezon 1 H1 59.7 → H11 26.3 → sezon 2 H1 26.0
- E6 sonrası ayrı tur olarak ele alınacak

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
