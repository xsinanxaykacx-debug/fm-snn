# Live-v2 Handoff — Konuşma Geçmişi

> Bu dosya denetçi tarafından okunur ve doğrulanır.
> Ajan bu dosyayı her turda günceller. İçerik nötr olmalı, olgulara dayanmalı.

## Yeni sohbet başlangıcı — okuma sırası
1. Bu dosya (HANDOFF.md)
2. STATUS.md (güncel proje durumu)
3. Son tur raporu (tam metin)
4. Varsa ekran görüntüleri

## Şu anki durum
Tur 15a — dokümantasyon kurulumu. E4 TAMAMLANDI, E5 HAZIR.

## Tur geçmişi

### Tur 1 — BUG 1 + BUG 2 tespit
- **Tarih:** 2026-10-06
- **Konu:** Chase target lag + restart freeze regression testleri
- **Sonuç:** ❌ FAIL
- **CI:** #728, #729 FAIL
- **Açık noktalar:** Her iki bug da kırmızı

### Tur 2 — Pipeline doğrulama
- **Tarih:** 2026-10-06
- **Konu:** Pipeline sırası doğrulandı, STATUS.md pipeline farkı tespit edildi
- **Sonuç:** ❌ FAIL
- **CI:** #730–#736 FAIL
- **Açık noktalar:** BUG 1 non-finite kaynağı bilinmiyor, BUG 2 kök neden yok

### Tur 3 — Kök neden izolasyonu
- **Tarih:** 2026-10-06
- **Konu:** BUG 2 için kod yolu taraması (resolvePass → direction → {0,0})
- **Sonuç:** ⏸ Kod yok (deneme-yanılma commit yasak)
- **CI:** #737 FAIL
- **Açık noktalar:** Runtime kanıtı yok

### Tur 4 — Doğru test invariant hesabı
- **Tarih:** 2026-10-06
- **Konu:** Denetçinin önerdiği distance invariant'ının fixture ile çöktüğü kanıtlandı
- **Sonuç:** ⏸ Kod yok
- **CI:** —
- **Açık noktalar:** Doğru invariant henüz uygulanmadı

### Tur 5 — BUG 1 test düzeltmesi + BUG 2 diagnostics
- **Tarih:** 2026-10-06
- **Konu:** BUG 1 testi düzeltildi (e21e24d), diagnostics alanları eklendi (c80237e)
- **Sonuç:** ❌ FAIL
- **CI:** #739–#743 FAIL
- **Açık noktalar:** **Eksik rapor:** #739–#742 raporlanmadı (sonradan Tur 6'da düzeltildi)

### Tur 6 — Kök neden kanıt + fix
- **Tarih:** 2026-10-06
- **Konu:** BUG 1 testi GREEN, BUG 2 kök neden kanıtlandı (tick 287, stepBall, friction stopSpeed hard-zero)
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #747, #748 GREEN
- **Commit:** 46406b4, 39b37d4
- **Karar:** "Her CI run'ı raporlanır, sadece sonuncusu değil"

### Tur 7 — Merge sapması düzeltme
- **Tarih:** 2026-10-06
- **Konu:** PR #40 yanlış base'e (main) merge edilmişti. PR #41 ile foundation'a düzeltildi.
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #749 PASS (main)
- **Commit:** ff138d3 (foundation merge)

### Tur 8 — Foundation CI tetikleme
- **Tarih:** 2026-10-06
- **Konu:** workflow branch filtresinde live-v2-foundation yok. Ajan doğru şekilde workflow değiştirmeyi reddetti.
- **Sonuç:** ⏸ Kod yok (workflow eksik)

### Tur 9 — Workflow düzeltme
- **Tarih:** 2026-10-06
- **Konu:** Workflow'a live-v2-foundation + workflow_dispatch eklendi
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #750 GREEN
- **Commit:** bfdab116

### Tur 10 — E1 RNG temel kontratı
- **Tarih:** 2026-10-06
- **Konu:** rng.test.ts 6 test yazıldı
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #751 GREEN
- **Açık noktalar:** Eski test invariant kaybı tespit edildi (2 invariant düşmüş) — Tur 11'de düzeltildi

