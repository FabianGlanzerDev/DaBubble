# DaBubble

DaBubble ist mein Frontend-Abschlussprojekt bei der Developer Akademie. Die als Einzelprojekt entwickelte Chat-Anwendung orientiert sich an den bereitgestellten Figma-Vorlagen und ermöglicht die Kommunikation in Channels und Direktnachrichten auf Desktop und Mobilgeräten.

Entwickler: **Fabian Glanzer**. Veröffentlicht unter: https://dabubble-3278.developerakademie.net/.

## Funktionen

- Registrierung mit E-Mail, Passwort, Name und Avatar-Auswahl; Anmeldung mit E-Mail/Passwort oder Google.
- Gastzugang über Firebase Anonymous Authentication mit eigener Kennung und denselben Eigentümer- und Mitgliedschaftsgrenzen wie reguläre Konten. Ausdrücklich öffentliche Demo-Channels mit Beispielbeiträgen und fiktiven Profilen bieten einen nutzbaren Einstieg.
- Wiederherstellung bestehender Sitzungen, Abmeldung und ausdrückliche Umwandlung eines Gastkontos.
- Passwort-Reset per Firebase-E-Mail sowie Bearbeitung des eigenen Avatars mit Synchronisierung in weiteren angemeldeten Tabs. Reguläre Konten können auch ihren Namen ändern; der automatisch vergebene Gastname bleibt unverändert.
- Channels erstellen, umbenennen, beschreiben, Mitglieder hinzufügen und Channels verlassen.
- Channel- und Direktnachrichten senden, eigene Nachrichten bearbeiten oder entfernen, in Threads antworten und Emoji-Reaktionen verwenden.
- Suche in zugänglichen Gesprächen sowie Auswahl von Personen und Channels über `@` und `#`.
- Online-Status über serverseitig verwaltete Verbindungen in Firebase Realtime Database; mehrere Tabs und Geräte werden berücksichtigt.
- Intro-Animation, responsive Ansichten, Tastaturbedienung und getrennte Menü-, Chat- und Threadansichten auf Mobilgeräten.
- Modale Dialoge setzen den Fokus auf ihren Inhalt, begrenzen Tab und Shift+Tab auf die oberste Ebene und geben ihn nach dem Schließen an den verfügbaren Auslöser zurück. Austritts- und Löschbestätigungen beginnen auf „Abbrechen“; während des Speicherns lässt sich die Bestätigung nicht mit Escape schließen.

## Technik und Struktur

Angular 22 mit eigenständigen Komponenten, TypeScript im Strict Mode, SCSS und Angular Router mit Hash-Routing. Firebase Authentication verwaltet Konten, Cloud Firestore die Profile und Chatdaten, Realtime Database die Anwesenheit. Firebase Analytics wird im Anwendungscode nicht eingebunden. Schrift und Bilder werden lokal ausgeliefert; die [Nunito-Lizenz](public/assets/fonts/nunito-OFL.txt) liegt im Projekt.

Logo, Favicon, Avatar-Illustrationen und Workspace-Bild werden lokal als verlustfreie WebP-Bilder ausgeliefert. Die gespeicherten Avatar-IDs und ihre Zuordnung bleiben unverändert. SVG-Icons einschließlich der leeren Avatar-Silhouette bleiben Vektoren. Alte PNG- und SVG-Bildadressen bleiben als Kompatibilitätsdateien erhalten; die App verwendet die alten Rasterdateien nicht mehr. Ob eine externe Mailvorlage noch eine alte Logo-Adresse nutzt, ist nicht bestätigt. Das Logo in der Kopfzeile ist rein visuell und nicht fokussierbar.

