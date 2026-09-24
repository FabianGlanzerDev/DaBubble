# DaBubble

Angular-Abschlussprojekt mit TypeScript Strict Mode, Figma-Oberflächen für Desktop und Mobilgeräte sowie Firebase Authentication und Firestore-Benutzerprofilen. Stand: 24.09.2026.

## Lokal starten

Voraussetzungen: Node gemäß `package.json` (getestet mit 24.20.0), npm (11.19.0).

```sh
npm ci
npx playwright install chromium
npm start -- --host 127.0.0.1
```

Die App läuft unter `http://127.0.0.1:4200`. Für Auth-/Firestore-Emulatortests wird zusätzlich Java 21+ im PATH benötigt. Sie brauchen weder ein Cloud-Projekt noch eine Firebase-Anmeldung.

## Bedienung und aktueller Funktionsumfang

- `/intro`: fünfsekündige Animation mit Überspringen und Reduced Motion. Ein Klick auf das DABubble-Logo öffnet `/intro?replay=true` und spielt sie erneut vor der Anmeldung ab.
- `/anmeldung`, `/registrierung`, `/avatar-auswahl`: E-Mail-/Passwort-Anmeldung, Registrierung, eigene Avatar-/Profilanlage, Feldfehler und Ladezustände. Unterbrochene Profilanlage lässt sich nach Anmeldung vervollständigen; ein noch nicht gespeicherter Name muss nach Neuladen erneut eingegeben werden.
- `/passwort-reset`: Reset anfordern. `/passwort-reset/neues-passwort` prüft den Firebase-Aktionscode, bevor ein neues Passwort gespeichert werden kann.
- `/chat` und `/avatar-auswahl` sind geschützt. Anmeldung bleibt nach Neuladen erhalten; Abmeldung wirkt auch in anderen offenen Tabs. Das eigene Profil lässt sich mit Name und Avatar ändern.
- `/vorschau`, `/avatar-vorschau` und `/meldungen-vorschau` sind ausdrücklich öffentliche Designbeispiele und erzeugen keine Anmeldung.
- Menü, Channel-/Direktansichten, neue Nachricht, Suche, Thread, Profile und Dialoge sind bedienbar. Mobil sind Menü, Suche, Gespräch und Thread getrennte Ansichten; Browser-Zurück, Dialogschließen und Tastaturfokus werden berücksichtigt.
- Nachrichtenentwürfe, Emoji-Einfügen, Erwähnungen, Suchfilter und Mitgliederauswahl arbeiten lokal auf Beispielen. Nachrichtenversand, echte Reaktionen, Channel-Änderungen und Mitgliedschaften sind noch nicht angebunden. Google-/Gäste-Login und echte Presence fehlen ebenfalls.
- `/impressum` und `/datenschutz` enthalten nur die vorbereitete Struktur; Betreiberangaben und freigegebene Rechtstexte fehlen.

Ein eigenes Firebase-Projekt existiert noch nicht. Deshalb bleibt `public/firebase-config.json` bei `{"firebase": null, "emulators": false}`. Ohne Konfiguration sind die Auth-Aktionen deaktiviert und geschützte Routen gesperrt. Die implementierten Auth-Abläufe sind lokal mit Emulatoren getestet; echte Cloud-Anmeldung und E-Mail-Zustellung bleiben zu prüfen.

## Eigenes Firebase-Projekt einrichten

