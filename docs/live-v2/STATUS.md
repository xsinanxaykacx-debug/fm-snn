# Live-v2 Status — Current State

> Bu dosya her adım tamamlandığında güncellenir.
> Yeni bir oturumda ChatGPT/Claude/aider'a ilk verilecek dosya budur.

## Son güncelleme
2026-10-05 — D tamamlandı (CI #716 yeşil), E adımına geçiliyor

## Repo / Branch / PR
- Repo: xsinanxaykacx-debug/fm-snn
- Branch: live-v2-foundation
- PR: #39 (OPEN, DRAFT)
- HEAD: 75de842ed0824c5202504b9c60109e3b6252bad2
- Son yeşil CI: #718 (başarılı, 75de842)

## Tamamlanan adımlar (handoff §23 sırası)
- [x] A: perceive/decide tick entegrasyonu — CI #706 yeşil
- [x] B: decision intent → movement — CI #707 yeşil
- [x] C: possession → tick — CI #710 yeşil
- [x] D: action resolution (PASS/SHOOT/DRIBBLE/CHASE) — CI #716 yeşil
- [ ] E: RNG → decision/action resolution
- [ ] F: 11v11 runtime acceptance
- [ ] G: realism calibration

## Mevcut tick pipeline
perceive → decide → resolveActions → movement → ball physics → boundary
   ↓
if boundary event: restart (applyRestart + consumeRestart)
else:              updatePossession
   ↓
clock / phase / diagnostics

## Test durumu
- 131/131 test geçiyor (38 dosya; yeni D testleri dahil)
- npx tsc --noEmit temiz
- Legacy src/engine/live/* sıfır dokunuş

## Modül durumu

| Modül | Durum | Test |
|---|---|---|
| state.ts | ✅ Canonical MatchState | — |
| boundary.ts | ✅ Total resolver | 20 |
| movement.ts | ✅ Bounded | 8 |
| ball.ts | ✅ Pure physics | 5 |
| restart.ts | ✅ 4 tip restart | 7 |
| perception.ts | ✅ Read-only snapshot | 4 |
| decision.ts | ✅ 5 action tipi | 5 |
| possession.ts | ✅ Free/owned/steal | 5 |
| rng.ts | ✅ Seeded LCG (bağlı değil) | 4 |
| tick.ts | ✅ A+B+C entegre | 9 |
| simulation.ts | ✅ 5 horizon | 13 |
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

## Local doğrulama
cd C:\Users\bzdye\Downloads\fm-snn
git pull
npx vitest run src/engine/live-v2/
npx tsc --noEmit

## Önemli tasarım kararları
- Boundary total function — caller-side fallback YOK.
- Possession sadece boundary event YOKSA çalışır.
- applyRestart zaten ball.ownerId = null yapar.
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

## Bilinen ertelenmiş konular
- Gate 2 execution budget — eklenmedi.
- Gate 3 full match correctness — kısmen.
- Gate 4 realism — hiç başlamadı.
- RNG hiçbir yere bağlı değil (E adımı).