| Bereich                                  | Inhalt                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `src/app/core`                           | Authentifizierung, Firebase-Zugriff, Chatdaten, Anwesenheit und Navigation  |
| `src/app/features`                       | Anmeldung, Chat, Dialoge, Intro und rechtliche Seiten                       |
| `src/app/shared`                         | Gemeinsam verwendete UI-Komponenten, Layout und Styles                      |
| `public`                                 | Bilder, Schriftlizenz, Favicon und Apache-Regel                             |
| `scripts`                                | Qualitätsprüfungen, lokale Build-Vorschau und manuelles Verwaltungswerkzeug |
| `firestore.rules`, `database.rules.json` | Zugriffsschutz für Firestore und Realtime Database                          |

## Lokal starten

Voraussetzung: Node.js 24 ab 24.15.0 und npm 11.19.0; weitere unterstützte Node-Versionen stehen in [package.json](package.json).

```sh
npm ci
```

Die [.env.example](.env.example) einmalig als `.env` kopieren, sofern noch keine eigene `.env` existiert. Die fünf Platzhalter mit den Web-App-Werten des eigenen Firebase-Projekts ausfüllen; `FIREBASE_DATABASE_URL` ist die URL der eigenen Realtime Database. Keine Admin-Schlüssel oder Tokens eintragen. Danach `npm start` ausführen und `http://localhost:4200/` öffnen.

Angular liest `.env` nicht automatisch. Die npm-Vorbefehle für Start, Watch und Build erzeugen `.generated/firebase-config.json`; Angular übernimmt diese Datei an die öffentliche Build-Wurzel. Fehlende Werte und Beispielplatzhalter brechen die Erzeugung ab. `.env` und `.generated/` sind ignoriert. Direkte `ng`-Aufrufe umgehen die Vorbefehle; deshalb die npm-Befehle verwenden. Der normale Start verwendet die echte Cloud-Konfiguration; nur `npm run start:emulator` ist ausdrücklich lokal isoliert.

## Firebase einrichten

Die Anwendung benötigt folgende Einstellungen im eigenen Firebase-Projekt:

1. Unter **Authentication → Anmeldemethode** E-Mail/Passwort, Google und anonyme Anmeldung aktivieren. Für Google eine erreichbare, im eigenen Projekt angebotene Support-E-Mail wählen.
2. Unter **Authentication → Einstellungen → Autorisierte Domains** die tatsächlich verwendeten Hosts eintragen, insbesondere `localhost` und `dabubble-3278.developerakademie.net`, jeweils ohne Protokoll, Pfad oder Hash. `127.0.0.1` ist ein eigener Host und bei Verwendung separat zu prüfen.
3. Cloud Firestore mit der Datenbank `(default)` sowie Realtime Database einrichten. Die Regeln aus [firestore.rules](firestore.rules) und [database.rules.json](database.rules.json) prüfen und im richtigen Projekt veröffentlichen. Offene Lese-/Schreibregeln sind nicht vorgesehen.
4. Die eigene Web-App-Konfiguration in die ignorierte `.env` übernehmen. Keine Werte eines fremden Referenzprojekts verwenden. Unter **Google Cloud Console → APIs und Dienste → Anmeldedaten → verwendeter Web-API-Key** bestehende API- und Anwendungseinschränkungen prüfen. Die benötigten Firebase-Dienste und Entwicklungs-/Produktionshosts müssen weiter funktionieren.

| Konfigurationsfeld                                                               | Herkunft / Bedeutung                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `firebase.apiKey`, `firebase.authDomain`, `firebase.projectId`, `firebase.appId` | Werte der eigenen Firebase-Web-App                                                  |
| `firebase.databaseURL`                                                           | HTTPS-URL der eigenen Realtime Database für den Online-Status                       |
| `emulators`                                                                      | Für die Cloud `false`; lokale Emulatornutzung muss ausdrücklich eingerichtet werden |

Die Webkonfiguration wird an den Browser ausgeliefert und ist kein privater Serverschlüssel. `.env` hält die Projektwerte aus Git, macht sie im Frontend aber nicht geheim. Zugriffsschutz entsteht durch Authentication und die Datenbankregeln. Service-Account-Dateien, private Schlüssel, Passwörter und Sitzungstokens gehören weder ins Repository noch in den FTP-Build.

