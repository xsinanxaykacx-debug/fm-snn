# Live-v2 Motor Prensipleri

> Bu dosya motorun anayasasıdır. Her turda referans alınır.
> Değiştirilemez. Sadece ekleme yapılabilir.

## Mimari (1-5)

1. **Saf fonksiyonlar** — yan etki yok, input → output.
2. **Immutable state** — mevcut state değişmez.
3. **Küçük modüller** — tek sorumluluk; 200 satırı aşan modül bölünür.
4. **Açık sözleşmeler** — her fonksiyonun girdisi ve çıktısı net.
5. **UI'dan bağımsız** — motor saf; UI entegrasyonu adapter katmanından yapılır.

## Determinizm (6-8)

6. **`Math.random()` yasak** — yalnızca `state.seed`.
7. **Stable iteration** — kimlik bazlı sıralama kullanılır; `Object.values` sıralamasına güvenilmez.
8. **Aynı seed + aynı input = aynı output** — bu kural her tick ve her maç için geçerlidir.

## Test (9-12)

9. **Test-first** — yeni özellik için önce test yazılır.
10. **Regression testi** — her bug fix için regression testi eklenir.
11. **CI GREEN olmadan merge yok.**
12. **Test gevşetme yasak** — yanlış test düzeltilir, doğru invariant korunur.

## Süreç (13-16)

13. **Her CI run'ı raporlanır** — yalnızca son run değil.
14. **Deneme-yanılma commit yasak** — her commit tek bir hipotezi temsil eder.
15. **"Assume passes" yasak** — kanıt olmayan sonuç başarı kabul edilmez.
16. **Gerçek oyun testi** — CI GREEN tek başına tamamlanma kanıtı değildir; kullanıcı gerçek oyunda doğrular.

## Legacy İzolasyonu (17-18)

17. **Legacy'ye HİÇBİR ŞEKİLDE DOKUNMA** — bug fix ve yeni özellik dahil.
18. **Legacy'den hiçbir şey alınmaz** — kod, tasarım, sabit veya davranış kopyalanmaz; legacy yalnızca referans olarak tutulur.

## Geçici Çözüm (19-20)

19. **Geçici yama yok** — doğru çözüm bulunana kadar beklenir.
20. **Her katman tam** — yarım özellik veya eksik sözleşme ile sonraki katmana geçilmez.

## Post-merge CI Protokolü (21)

21. **Post-merge CI kullanıcı doğrulamasıyla kapatılır.**
   - PR CI GREEN ise PR merge edilir.
   - Merge sonrasında post-merge main CI için API'nin görünmemesi beklenebilir; connector gecikmesi nedeniyle tekrar tekrar sorgulama yapılmaz.
   - Kullanıcıya **"Post-merge CI'ı doğrula"** denir.
   - Kullanıcı **GREEN** derse sonraki adıma geçilir.
   - Kullanıcı **FAIL** derse hata incelenir ve düzeltilir.
   - Kullanıcı **"görünmüyor"** derse beklenir ve tekrar doğrulama istenir.
   - Post-merge CI sonucu asla tahmin edilmez veya uydurulmaz.

## Legacy'den Çıkarılan Dersler

1. **Geçici çözümler birikti.** `computeDecisionInterval()`, `shouldDecide()`, `allocateChase()` gibi "şimdilik" katmanları kalıcı karmaşıklığa dönüştü. Doğru çözüm gelmeden geçici yama yapılmaz.
2. **Tek dosyada çok şey yapıldı.** `decision.ts` ve `actionResolution.ts` gibi dosyalarda sorumluluklar karıştı; bir düzeltme başka davranışları bozdu. Küçük, tek sorumluluklu modüller tercih edilir.
3. **Determinizm garanti değildi.** `Math.random()`, iteration sırası ve float davranışları aynı maçın farklı sonuçlanabilmesine yol açtı. RNG ve iteration açıkça kontrol edilir.
4. **Test coverage yetersizdi.** Birim ve regresyon testleri zayıf kaldığı için bug'lar kaçtı. Yeni özellik test-first geliştirilir ve bug fix regression testiyle kapanır.
5. **Feature parity kovalarken temel bozuldu.** Özellik ekleme uğruna temel fizik ve karar zinciri zayıfladı. Önce temel, sonra özellik.
6. **Roller/mevkiler baştan doğru modellenmedi.** Sonradan `PlayerState` içine hack'lerle sığdırıldı. Rol/mevki sözleşmesi F6'da baştan tasarlanır.
7. **Taktik/formation geç eklendi.** Taktik karar zincirine sonradan sıkıştırıldı ve entegrasyon sorunları doğdu. Ayrı ama entegre bir katman olarak F7/F9'da tasarlanır.
8. **Event/stat modeli geç eklendi.** Çok sayıda event tipi UI ile uyumsuz kaldı ve maç sonucu eksikleşti. Event/stat modeli F12'de baştan temiz tasarlanır.
9. **Legacy UI'ya sıkı bağlıydı.** Motor UI'dan ayrılamadı ve worker bileşenleri UI'ya özel kaldı. v2 motoru UI'dan bağımsız, adapter tabanlıdır.
10. **Legacy'nin dokunulmazlığı uygulanmadı.** Sürekli müdahale yeni bug'lar üretti. Legacy artık yalnızca referanstır; kodu, tasarımı, sabitleri ve davranışları alınmaz.

## Değişmez Kurallar

- Legacy `src/engine/live/*` hiçbir koşulda değiştirilmez.
- `Math.random()` kullanılmaz; RNG yalnızca `state.seed` üzerinden tüketilir.
- Aynı seed + aynı input aynı output üretmelidir.
- Stable iteration sağlanır; nesne anahtarlarının tesadüfi sırasına güvenilmez.
- Yeni özellikte önce test, sonra production kodu yazılır.
- Her bug fix regression testiyle kanıtlanır.
- CI GREEN olmadan merge yapılmaz.
- Testler gevşetilmez; yanlış invariant düzeltilir.
- Deneme-yanılma commitleri yapılmaz; her commit tek hipotez taşır.
- Kanıt olmayan sonuç "geçti" veya "tamamlandı" olarak raporlanmaz.
- Post-merge CI sonucu kullanıcı doğrulaması olmadan varsayılmaz.
- Gerçek oyun testi, CI GREEN'den ayrı bir kabul kapısıdır.
- Geçici yama yerine doğru çözüm beklenir.
- Her katman sözleşmesi tamamlanmadan sonraki katmana geçilmez.
