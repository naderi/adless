# AdLess – store listing

Texts and answers for the Chrome Web Store (also usable for Edge Add-ons and Opera). Package: `dist/adless-<version>-chrome.zip` (`pnpm zip`). Images: `store/images/`.

## Package tab

Upload `dist/adless-0.1.0-chrome.zip`. Name and summary come from the manifest (`extName`, `extDescription` in `public/_locales`):

- **Name:** AdLess
- **Summary (en):** Lean, modern ad blocker: blocks ads and trackers, rejects cookie banners and shows exactly what it blocked.
- **Summary (de):** Schlanker, moderner Werbeblocker: blockiert Werbung und Tracker, lehnt Cookie-Banner ab und zeigt genau, was er blockiert hat.

## Store listing tab

Default language **English**; then add **German** (Deutsch) as a localized listing with the German description and the `de-*` images.

- **Category:** Privacy & Security (if not offered: Tools)
- **Language:** English (+ German)
- **Store icon:** `images/icon-128.png`
- **Screenshots (1280×800), in this order:** `en-1-overview.png`, `en-2-filter-lists.png`, `en-3-cookie-banners-dark.png`, `en-4-blocked-addresses.png` (German listing: the `de-*` files)
- **Small promo tile (440×280):** `en-promo-small-440x280.png` / `de-promo-small-440x280.png`
- **Marquee promo tile (1400×560, optional):** `en-promo-marquee-1400x560.png` / `de-promo-marquee-1400x560.png`
- **Official URL:** https://digitalent.dev (only selectable after verifying the domain in Google Search Console)
- **Homepage URL:** https://digitalent.dev/en/projects/adless/
- **Support URL:** https://github.com/naderi/adless/issues/new?template=site-problem.yml
- **Mature content:** No

### Description (en)

```
AdLess is a lean, modern ad blocker. It blocks ads, trackers and annoyances, says "no" to cookie banners for you – and shows exactly what it blocked.

• Blocks ads, trackers, malware sites and annoyances with the well-known filter lists: EasyList, EasyPrivacy, uBlock filters, Peter Lowe, AdGuard and many regional lists
• Rejects cookie banners on its own, or hides them where there is no reject button
• The popup shows what was blocked on the page – scripts, images, embedded pages, audio and video, background requests, styles and fonts – and lists the blocked addresses of each kind
• Allow a kind of content on one site with a single switch, or turn AdLess off for a site
• Hide element: click anything on a page to hide it for good
• AdLess filters: own fixes for sites in Germany, Austria and Switzerland, built from user reports and updated twice a day
• Report problem: ads still visible or a page broken? One click opens a prefilled report
• Custom filter lists, your own rules in uBlock Origin syntax, an allowlist, settings export and import
• Light and dark theme, English and German

Private by design: no account, no telemetry, no "acceptable ads". AdLess only downloads filter lists.

Fast: blocking is done by the browser itself (Manifest V3, declarativeNetRequest), built on the filtering engine of uBlock Origin Lite. Cookie banners are handled with DuckDuckGo's autoconsent.

Open source (GPL-3.0): https://github.com/naderi/adless
```

### Description (de)

```
AdLess ist ein schlanker, moderner Werbeblocker. Er blockiert Werbung, Tracker und Störendes, sagt für dich „Nein“ zu Cookie-Bannern – und zeigt genau, was er blockiert hat.

• Blockiert Werbung, Tracker, Schadseiten und Störendes mit den bekannten Filterlisten: EasyList, EasyPrivacy, uBlock-Filter, Peter Lowe, AdGuard und viele regionale Listen
• Lehnt Cookie-Banner selbstständig ab oder blendet sie aus, wo es keinen Ablehnen-Knopf gibt
• Das Popup zeigt, was auf der Seite blockiert wurde – Skripte, Bilder, eingebettete Seiten, Audio und Video, Hintergrund-Anfragen, Stile und Schriften – und listet die blockierten Adressen jeder Art auf
• Eine Art von Inhalten auf einer Seite mit einem Schalter erlauben, oder AdLess für eine Seite ausschalten
• Element ausblenden: etwas auf der Seite anklicken und dauerhaft ausblenden
• AdLess-Filter: eigene Korrekturen für Seiten aus Deutschland, Österreich und der Schweiz, aus den Meldungen der Nutzer, zweimal täglich aktualisiert
• Problem melden: Werbung noch sichtbar oder Seite kaputt? Ein Klick öffnet eine vorausgefüllte Meldung
• Eigene Filterlisten, eigene Regeln in uBlock-Origin-Syntax, Ausnahmen, Export und Import der Einstellungen
• Helles und dunkles Design, Deutsch und Englisch

Privat von Grund auf: kein Konto, keine Telemetrie, keine „akzeptable Werbung“. AdLess lädt nur Filterlisten herunter.

Schnell: Das Blockieren übernimmt der Browser selbst (Manifest V3, declarativeNetRequest), auf Basis der Filter-Engine von uBlock Origin Lite. Cookie-Banner erledigt autoconsent von DuckDuckGo.

Open Source (GPL-3.0): https://github.com/naderi/adless
```

## Privacy tab

**Single purpose description:**

```
AdLess blocks ads, trackers and other unwanted content on web pages. As part of this, it answers cookie consent banners with "reject" and shows the user what was blocked on the current page.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| declarativeNetRequest | Blocks requests to ads, trackers and malware sites with the rules of the bundled filter lists, the AdLess filter list and the user's own rules. |
| Host permission (`<all_urls>`) | An ad blocker has to work on every site the user visits: to apply its filter rules, to hide ad elements, and to answer cookie banners. Page content is processed only locally. |
| scripting | Injects the CSS that hides ad elements and the element picker into the page, and runs the cookie-banner handling in the page's frames. |
| userScripts | Applies cosmetic filters and scriptlets from filter lists and rules the user adds themselves. Only active after the user allows user scripts for the extension. |
| webRequest | Counts the requests blocked by the extension per tab (read-only, no blocking through webRequest), so the popup can show the counts and the blocked addresses. |
| webNavigation | Resets the per-tab counts when a new page loads, and applies element hiding to each frame as it starts loading. |
| storage | Stores the user's settings, filter lists and rules locally. |
| unlimitedStorage | The compiled filter lists can exceed the default storage quota. |
| alarms | Updates the filter lists periodically in the background. |
| offscreen | Compiles filter lists the user adds in an offscreen document, which a service worker cannot do itself. |
| activeTab | Starts the element picker in the current tab when the user clicks "Hide element". |

**Are you using remote code?** No, I am not using remote code.

Justification if asked: *All JavaScript is bundled in the package. AdLess downloads filter lists (plain text rules), which are converted into declarativeNetRequest rules and CSS; they are data, not code.*

**Data usage:** tick **none** of the data categories (AdLess collects no user data). Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://digitalent.dev/adless/privacy

## Distribution tab

- **Payments:** Free of charge
- **Visibility:** Public
- **Distribution:** All regions

## Notes for the reviewer (Test instructions, optional)

```
No account or login needed. Open any news site (e.g. https://www.spiegel.de) to see ads blocked and the cookie banner rejected; the toolbar popup lists what was blocked. Source code: https://github.com/naderi/adless
```