Die vorhandene [firebase.json](firebase.json) enthält die lokale Emulator-Konfiguration für administrative Übungen: Auth auf `127.0.0.1:9099`, Firestore auf `127.0.0.1:8080`, Realtime Database auf `127.0.0.1:9000`, reserviertes Projekt `demo-dabubble-auth`. Diese Umgebung benötigt zusätzlich Java 21 oder neuer.

### Lokale Emulatoren und Demo-Daten

In einem Terminal `npx firebase emulators:start --project demo-dabubble-auth --only auth,firestore,database` ausführen, in einem zweiten `npm run start:emulator`. Die dabei generierte Konfiguration enthält ausschließlich reservierte lokale Demo-Kennungen. `npm run build` erzeugt danach wieder die Produktionskonfiguration aus `.env`.

Für den Demo-Import unter PowerShell:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000'
npm run demo:seed -- --emulator --project demo-dabubble-auth
```

Ohne `--apply` zeigt der Befehl nur die zehn vorgesehenen Dokumentpfade. Nach Prüfung denselben Befehl um `--apply` ergänzen. Der Import erstellt zwei fiktive Verzeichniseinträge, zwei öffentliche Channels samt Namensreservierung und vier Beispielnachrichten einschließlich Thread. Er erstellt keine Auth-Konten und fügt keine realen Nutzer zu Mitgliedschaften hinzu. Identische Inhalte bleiben unverändert; bei abweichenden Daten an einem reservierten Pfad bricht die gesamte Transaktion ab. Besucherbeiträge werden nicht zurückgesetzt.

Der Cloud-Import benötigt berechtigte lokale Application Default Credentials und eine Terminalumgebung ohne Emulator-Variablen. Zuerst `npm run demo:seed -- --cloud --project "PROJECT_ID"` prüfen; die Kennung muss der eigenen `.env` entsprechen. `--apply` schreibt erst nach Abgleich der veröffentlichten Firestore-Regeln mit der lokalen Datei. Demo-Zugriff, fester Gastname und privater Lösch-Nachweis benötigen die neue Regeldatei. Den vollständigen Demo-Import einschließlich Konfliktabbruch und unveränderter Wiederholung habe ich im Emulator geprüft. In der Cloud steht die administrative Bestandsprüfung und der Import noch aus; ein Build übernimmt diese Daten nicht automatisch.

**Manuelle Nutzerbestätigung:** Fabian Glanzer hat die Veröffentlichung der neuen Firestore-Regeln bestätigt. Das ist keine eigene administrative Prüfung des veröffentlichten Regeltexts. Eigene Cloud-Prüfungen am 01.10.2026 mit ausschließlich neuen Testkonten bestätigten den unveränderbaren Gastnamen, Avataränderung, private Nachrichten mit Thread und Reaktion, gesperrte Fremdzugriffe, ausdrücklich erteilte Mitgliedschaft, Gastumwandlung mit gleicher UID und erhaltenen Beiträgen sowie Logout in zwei Tabs und erneute E-Mail-Anmeldung. Diese Prüfung erfolgte direkt gegen Firebase, getrennt von den Emulatorprüfungen; sie ersetzt noch keine Live-Abnahme des neuen FTP-Pakets.

### Passwort-Reset

Die App fordert eine echte Reset-Mail an. Der Firebase-Standardhandler unter der eigenen `authDomain` mit dem Pfad `/__/auth/action` darf das neue Passwort entgegennehmen. Laut bestätigter Rückmeldung der Developer Akademie genügt dieser Ablauf für die Abgabe; ein eigener Mailhandler und eine Anfrage beim Firebase-Support sind nicht erforderlich.

Die Rückkehradresse führt zur Anmeldung der aufrufenden App, in Produktion zu `https://dabubble-3278.developerakademie.net/#/anmeldung`. Eine zusätzliche eigene Reset-Ansicht ist vorhanden. Die globale Firebase-Aktions-URL muss dafür nicht umgestellt werden; eine solche Umstellung kann weitere Mailvorlagen betreffen. Reset-Codes und vollständige Mail-Links nicht veröffentlichen.

