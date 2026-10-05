\# CLAUDE.md — fm-snn live-v2



\## Proje

FM/CM tarzı futbol menajerlik oyunu.

Stack: React 19 + Vite + TypeScript + Vitest.



Live-v2, legacy src/engine/live/\* yerine paralel olarak yeniden

yazılıyor. Legacy motora sıfır dokunuş kuralı var.



\## Değişmez sınırlar (asla ihlal edilmez)

1\. Legacy src/engine/live/\* DOKUNULMAZ.

2\. Her modül saf, immutable, deterministik.

3\. Math.random() yasak — rastgelelik sadece state.seed üzerinden.

4\. 90 dakika = 5400 tick.

5\. Aynı seed + aynı input = aynı output.

6\. Test yazmadan kod yazılmaz.

7\. Local test çalıştırılmadan "geçti" denmez.

8\. CI yeşil değilse "tamamlandı" denmez.



\## Şu anki durum

Bak: docs/live-v2/STATUS.md



\## Sıradaki iş

Bak: docs/live-v2/NEXT\_STEP.md



\## Mimari

Bak: docs/live-v2/DESIGN.md

Legacy envanteri: docs/live-v2/INVENTORY.md



\## Local doğrulama

cd C:\\Users\\bzdye\\Downloads\\fm-snn

git pull

npx vitest run src/engine/live-v2/

npx tsc --noEmit



\## Commit stili

Conventional commits, İngilizce, scope'lu:

\- feat(live-v2): ...

\- fix(live-v2): ...

\- test(live-v2): ...

\- docs(live-v2): ...

