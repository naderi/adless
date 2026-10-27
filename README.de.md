# AdLess

[English](README.md) | **Deutsch**

Ein schlanker, moderner Werbeblocker für Chrome und Edge. Blockiert Werbung, Tracker und Störendes, **lehnt Cookie-Banner ab** und zeigt dir genau, was er blockiert hat – mit eigenen Filterlisten und Regeln.

![AdLess](docs/screenshot.png)

- Blockiert Werbung, Tracker, Schadseiten und Störendes mit den bekannten Filterlisten (EasyList, EasyPrivacy, uBlock-Filter, Peter Lowe, AdGuard und viele regionale Listen)
- **Lehnt Cookie-Banner ab**, selbstständig – oder blendet sie aus, wo es keinen Ablehnen-Knopf gibt
- **AdLess-Filter**: eigene Korrekturen für Seiten aus Deutschland, Österreich und der Schweiz, aus den Meldungen der Nutzer, zweimal täglich aktualisiert – ohne neue Version der Erweiterung
- Das Popup zeigt, was auf der Seite blockiert wurde – Skripte, Bilder, eingebettete Seiten, Audio und Video, Hintergrund-Anfragen, Stile und Schriften – und **listet die blockierten Adressen** jeder Art auf
- Eine Art von Inhalten pro Seite mit einem Schalter erlauben, oder AdLess für eine Seite ausschalten
- **Element ausblenden**: etwas auf der Seite anklicken und dauerhaft ausblenden
- **Problem melden**: Werbung noch sichtbar oder Seite kaputt? Ein Klick öffnet eine vorausgefüllte Meldung
- Eigene Listen, eigene Regeln in uBlock-Origin-Syntax, Ausnahmen, Export und Import der Einstellungen
- Helles und dunkles Design passend zum Browser, Deutsch und Englisch
- Kein Konto, keine Telemetrie, keine „akzeptable Werbung“ – AdLess lädt nur Filterlisten herunter

## Installation

**[AdLess im Chrome Web Store holen](https://chromewebstore.google.com/detail/adless/mfddbnkcgfcpnchpekbgolnbjckbhmmm)** für Chrome oder **[bei den Microsoft-Edge-Add-ons](https://microsoftedge.microsoft.com/addons/detail/adless/ipacahpkcihocpplflihnieajgbaibhh)** für Edge. Eine Version für **Firefox** folgt. Alternativ aus dem Quellcode bauen (siehe unten) und als entpackte Erweiterung laden.

## Bedienung

Auf das AdLess-Symbol in der Symbolleiste klicken:

- **Auf dieser Seite blockieren** schaltet AdLess für die aktuelle Seite aus und ein
- Der Zähler zeigt, wie viele Anfragen *auf dieser Seite blockiert* wurden; darunter hat jede Art von Inhalten eine eigene Zahl und einen Schalter. Der Pfeil neben einer Art klappt die Liste der blockierten Adressen auf
- *Ausgeblendete Elemente* ist die Element-Ausblendung: Werbeflächen und Banner, die auf der Seite unsichtbar gemacht werden
- Wurde ein Cookie-Banner beantwortet, steht das im Popup (*Cookie-Banner abgelehnt*), mit dem Namen des Anbieters
- **Element ausblenden** startet die Elementauswahl, **Problem melden** öffnet eine Meldung auf GitHub mit der Seite und deinen Einstellungen (die Adresse ohne ihren Query-Teil)

Die Einstellungen (*Einstellungen* im Popup):

- **Filterlisten** – die mitgelieferten Listen nach Thema und Sprache, *AdLess-Filter* ganz oben; *Aktualisieren* lädt die eigenen Listen neu und sucht nach einer neuen AdLess-Version
- **Eigene Listen** – beliebige Filterlisten über ihre Adresse hinzufügen (uBlock-Origin-, Adblock-Plus- und AdGuard-Syntax)
- **Eigene Regeln** – eigene Filter und die mit der Elementauswahl ausgeblendeten Elemente
- **Ausnahmen** – Seiten, auf denen AdLess nicht blockiert
- **Allgemein** – *Werbung und Tracker blockieren*, *Cookie-Banner ablehnen*, Export und Import aller Einstellungen

## Ein Problem melden

Werbung, die durchrutscht, eine Seite, die nicht funktioniert, ein Cookie-Banner, der bleibt: *Problem melden* im Popup nutzen oder [ein Issue öffnen](https://github.com/naderi/adless/issues/new?template=site-problem.yml). Korrekturen kommen in die [AdLess-Filter](public/filters/adless.txt), die jedes installierte AdLess innerhalb eines halben Tages übernimmt.

## Aus dem Quellcode bauen

Benötigt Node.js 22+, pnpm, Git, curl und bash (unter Windows Git Bash).

```
git clone --recurse-submodules https://github.com/naderi/adless.git
cd adless
pnpm install
pnpm engine   # baut die Filter-Engine mit den aktuellen Filterlisten nach engine/
pnpm build    # die Erweiterung in dist/chrome-mv3
```

`dist/chrome-mv3` unter `chrome://extensions` laden (Entwicklermodus → *Entpackte Erweiterung laden*).

## Wie es funktioniert

AdLess nutzt die Filter-Engine von [uBlock Origin Lite](https://github.com/uBlockOrigin/uBOL-home) (Manifest V3, `declarativeNetRequest`), mit eigenem Popup, eigenen Einstellungen und Funktionen darüber. Cookie-Banner übernimmt [autoconsent](https://github.com/duckduckgo/autoconsent) von DuckDuckGo. Die AdLess-Filter übersetzt AdLess selbst in Browser-Regeln und CSS.

## Lizenz

[GPL-3.0](LICENSE). Die Filter-Engine enthält Code aus uBlock Origin Lite (© Raymond Hill, GPL-3.0), autoconsent steht unter der MPL-2.0, die Filterlisten unter den Lizenzen ihrer Autoren. Name und Logo „AdLess“ sind nicht Teil der Lizenz.

## Unterstützung

Wenn AdLess dir Zeit spart, kannst du die Entwicklung auf Ko‑fi unterstützen. ☕

<a href='https://ko-fi.com/N7N123QIX0' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

© 2026 [Ali Naderi](https://github.com/naderi) · [digitalent.dev](https://digitalent.dev/de/)