## Build und Qualitätsprüfungen

```sh
npm run typecheck
npm run lint
npm run format:check
npm run check:files
npm run check:secrets
npm run build
```

`npm run check` führt Typecheck, Lint, Format-, Dateilängenprüfung und Produktionsbuild gemeinsam aus. `npm run check:secrets` prüft separat Arbeitsdateien und erreichbare Git-Historie auf bekannte Schlüssel-/Tokenmuster; es ersetzt keine inhaltliche Prüfung vor der Veröffentlichung.

Für selbst geschriebenen Anwendungs- und Verwaltungscode gilt die 14-Zeilen-Grenze je Funktion. ESLint kontrolliert Codezeilen, die Dateiprüfung maximal 400 Zeilen pro selbst gepflegter Datei; die generierte npm-Lockdatei ist ausgenommen. Variablen, Parameter, Eigenschaften, Funktionen und Methoden verwenden camelCase; Klassen, Interfaces, Typen und Enums PascalCase. ESLint sichert die Schreibweise für TypeScript ab. Externe API-Felder, Datenbankschlüssel, Angular-Bindungen sowie CSS- und Dateinamen behalten ihr erforderliches Format. Der Formatter hält eine Leerzeile zwischen Funktionen ein und entspricht damit den 1–2 Leerzeilen der Checkliste. Englische TSDoc-Kommentare erläutern Zweck und wichtige Grenzen; Compodoc ist optional.

Build und statische Prüfungen ersetzen nicht die manuelle Funktionsprüfung der veröffentlichten Anwendung. Der Ablauf für die Live-Abnahme steht im Abschnitt „Veröffentlichung per FTP“.

`.prettierrc` und `.prettierignore` steuern die Formatbefehle; `.editorconfig` vereinheitlicht Editoreinstellungen, `.gitattributes` Textzeilenenden und Binärbehandlung. Diese Dateien sind keine Testartefakte und bleiben erhalten.

Der Produktionsbuild liegt in `dist/da-bubble/browser/`. Lokale Vorschau des gebauten Stands:

```sh
npm run build
npm run preview
```

Die Vorschau läuft auf `http://127.0.0.1:4302/`; für Firebase-Anmeldungen bei Bedarf über `http://localhost:4302/` öffnen. Der Vorschau-Server liefert statische Dateien ohne SPA-Fallback. Auch hier gilt die Firebase-Konfiguration des Builds.

## Veröffentlichung per FTP

Das Projekt ist für die **Domainwurzel** von `dabubble-3278.developerakademie.net` eingerichtet. Der Zielordner ist der FTP-Ordner mit der öffentlich erreichbaren `index.html`; beim bisherigen Hosting war das Remote `/`.

1. Den vorhandenen Serverstand einschließlich versteckter Dateien sichern. `robots.txt` und unbekannte Serverregeln erhalten. Die vorhandene `.htaccess` vor einer Änderung mit [public/.htaccess](public/.htaccess) vergleichen und zusätzliche Hosting-/Zugriffsregeln nicht überschreiben.
2. Eigene `.env`, geprüfte Datenbankregeln und öffentliche Demo-Daten vorbereiten. `npm ci`, die Qualitätsprüfungen und `npm run build` ausführen. Im Build müssen `index.html`, alle JS-/CSS-Dateien, `assets/`, `media/`, Favicons, `firebase-config.json` und `.htaccess` vorhanden sein. Die Konfiguration muss das eigene Projekt, die richtige `databaseURL` und `emulators: false` enthalten.
3. Den **Inhalt** von `dist/da-bubble/browser/` mit allen Unterordnern hochladen, nicht den Projektordner oder den übergeordneten `dist`-Ordner. Zusätzlich `dist/da-bubble/3rdpartylicenses.txt` neben die öffentliche `index.html` übernehmen. Assets und Bundles zuerst, `index.html` zuletzt übertragen.
4. Keine `.env`, Quelltexte, `node_modules`, Verwaltungswerkzeuge, Tests, lokalen Berichte, Emulator-Daten oder Zugangsdaten hochladen. Veraltete Serverdateien nur nach eindeutiger Zuordnung und Sicherung entfernen.