1. In der [Firebase Console](https://console.firebase.google.com/) ein eigenes Projekt und unter **Projekteinstellungen → Allgemein** eine Web-App anlegen. Hosting und Analytics werden für die Anbindung nicht benötigt.
2. Unter **Authentication → Anmeldemethode** E-Mail/Passwort aktivieren; Schutz vor E-Mail-Enumeration beibehalten.
3. Unter **Firestore Database** die Standard-Datenbank `(default)` im Produktionsmodus anlegen und die Region wählen. Die Regeln aus [firestore.rules](firestore.rules) im eigenen Projekt einsetzen, bevor die Anbindung genutzt wird. Keine offenen Testregeln verwenden.
4. Unter **Authentication → Einstellungen → Autorisierte Domains** die benötigten lokalen Domains (`localhost`, `127.0.0.1`) und später die tatsächliche Website-Domain eintragen, jeweils ohne Protokoll/Port.
5. In der Passwort-Reset-Mailvorlage die Aktions-URL lokal auf `http://127.0.0.1:4200/passwort-reset/neues-passwort` setzen; später auf dieselbe Route unter der eigenen HTTPS-Domain. Absender und Mailtext prüfen.
6. Aus der eigenen Web-App-Konfiguration **`apiKey`, `authDomain`, `projectId`, `appId`** bereitstellen. Diese vier öffentlichen Clientwerte gehören in das Objekt `firebase` der Konfigurationsdatei; `emulators` bleibt für die Cloud `false`. Keine fremden Werte, Passwörter, Service-Account-Dateien oder privaten Schlüssel eintragen.
7. Anschließend mit zwei Testkonten Registrierung, Avatar, Logout/Login, Reload, Profiländerung und eine echte Reset-Mail prüfen. Dafür wird Zugriff auf die Testpostfächer benötigt. Hosting muss bei einem späteren Deployment direkte Angular-Routen auf `index.html` zurückführen.

Die Webkonfiguration ist kein Serverschlüssel. Firebase Authentication und Firestore-Regeln sichern den Zugriff. `users/{uid}` enthält nur `uid`, `name`, `avatarId`, `createdAt`, `updatedAt`; E-Mail und Passwort werden nicht in Firestore-Profilen gespeichert. Nur der Eigentümer darf sein Profil lesen/anlegen und Name/Avatar ändern. Auflisten, Löschen, fremde Zugriffe, zusätzliche Felder und Änderungen unveränderlicher Daten sind gesperrt. Nachrichten-/Channel-Pfade sind ebenfalls gesperrt.

## Prüfungen

| Befehl                  | Prüfung                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run build`         | Produktionsbuild nach `dist/da-bubble/browser`                         |
| `npm run typecheck`     | Strikte Angular-Templates, Anwendung und Test-TypeScript               |
| `npm run lint`          | ESLint, Accessibility und maximal 14 Zeilen pro Anwendungsfunktion     |
| `npm run format:check`  | Prettier                                                               |
| `npm run check:files`   | Maximal 400 Zeilen pro selbst gepflegter Textdatei                     |
| `npm test`              | Build und 37 Oberflächen-/Navigationstests                             |
| `npm run test:browser`  | Dieselben Browsertests gegen den vorhandenen Build                     |
| `npm run test:firebase` | Build, lokale Emulatoren, 20 Regeltests und 9 Auth-Browserabläufe      |
| `npm run check:secrets` | Private Schlüssel/Token in Arbeitsdateien und Git-/Reflog-Blobs suchen |
| `npm run check`         | Typecheck, Lint, Format, Dateilängen, Build und Browsertests           |

Die Browsertests laden den Build über lokale Request-Interception. Firebase-Tests erlauben ausschließlich die lokalen Emulator-Ursprünge: Authentication `127.0.0.1:9099`, Firestore `127.0.0.1:8080`. Der reservierte Namensraum `demo-dabubble-auth` ist keine Cloud-Projektkennung. Testpasswörter werden bei jedem Lauf generiert; Emulatorzustand, Logs und Screenshots bleiben ignoriert. Ein bereits gestarteter Emulator auf diesen Ports muss vorher beendet werden.

Die Emulatoren stellen keine E-Mails zu. Die Tests lesen lokale Reset-Codes und verwenden die echte Anwendungsroute. Erwartete negative Auth-Antworten (HTTP 400) und beim Logout abgebrochene Firestore-Listener sind von unerwarteten Konsolenfehlern abgegrenzt. Schutz vor fremden Profilzugriffen und ungültigen Schemas wird positiv und negativ geprüft. Reale Mailzustellung, Cloud-Passwortpolicy und zeitlicher Ablauf echter Reset-Links müssen separat geprüft werden.

Auf diesem Rechner liegt eine portable Java-21-Laufzeit im ignorierten `tmp/auth-audit/java/runtime/`. Alternativ zur normalen Java-Installation kann sie nur für die aktuelle PowerShell verwendet werden:

```powershell
$dabubbleJava = Get-ChildItem 'tmp/auth-audit/java/runtime' -Directory | Select-Object -First 1
$env:JAVA_HOME = $dabubbleJava.FullName
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
npm run test:firebase
```

## Struktur, Design und verbleibende Abnahme

`src/app/features` enthält die Ansichten, `shared` gemeinsame Komponenten/Styles, `core` Auth-, Firebase- und UI-Dienste. Regeln und Emulator-Konfiguration liegen im Projektstamm; Tests und Prüfskripte unter `tests` und `scripts`. Diese README ist die einzige projektzugehörige Markdown-Dokumentation.

Designquellen sind 56 Desktop-Exporte, 55 mobile SVGs und das bereitgestellte abgenommene Vergleichsprojekt. Aus diesem wurden bewusst nur ausgewählte Grafikassets übernommen, kein fremder Anwendungscode und keine Firebase-Konfiguration. Die verwendeten Originale liegen unter `public/assets/images/original/`; Devspace, Reaktionsgrafiken und der mobile Standardavatar stammen aus Figma-Ausschnitten. Nunito wird lokal geladen, mit [OFL-Lizenz](public/assets/fonts/nunito-OFL.txt). Farben: `#ECEEFE`, `#444DF2`, `#535AF1`, `#797EF3`, Weiß und Schwarz.

Mobilansichten wurden bei 320, 375 und 430 px verglichen, Desktop bis 1920 px geprüft. Die mobilen Originalframes messen 430 × 932 px; kleinere Breiten sind responsive Ableitungen. Zusätzliche Vorschauhinweise und deaktivierte Datenaktionen bleiben absichtlich sichtbar. Die 44-px-Chat-Fußzeile und Textumbrüche verursachen Unterschiede zum fertigen Figma-Produkt. Touch, Tastatur, Intro und Browser-Verlauf sind in Chromium geprüft; physische Android-/iOS-Geräte, Bildschirmtastatur, Safe Areas und Safari bleiben offen.

Lokale Screenshots/Analysen bleiben unter `test-results/` und `tmp/`; sie werden nicht versioniert. Die vollständige Abschlusscheckliste ist wegen der noch fehlenden Cloud-Abnahme, Chat-/Channel-Logik, Rechtstexte und Veröffentlichung nicht erfüllt. Nächster Schritt ist die eigene Firebase-Webkonfiguration und die Prüfung echter Reset-Mails. Push, Veröffentlichung und Deployment sind nicht Bestandteil der lokalen Commit-Erstellung.
