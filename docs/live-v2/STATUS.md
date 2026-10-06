# Live-v2 Status — Current State

> Bu dosya her adım tamamlandığında güncellenir.
> Yeni bir oturumda ChatGPT/Claude/aider'a ilk verilecek dosya budur.

## Son güncelleme
2026-10-06 — BUG 1 + BUG 2 regression turu devam ediyor; CI #736 FAILED

## Repo / Branch / PR
- Repo: xsinanxaykacx-debug/fm-snn
- Branch: live-v2-foundation
- PR: #39 (OPEN, DRAFT)
- HEAD: 0a271ea9c4a3c038db8134b9cca96c142d0888e4
- Son CI: #736 (FAILED)
- Son bilinen yeşil CI: #726

## Tamamlanan adımlar (handoff §23 sırası)
- [x] A: perceive/decide tick entegrasyonu
- [x] B: decision intent → movement
- [x] C: possession → tick
- [x] D: action resolution (PASS/SHOOT/DRIBBLE/CHASE)
- [ ] E: RNG → decision/action resolution — BLOKELİ
- [ ] F: 11v11 runtime acceptance
- [ ] G: realism calibration

## Mevcut tick pipeline
restart → ball physics → boundary → perceive → decide → resolveActions → movement → possession
   ↓
boundary event varsa: applyRestart → playRestart → perceive/decide/action/movement
   ↓
boundary event yoksa: normal perceive/decide/action/movement/possession
   ↓
clock / phase / diagnostics

Not:
- Restart aynı tick'te oynatılır ve restartState temizlenir.
- Yeni oynatılmış restart topu aynı tick'te tekrar possession'a verilmez; sonraki tick physics topu hareket ettirdikten sonra possession çözülür.
- Ball physics x/y clamp YAPMAZ; boundary resolver aynı tick'te sınır olayını çözer.

## Test durumu
- 138 toplam test
- CI #736: 136 passed / 2 failed / 39 test dosyası
- Fail 1: src/engine/live-v2/restartFreeze.test.ts:17 — final ball velocity 0
- Fail 2: src/engine/live-v2/tick.test.ts:185 — chase testinde player.x = 48.834990189008934, beklenen > 50
- Local Vitest: henüz çalıştırılmadı
- Local tsc --noEmit: henüz çalıştırılmadı
- Legacy src/engine/live/* sıfır dokunuş

## Modül durumu

| Modül | Durum | Test |
|---|---|---|
| state.ts | ✅ Canonical MatchState | — |
| boundary.ts | ✅ Total resolver | 20 |
| movement.ts | ✅ Bounded | 8 |
| ball.ts | 🟡 Ground-level z normalization eklendi; regression açık | 5 |
| restart.ts | 🟡 Restart lifecycle regression açık | 7 |
| perception.ts | ✅ Read-only snapshot | 4 |
| decision.ts | ✅ 5 action tipi | 5 |
| possession.ts | 🟡 Restart sonrası davranış doğrulaması açık | 5 |
| rng.ts | ✅ Seeded LCG (bağlı değil) | 4 |
| tick.ts | 🟡 BUG 1 + BUG 2 regression açık | 11 |
| simulation.ts | 🟡 Restart regression etkileniyor | 13 |
| actionResolution.ts | ✅ PASS/SHOOT/DRIBBLE/CHASE | 8 |

## Değişmez sınırlar
1. Legacy src/engine/live/* DOKUNULMAZ.
2. Her modül saf, immutable, deterministik.
3. Math.random() yasak — sadece state.seed.
4. 90 dakika = 5400 tick.
5. Aynı seed + aynı input = aynı output.
6. Test yazmadan kod yazılmaz.
7. Local test çalıştırılmadan "geçti" denmez.
8. CI yeşil değilse "tamamlandı" denmez.
9. Testleri gevşeterek/atarak yeşile boyamak yasaktır.

## Local doğrulama
cd C:\Users\bzdye\Downloads\fm-snn
git pull
npx vitest run src/engine/live-v2/
npx tsc --noEmit

## Önemli tasarım kararları
- Boundary total function — caller-side fallback YOK.
- Possession normal tick'te boundary event YOKSA çalışır.
- Yeni oynatılmış restart topu aynı tick'te tekrar possession'a verilmez.
- applyRestart ball.ownerId = null yapar.
- DecisionIntent extends MovementIntent — cast gerekmez.
- Bounded movement: 0 <= x <= length, 0 <= y <= width.
- Ball physics x/y clamp YAPMAZ (boundary hallediyor).
- Deterministik tie-break: player.id (alfabetik).
- Test yazarken tick içindeki hareket+fiziği hesaba kat.

## Bilinen tuzaklar
- Aider + Groq ücretsiz tier: 8000 TPM — büyük context'te patlar.
- GitHub-only ajan local test çalıştırmaz → iki katmanlı doğrulama.
- Ajan "assume passes" diyebilir — local doğrulama zorunlu.
- applyMovement + stepBall başlangıç pozisyonlarını değiştirir.
- Chase regression fixture'ı ball.position için z alanını override sırasında düşürüyor; production'da ground-level z fallback eklendi. Regression hâlâ testte beklenen x yönü açısından açık.

## Bilinen ertelenmiş konular
- Gate 2 execution budget — eklenmedi.
- Gate 3 full match correctness — kısmen.
- Gate 4 realism — hiç başlamadı.
- RNG hiçbir yere bağlı değil (E adımı).