Hash-Routing benötigt für Angular-Routen keinen Apache-Fallback. Öffentliche Links verwenden daher zum Beispiel:

- `https://dabubble-3278.developerakademie.net/#/anmeldung`
- `https://dabubble-3278.developerakademie.net/#/registrierung`
- `https://dabubble-3278.developerakademie.net/#/passwort-reset`
- `https://dabubble-3278.developerakademie.net/#/passwort-reset/neues-passwort`
- `https://dabubble-3278.developerakademie.net/#/chat/channels/CHANNEL_ID`
- `https://dabubble-3278.developerakademie.net/#/chat/direkt/GESPRAECHS_ID`

Alte Links ohne `/#/` können auf einem Server ohne wirksames Rewrite weiterhin 404 liefern. Neue Direktlinks und Lesezeichen deshalb als Hash-URLs verwenden. Firebase-Mailparameter vor dem Hash werden vom eigenen optionalen Mailhandler ausgewertet; ein fehlender oder ungültiger Code darf keine Passwortänderung ermöglichen.

Nach dem Upload manuell prüfen: Intro und Assets; Direktaufruf und Neuladen der öffentlichen sowie erlaubten dynamischen Chat-Links; Browser-Zurück; Anmeldung, Logout und Kontowechsel in zwei Tabs; Registrierung mit Avatar; echte Reset-Mail und Google-Anmeldung; Chat, Mitgliedschaften und Anwesenheit mit getrennten eigenen Konten. Desktop und Mobilansichten bis 320 px einschließlich Tastatur und Touch einbeziehen. Diese Live-Abnahme wird durch einen lokalen Build nicht nachgewiesen.

**Manuelle Live-Prüfung durch Fabian Glanzer (30.09.2026, vor dieser Überarbeitung):** Das damalige FTP-Paket wurde hochgeladen. „Log out“ war zentriert. Online-Status und Schreiben funktionierten auf zwei Geräten; Abmelden, erneute Anmeldung und Neuladen ohne Sitzungsfenster oder 404. Dies ist keine Cloud-Abnahme der nachfolgenden lokalen Demo-, Regel- und Logoutänderungen.

## Wichtige Betriebsgrenzen

