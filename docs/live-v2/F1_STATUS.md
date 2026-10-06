# F1 — live-v2 22 oyuncu foundation

## Branch
- F1 branch: feat/live-v2-22-player-foundation
- Base: main
- Foundation merge PR: #57
- Foundation merge SHA: 97e4fa74b7d2598c9e7cd7212762793ee932d405
- F1 branch update merge PR: #58
- F1 branch update merge SHA: 59e34365d66ee943825b9fd43316936b067d0436
- F1 PR: #56
- F1 merge SHA: 0a1a9deb33ee848db8c22f242954fbfe9d324160

## Kapsam
- 22 oyuncu (11 HOME + 11 AWAY)
- Test: simulation22.test.ts
- F1 acceptance: 10 test
- Determinizm: 5400 tick
- Performans: 22 oyuncu 5400 tick = 396.29 ms; 2 oyuncu = 57.53 ms; oran = 6.89x

## Sonuç
- 22 oyuncu çalışıyor mu: ✅
- Determinizm: ✅
- 100 tick: ✅
- 900 tick (15 dk): ✅
- 5400 tick (90 dk): ✅
- Player count invariant: ✅
- NaN/Infinity: ✅
- Out-of-bounds: ✅
- Performans >30 sn: ❌ (ölçüm 0.396 sn)
- F1 acceptance CI #817: GREEN
- live-v2 testleri: 185 passed (175 foundation + 10 F1)
- Proje toplamı: 190 passed

## CI
- #812 GREEN — F1 test commit
- #813 GREEN — F1_STATUS initial documentation commit
- #814 GREEN — live-v2-foundation validation before merge
- #816 FAIL — F1 branch after foundation merge; 7 failures in simulation22.test.ts because the F1 fixture still used the old numeric seed shape while foundation expects RngState { seed: number }. All 183 other tests passed.
- #817 GREEN — fixture contract fix; 190/190 tests passed.

## F1.1 Merge
- PR #57: live-v2-foundation → main, normal merge
- Merge SHA: 97e4fa74b7d2598c9e7cd7212762793ee932d405
- PR #58: main → F1 branch, merge-equivalent rebase/update
- Merge SHA: 59e34365d66ee943825b9fd43316936b067d0436
- PR #56: F1 → main, normal merge
- Merge SHA: 0a1a9deb33ee848db8c22f242954fbfe9d324160

## İlke
- Legacy'den hiçbir şey alınmadı.
- src/engine/live/* değiştirilmedi.
- UI değiştirilmedi.
- Math.random() kullanılmadı.
- Testler gevşetilmedi.
- F1 fixture düzeltmesi yalnızca v2'nin güncel RNG state sözleşmesine uyum sağladı.

## Durum
- F1: TAMAMLANDI
- F2: HAZIR — ancak bu doküman commit'inin CI'si de GREEN olarak doğrulanacak.
