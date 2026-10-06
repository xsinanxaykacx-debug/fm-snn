# Live-v2 Status

## Son güncelleme
2026-10-06 — F3.1 tamamlandı; motor prensipleri kalıcılaştırıldı.

## Repo / Branch / PR
- Repo: xsinanxaykacx-debug/fm-snn
- Aktif branch: main
- Son F3.1 merge: PR #62
- F3.1 merge SHA: 02973af601b345e98a38755fc66f4641bdbb6115
- Post-merge main CI: #832 GREEN (kullanıcı web doğrulaması)
- Motor prensipleri: `docs/live-v2/PRINCIPLES.md`

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
- [x] F3.1: Realtime tick scheduling — PR #61 / CI #828 / post-merge #829
- [ ] F: 11v11 runtime acceptance
- [ ] G: realism calibration

## F3.1
**TAMAMLANDI —** 5400 tick gerçek zamanlı scheduler ile 90 saniyede çalışır.

## Prensipler
Motor prensipleri için `docs/live-v2/PRINCIPLES.md`'ye bak. Bu dosya motorun anayasasıdır.

## Test durumu
- F3.1 kapanışı: 211/211 GREEN
- F3.1 PR CI: #828 GREEN
- F3.1 post-merge main CI: #829 GREEN
- PR #62 dokümantasyon CI: #831 GREEN
- PR #62 post-merge main CI: #832 GREEN (kullanıcı web doğrulaması)

## Pipeline (gerçek)
restart → ball physics → boundary → perceive → decide → action → movement → possession

## Bilinen sorunlar
- **Genel Güç düşüşü:** sezon 1 H1 59.7 → H11 26.3 → sezon 2 H1 26.0
- F3.2 ve sonraki v2 katmanları sonraki turlarda ele alınacak.

## Değişmez referans
- Tüm kalıcı motor prensipleri: `docs/live-v2/PRINCIPLES.md`
- Legacy `src/engine/live/*` dokunulmaz.