- **Privatsphäre:** Private Profile sind nur dem jeweiligen Konto zugänglich. Das Verzeichnis enthält Name und Avatar, keine E-Mail-Adresse. Private Gespräche bleiben an Mitgliedschaften gebunden. Nur administrativ markierte Demo-Channels sind für alle angemeldeten Nutzer und Gäste offen. Fiktive Demo-Profile haben keinen Online-Status und antworten nicht automatisch; Direktnachrichten an sie bleiben nur dem beteiligten realen Konto zugänglich.
- **Gastzugang:** Neuladen erhält die anonyme Sitzung. „Log out“ beendet sie unmittelbar ohne Bestätigungsseite, löscht aber weder Konto noch Chatdaten. Ohne vorherige Umwandlung kann ein abgemeldeter Gast seine bisherige UID nicht mit einem erneuten Gäste-Login zurückholen. Die Umwandlung erfolgt bei aktiver Sitzung über Registrierung oder Google-Anmeldung und erhält die UID samt Chatdaten. Ist die gewählte Identität schon vergeben, bleibt der Gastzugang bestehen.
- **Anmeldung und Logout:** Die Anmeldung zeigt keine zusätzliche Sitzungs-Auswahl. „Log out“ beendet die Firebase-Sitzung in den Tabs derselben App-Adresse im Browserprofil und räumt Chat-Abonnements und Anwesenheitsverbindungen auf. Andere Geräte behalten ihre Anmeldung. Konten und Chatdaten bleiben erhalten; das Formular wird geleert. Eine Anmeldung mit anderen gültigen E-Mail-Zugangsdaten ersetzt die lokale Sitzung erst nach Erfolg; ein fehlgeschlagener Versuch erhält den bisherigen Zugang.
- **Google:** Normale Anmeldung und ausdrücklich bestätigte Gastumwandlung bleiben möglich. Eine separate Verknüpfung dauerhafter Konten wird nicht angeboten. Bei einer Kollision mit einem Passwortkonto bleibt dessen Zugang erhalten; die App fordert die bisherige Anmeldemethode an. Direkte Google-Anmeldung kann bei einer von Google bestätigten Adresse einen unbestätigten Passwortanbieter ersetzen; ein nachträglich abgefangener Kollisionsfehler schützt nicht in jedem Fall. Deshalb prüft die App die Zuordnung über Firebase-Verknüpfung mit einer isolierten Hilfssitzung im Arbeitsspeicher, ohne Firestore-Profil, Chat oder Anwesenheit. Entfernt wird ausschließlich ihr neu angelegtes, laut erneuter Serverabfrage noch anonymes Konto; ein verknüpftes Google-Konto bleibt erhalten. Ein vorübergehender Bereinigungsfehler wird einmal wiederholt. Bei anhaltendem Netzfehler oder Browserabbruch kann ein Auth-Hilfskonto verbleiben. Eine vollständig garantierte Bereinigung würde zusätzlich einen administrativen oder serverseitigen Ablauf benötigen. Bereits bestehende Konten werden dabei nicht gelöscht. Eine Firebase-Abmeldung beendet nicht die unabhängige Google-Sitzung im Browser.
- **Anwesenheit:** Grün bedeutet mindestens eine vom Realtime-Dienst erkannte aktive Verbindung. Bei abruptem Netzabbruch kann die Erkennung verzögert erfolgen; bei Fehlern wird kein verlässlicher Online-Status behauptet. Statuspunkte sind keine Markierung ungelesener Nachrichten.
- **Chatdaten:** Das Entfernen einer Nachricht in der Oberfläche ist keine vollständige technische Kontolöschung. Threadstruktur und andere Beiträge können erhalten bleiben. Suche arbeitet mit zugänglichen Gesprächsdaten im Client; eine Skalierungszusage für große Datenbestände besteht nicht. Erwähnungen verwenden Namen und bleiben bei Umbenennungen oder gleichen Namen eingeschränkt.
- **Designbeispiele:** `/#/vorschau`, `/#/avatar-vorschau` und `/#/meldungen-vorschau` zeigen gekennzeichnete Beispiele ohne persistente Chataktionen. Der Gäste-Login öffnet hingegen den echten Chat.
- **Datenschutz:** Betreiber- und Hostingangaben stehen unter `/#/impressum` und `/#/datenschutz`. Die Developer Akademie stellt den Webspace bereit. Weitergehende Hosting-/Vertragsangaben und unbestätigte Firebase-Speicher-, Backup- oder Löschfristen werden hier nicht ergänzt. Es gibt keine zugesagte automatische Löschung aller Projektkonten zum Projektende.

### Löschanfragen für Betreiber

Löschanfragen gehen an `fabsdev@gmx.at`. Der Link in der Datenschutzerklärung bereitet eine E-Mail vor und führt selbst keine Löschung aus. Das erhaltene Werkzeug unter [scripts/account-deletion](scripts/account-deletion) ist ausschließlich für den Betreiber bestimmt und gehört nicht auf den Webserver.

