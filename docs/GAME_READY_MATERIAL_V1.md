# FM Clone — Oyun Hazır Materyal Paketi V1

## 1. Gerçek motor sözleşmesi

- Saha: 104 × 64 m.
- Tick rate: 10 Hz.
- 1 tick = 0.1 saniye maç zamanı.
- 90:00 = 5.400 saniye = 54.000 tick.
- 45:00 = 2.700 saniye = 27.000 tick.
- Render katmanı motordan bağımsızdır; worker canlı frame gönderir.
- Seeded RNG maç determinismi için kullanılır.
- Dünya → fizik → algı → karar → etkileşim → çözümleme → dünya akışı korunur.

## 2. Oyuncu materyali

Her oyuncu şu veri katmanlarına sahiptir:

### Teknik
passing, firstTouch, dribbling, crossing, shooting, finishing, technique, heading, setPieces, longShots

### Zihinsel
decisions, vision, anticipation, positioning, offTheBall, concentration, composure, workRate, teamwork, bravery, aggression

### Fiziksel
pace, acceleration, agility, stamina, strength, balance

### Savunma
marking, tackling, ballWinning, defensivePositioning

### Kaleci
goalkeeper, reflexes, gkPositioning, handling, oneOnOne, aerialReach

### Maç içi değişkenler
condition, morale, form, fatigue

Bu ayrım sayesinde aynı oyuncu hem sezon motorunda hem canlı maç motorunda kullanılabilir.

## 3. Mevcut mevki/rol havuzu

GK, DL, DC, DR, WBL, WBR, DMC, ML, MC, MR, AML, AMC, AMR, KFL, GF, KFR, ST

Live motor bunları GK / CB / FB / WB / DM / CM / AM / W / ST rollerine normalize eder.

## 4. Taktik materyali

Formasyonlar:
- 4-4-2
- 4-3-3
- 3-5-2
- 4-2-3-1
- CUSTOM

Taktik eksenleri:
- mentality: defensive / balanced / attacking
- pressing: low / medium / high
- tempo: slow / normal / fast
- width: narrow / normal / wide
- directness: short / mixed / direct
- defensiveLine: deep / normal / high

Bunlar yalnızca UI seçeneği değildir; canlı karar ve hareket katmanının girdileridir.

## 5. Canlı maçta oyuncunun karar dili

Oyuncu intent'leri:
- idle
- move
- chase
- pass
- shoot
- cross
- dribble
- tackle
- intercept
- mark
- hold
- return_to_position

Kararın nedeni ayrıca tutulur:
- move
- chase
- support
- return
- tackle
- intercept
- mark
- set_piece
- formation

Bu ayrım maç ekranında “oyuncu ne yapıyor?” ile “neden yapıyor?” bilgisini ayrı gösterebilmek için korunmalıdır.

## 6. Top aksiyonları

Canlı motor şu aksiyonları gerçek dünya durumuna uygular:

- pas
- şut
- orta
- çalım
- tackle
- interception
- clearance
- set-piece
- loose-ball recovery

Paslarda hedef oyuncu/nokta artık fiziksel olarak takip edilen bir hedef durumudur. Pas, hedefini geçip kendi kendine kale çizgisine kadar devam etmemelidir.

Şut ve orta hedefleri pas hedefi gibi otomatik durdurulmaz; fiziksel top hareketi ve sınır çözümlemesi tarafından yönetilir.

## 7. Maç olayları

Oyun arayüzünde gösterilebilecek olaylar:

- Başlangıç vuruşu
- Gol
- Şut
- Pas
- Çalım
- Orta
- Korner
- Taç
- Kale vuruşu
- Faul
- Sarı kart
- Kırmızı kart
- Ofsayt
- Devre arası
- Maç sonu

Her olay mümkün olduğunca oyuncu + kulüp + dakika bilgisiyle saklanır.

## 8. Maç ekranı

Mevcut LiveMatchScreen için temel ürün yüzeyi:

### Üst bilgi
- Ev sahibi
- Deplasman
- skor
- dakika
- maç fazı
- canlı/maç tamamlandı durumu

### Saha
- 104 × 64 gerçek koordinat
- 22 oyuncu
- top
- oyuncu intent'i
- top sahibi
- oyuncu hareketi

### Yan panel
- skor
- top sahibi
- motor durumu
- hata durumu
- maç sonucu
- sonucu fikstüre işleme

### Debug
Tarayıcı konsolundan:
- dumpLiveMatchDebug()
- copyLiveMatchDebug()
- downloadLiveMatchDebug()

ile canlı debug kaydı alınabilir.

## 9. Maç sonrası istatistik paketi

Minimum gösterilecekler:

- Skor
- xG
- Şut
- İsabetli şut
- Pas / başarılı pas
- Pas yüzdesi
- Çalım / başarılı çalım
- Orta
- Korner
- Taç
- Kale vuruşu
- Faul
- Sarı / kırmızı
- Topa sahip olma
- Recovery
- Counter-press metrikleri

## 10. Kariyer oyunu

Sezon döngüsü:

1. Kadro
2. Taktik
3. Antrenman
4. Fikstür
5. Canlı maç
6. Maç sonucu
7. Oyuncu kariyer istatistikleri
8. Puan durumu
9. Transfer
10. Akademi
11. Kupa
12. Yeni hafta

Mevcut GameState bu akış için gerekli ana varlıkları zaten taşıyor.

## 11. Oyuncu gelişimi

Antrenman odakları:
- attack
- defense
- physical
- tactical
- balanced

Yoğunluk:
- light
- normal
- intense

Akademi:
- potential
- potentialStars
- scoutRating

## 12. Ürün olarak tamamlanması gereken kritik doğrulamalar

Bir maç “oynanabilir” görünse bile aşağıdakiler aynı anda doğru olmalıdır:

1. 90 dakika gerçekten 54.000 tick sürmeli.
2. Skor ile şut/olay istatistikleri mantıksal olarak uyuşmalı.
3. Pas topu hedefini geçip kale çizgisine taşınmamalı.
4. Gol sonrası top merkeze dönmeli.
5. Gol sonrası doğru takım kickoff yapmalı.
6. Top sahibi ile oyuncu isBallOwner aynı olmalı.
7. Physics shadow semantic matching bozulmamalı.
8. Seed aynıysa aynı maç tekrar üretilebilmeli.
9. UI worker tamamlanan maçı doğru sonucu store'a yazabilmeli.
10. Maç tamamlanmadan fikstür “played” olmamalı.

## 13. Şu anki teknik öncelik

Önce tek maç.

Tek maç doğrulaması temizlenmeden:
- 10 maç
- 100 maç
- 1000 maç
- sezon kalibrasyonu

çalıştırılmamalıdır.

Bu paket kalibrasyon sayısı uydurmaz. Önce mekanik doğruluk, sonra istatistiksel kalibrasyon yapılır.
