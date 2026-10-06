# UI Refactor — Handoff

## Okuma sırası
1. Bu dosya
2. docs/ui/STATUS.md
3. Son tur raporu

## Tur geçmişi
### Aşama 1 — Sol sidebar layout
- Tarih: 2026-10-06
- Sonuç: TAMAMLANDI
- CI: #804 GREEN (PR), #805 GREEN (post-merge), #806 docs
- Commit: 7ebb0ba1353ab7189e890a7aa7e3773728fcb21f
- Sıradaki: Aşama 2 (tema)

### Aşama 2 — Tema + Settings
- Tarih: 2026-10-06
- Sonuç: TAMAMLANDI
- CI: #808 GREEN (PR), #809 GREEN (post-merge)
- Commit: 420652b692b19bceb295a391957b1bc36cf9cc8c
- Settings: sidebar'ın 13. ve son öğesi
- Palet: koyu kırmızı / altın
- Açık nokta: Aşama 3 alt sekme
- Sıradaki: Aşama 3 (alt sekme)

## Karar kuralları
- live-v2-foundation dokunulmaz
- src/engine/live-v2/* dokunulmaz
- Tema Aşama 1'de değişmez; Aşama 2'de yalnız tema refactor edilir
- Sayfa içerikleri değişmez
- Semantik durum renkleri korunur
- Test gevşetme yasak
- Math.random() yasak
- CI GREEN olmadan sonraki aşamaya geçme