1. Identität, betroffene UID und Umfang prüfen. Absender, Anzeigename, UID oder Screenshot allein reichen nicht. Für eine aktive Sitzung einen einmaligen zufälligen Prüfwert erzeugen: `node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))"`. Wert, UID und Ausgabezeit der konkreten Anfrage zuordnen. Die anfragende Person hinterlegt ihn unter Datenschutz → „Kontoinhaberschaft für eine Löschanfrage nachweisen“. In Firestore `deletionProofs/UID` Wert und serverseitigen Zeitpunkt gegen die Anfrage prüfen. Fremde Nutzer können diesen Nachweis weder lesen noch schreiben. Der Gastname bleibt unverändert. Nach dem Abgleich den Prüfwert manuell entfernen; spätestens die Kontolöschung entfernt ihn. Ohne aktive Gastsitzung oder andere belastbare Zuordnung nicht anhand eines Namens löschen. Keine Passwörter oder Tokens anfordern.
2. Umfang und Auswirkungen ausdrücklich bestätigen lassen. Berechtigte lokale Application Default Credentials für Authentication, Firestore und Realtime Database sowie lesenden Regelzugriff verwenden. Admin-Zugänge bleiben außerhalb des Repositorys. Cloud-Aufrufe sind auf die Projektkennung der eigenen `.env` begrenzt; dabei dürfen `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST` und `FIREBASE_DATABASE_EMULATOR_HOST` nicht gesetzt sein.
3. Zuerst nur den Bestand planen; `BESTAETIGTE_UID` durch die eindeutig bestätigte Kennung ersetzen:

   ```sh
   npm run account:delete -- plan --cloud --project "PROJECT_ID" --uid "BESTAETIGTE_UID"
   ```

4. Betroffene Gespräche, eigene und fremde Beiträge sowie die Archivfolgen einzeln prüfen. Erst nach Bestätigung des konkreten Umfangs den Fingerprint aus diesem Plan einsetzen:

   ```sh
   npm run account:delete -- execute --cloud --project "PROJECT_ID" --uid "BESTAETIGTE_UID" --confirm "BESTAETIGTE_UID" --fingerprint "GEPRUEFTER_HASH"
   ```

5. Das Werkzeug prüft die veröffentlichten Regeln und den bestätigten Bestand. Es entfernt Auth-Konto, Profil, Verzeichniseintrag, private Prüfwerte, Anwesenheit, Mitgliedschaften, eigene Beiträge und Reaktionen. Fremde Antworten bleiben erhalten; nötige Threadwurzeln werden zu leeren Platzhaltern ohne Autor. Reaktionen auf entfernte eigene Nachrichten entfallen. Direktgespräche mit fremden Beiträgen werden unter neuer Kennung schreibgeschützt archiviert; leere Direktgespräche entfernt. Öffentliche Demo-Container und fiktive Profile bleiben bestehen. Fremde Texte, Zitate und gemeinsame Metadaten können weiterhin personenbezogene Angaben enthalten und benötigen eine Einzelfallentscheidung. Ergebnis in Authentication und beiden Datenbanken kontrollieren; bei Fehlern nicht wahllos Dokumente löschen.
6. Firestore- und Presence-Sperrvermerke bleiben zunächst bestehen. Die im Code festgelegten **65 Minuten** sind eine Schutzfrist gegen noch gültige Tokens nach Abschluss, keine allgemeine Aufbewahrungsfrist oder automatische Löschung. Der gesonderte Befehl `purge` bearbeitet **alle** fälligen abgeschlossenen Vorgänge ohne UID-Filter; nur nach eigener Prüfung dieses gesamten Umfangs verwenden.

Dieser Ablauf einschließlich der neuen privaten Prüfwerte und Demo-Daten wurde mit eigens angelegten Emulator-Konten geprüft. Eine produktive Kontolöschung ist damit nicht nachgewiesen. Vor einem echten Löschfall sind Verwaltungszugriff, Datensicherung und die Auswirkungen auf andere Beteiligte zu prüfen.
