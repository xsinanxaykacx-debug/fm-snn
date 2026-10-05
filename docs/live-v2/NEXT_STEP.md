\# Live-v2 — Sıradaki Adım



> Bu dosya sadece bir sonraki adımı anlatır.

> Her adım tamamlandığında yeniden yazılır.



\## Sıradaki: D — Action Resolution



\### Ne yapılacak

decide() çıktısındaki action (PASS/SHOOT/DRIBBLE) gerçek top

hareketine dönüştürülecek. Şu an sadece etiket.



\### Neden

\- PASS → top bir hedefe doğru hız kazanmalı

\- SHOOT → top kaleye doğru gitmeli

\- DRIBBLE → top oyuncunun önünde kalmalı

\- Bu olmadan maç "canlı" hissettirmez



\### Nerede

Yeni modül: src/engine/live-v2/actionResolution.ts



\### API (öneri)

export function resolveActions(

&#x20; state: MatchState,

&#x20; decisions: DecisionIntent\[]

): MatchState;



İçinde:

\- resolvePass(state, playerId, targetId?)

\- resolveShot(state, playerId)

\- resolveDribble(state, playerId)

\- resolveChase(state, playerId)



\### Bağlantı noktası

tick.ts içinde decide()'den sonra, applyMovement'tan önce:

&#x20; const decisions = decide(state, perceptions);

&#x20; const withActions = resolveActions(state, decisions);

&#x20; const intents: MovementIntent\[] = decisions;

&#x20; const moved = applyMovement(withActions, intents);



\### Test

Yeni dosya: src/engine/live-v2/actionResolution.test.ts

\- PASS: top hedefe doğru hız kazanır

\- SHOOT: top kaleye doğru gider

\- DRIBBLE: top oyuncunun önüne gelir

\- CHASE: hareket intent'i topa doğru

\- Determinizm: aynı state → aynı top hızı

\- Immutability: input mutasyona uğramaz



\### Kısıtlar

\- Legacy src/engine/live/\* DOKUNMA.

\- Sadece actionResolution.ts + test + tick.ts değişebilir.

\- Mevcut 80 test hâlâ geçmeli.

\- Determinizm korunmalı.

\- Math.random() yok — RNG E adımında bağlanacak.



\### Bitince

\- npx vitest run src/engine/live-v2/ → hepsi geçmeli

\- npx tsc --noEmit → temiz

\- git commit -m "feat(live-v2): add action resolution layer" + push

\- CI yeşil olmalı

\- Sonra STATUS.md güncelle (D'yi tamamlandı yap)

\- Sonra NEXT\_STEP.md'yi E adımı için yeniden yaz