### Tur 11 — E2 RNG→MatchState
- **Tarih:** 2026-10-06
- **Konu:** state.seed: RngState, runTick seed taşıyor, tickSeed.test.ts
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #752 GREEN, #753–#755 FAIL, #758 GREEN, #760 GREEN
- **Commit:** 92212f7
- **Karar:** E1'de kaybolan 2 RNG test invariant'ı geri eklendi (0698fd0)

### Tur 12 — E3 decision RNG
- **Tarih:** 2026-10-06
- **Konu:** decision.ts PASS/SHOOT/DRIBBLE seçimine RNG, CHASE ve tie-break deterministik
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #762–#769 FAIL, #770 GREEN, #771 GREEN (merge sonrası)
- **Commit:** 462bfbd (merge PR #43)

### Tur 13 — E4 actionResolution PASS/SHOOT RNG
- **Tarih:** 2026-10-06
- **Konu:** PASS ve SHOOT'a RNG sapma, CHASE ve DRIBBLE deterministik
- **Sonuç:** 🟡 BEKLİYOR (post-merge CI kanıtı yoktu)
- **CI:** #772–#779 FAIL, #780 GREEN
- **Commit:** 2bc4d3a (merge PR #48)
- **Açık noktalar:** **Eksik rapor:** #773, #774, #776, #778, #779 raporlanmadı

### Tur 14 — Eksik rapor + post-merge CI
- **Tarih:** 2026-10-06
- **Konu:** Eksik 5 CI run raporlandı, post-merge CI #781 bulundu (push, success)
- **Sonuç:** ✅ TAMAMLANDI
- **CI:** #781 GREEN (push, foundation)
- **Açık noktalar:** STATUS.md ve HANDOFF.md raporlanmadı
- **Karar:** "Bundan sonra her Actions run numarası raporlanacak, PASS/FAIL/CANCELLED/SKIPPED/IN_PROGRESS ayrımı yapılmadan hiçbir run atlanmayacak"

### Tur 15a — STATUS.md + HANDOFF.md kurulumu
- **Tarih:** 2026-10-06
- **Konu:** STATUS.md güncellendi, HANDOFF.md oluşturuldu, yeni disiplin kuruldu
- **Sonuç:** ⏸ Dokümantasyon commitleri tamamlanıyor
- **CI:** Bu turdaki commitlerin tetiklediği run'lar ayrıca raporlanacak; sonuç varsayılmayacak
- **Commit:** STATUS d62250e8696cc02b1eba953dbf11f17e32211be3
- **Commit:** HANDOFF bu commit
- **Karar:** "Her turda STATUS.md ve HANDOFF.md ayrı commit'lerle güncellenir"

## Açık noktalar
- **E5:** DRIBBLE RNG — henüz başlanmadı
- **E6:** Simulation determinism acceptance — E5 sonrası
- **Genel Güç düşüşü:** E6 sonrası ayrı tur (ayrı branch, ayrı oturum)
- **F:** 11v11 runtime acceptance — E6 sonrası
- **G:** realism calibration — F sonrası

## Karar kuralları (zaman içinde eklenen)
1. Test yazmadan kod yazılmaz
2. Local test çalıştırılmadan "geçti" denmez
3. CI yeşil değilse "tamamlandı" denmez
4. Her CI run'ı raporlanır (sadece sonuncusu değil)
5. Test gevşetme yasak
6. Deneme-yanılma commit yasak, her commit tek hipotez
7. "Assume passes" yasak
8. Local çalıştırılamıyorsa "HAYIR" yazılır, uydurulmaz
9. Her turda STATUS.md güncellenir (ayrı commit)
10. Her turda HANDOFF.md güncellenir (ayrı commit)
11. Ajan kendi kararlarını "onaylandı" diye yazamaz — onay denetçide

## Sıradaki adımlar
1. Tur 15b: E5 DRIBBLE RNG (test-first)
2. Tur 16+: E6 Simulation determinism acceptance
3. Sonra: F, G
4. Sonra: Genel Güç turu (ayrı branch)

## Ajan rapor şablonu
(her turda istenen format)
- ADIM 1..N
- CI run tablosu (her run ayrı satır)
- Test sayıları
- Karar noktaları
- Açık sorular
- STATUS.md commit SHA
- HANDOFF.md commit SHA
