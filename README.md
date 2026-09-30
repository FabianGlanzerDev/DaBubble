# DaBubble

DaBubble ist mein Frontend-Abschlussprojekt bei der Developer Akademie. Die als Einzelprojekt entwickelte Chat-Anwendung orientiert sich an den bereitgestellten Figma-Vorlagen und ermöglicht die Kommunikation in Channels und Direktnachrichten auf Desktop und Mobilgeräten.

Entwickler: **Fabian Glanzer**. Veröffentlicht unter: https://dabubble-3278.developerakademie.net/.

## Funktionen

- Registrierung mit E-Mail, Passwort, Name und Avatar-Auswahl; Anmeldung mit E-Mail/Passwort oder Google.
- Vollwertiger Gastzugang über Firebase Anonymous Authentication mit denselben Eigentümer- und Mitgliedschaftsgrenzen wie reguläre Konten.
- Wiederherstellung bestehender Sitzungen, Abmeldung und ausdrückliche Umwandlung eines Gastkontos.
- Passwort-Reset per Firebase-E-Mail sowie Bearbeitung des eigenen Namens und Avatars mit Synchronisierung in weiteren angemeldeten Tabs.
- Channels erstellen, umbenennen, beschreiben, Mitglieder hinzufügen und Channels verlassen.
- Channel- und Direktnachrichten senden, eigene Nachrichten bearbeiten oder entfernen, in Threads antworten und Emoji-Reaktionen verwenden.
- Suche in zugänglichen Gesprächen sowie Auswahl von Personen und Channels über `@` und `#`.
- Online-Status über serverseitig verwaltete Verbindungen in Firebase Realtime Database; mehrere Tabs und Geräte werden berücksichtigt.
- Intro-Animation, responsive Ansichten, Tastaturbedienung und getrennte Menü-, Chat- und Threadansichten auf Mobilgeräten.
- Modale Dialoge setzen den Fokus auf ihren Inhalt, begrenzen Tab und Shift+Tab auf die oberste Ebene und geben ihn nach dem Schließen an den verfügbaren Auslöser zurück. Austritts- und Löschbestätigungen beginnen auf „Abbrechen“; während des Speicherns lässt sich die Bestätigung nicht mit Escape schließen.

## Technik und Struktur

Angular 22 mit eigenständigen Komponenten, TypeScript im Strict Mode, SCSS und Angular Router mit Hash-Routing. Firebase Authentication verwaltet Konten, Cloud Firestore die Profile und Chatdaten, Realtime Database die Anwesenheit. Firebase Analytics wird im Anwendungscode nicht eingebunden. Schrift und Bilder werden lokal ausgeliefert; die [Nunito-Lizenz](public/assets/fonts/nunito-OFL.txt) liegt im Projekt.

Logo, Favicon, Avatar-Illustrationen und Workspace-Bild werden lokal als verlustfreie WebP-Bilder ausgeliefert. Die gespeicherten Avatar-IDs und ihre Zuordnung bleiben unverändert. SVG-Icons einschließlich der leeren Avatar-Silhouette bleiben Vektoren. Alte PNG- und SVG-Bildadressen bleiben als Kompatibilitätsdateien erhalten; die App verwendet die alten Rasterdateien nicht mehr. Ob eine externe Mailvorlage noch eine alte Logo-Adresse nutzt, ist nicht bestätigt. Das Logo in der Kopfzeile ist rein visuell und nicht fokussierbar.

| Bereich                                  | Inhalt                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app/core`                           | Authentifizierung, Firebase-Zugriff, Chatdaten, Anwesenheit und Navigation          |
| `src/app/features`                       | Anmeldung, Chat, Dialoge, Intro und rechtliche Seiten                               |
| `src/app/shared`                         | Gemeinsam verwendete UI-Komponenten, Layout und Styles                              |
| `public`                                 | Bilder, Schriftlizenz, Favicon, öffentliche Firebase-Konfiguration und Apache-Regel |
| `scripts`                                | Qualitätsprüfungen, lokale Build-Vorschau und manuelles Verwaltungswerkzeug         |
| `firestore.rules`, `database.rules.json` | Zugriffsschutz für Firestore und Realtime Database                                  |

## Lokal starten

Voraussetzung: Node.js 24 ab 24.15.0 und npm 11.19.0; weitere unterstützte Node-Versionen stehen in [package.json](package.json).

```sh
npm ci
npm start
```

Anschließend `http://localhost:4200/` öffnen. Die Anwendung lädt ihre Firebase-Einstellungen aus [public/firebase-config.json](public/firebase-config.json). Der vorhandene Stand verweist auf **YOUR_FIREBASE_PROJECT_ID** mit `emulators: false`: Auch ein lokal gestartetes Frontend arbeitet damit gegen die echte Cloud. Es schaltet nicht automatisch auf eine Testumgebung um.

## Firebase einrichten

Die Anwendung benötigt folgende Einstellungen im eigenen Firebase-Projekt:

1. Unter **Authentication → Anmeldemethode** E-Mail/Passwort, Google und anonyme Anmeldung aktivieren. Für Google eine erreichbare, im eigenen Projekt angebotene Support-E-Mail wählen.
2. Unter **Authentication → Einstellungen → Autorisierte Domains** die tatsächlich verwendeten Hosts eintragen, insbesondere `localhost` und `dabubble-3278.developerakademie.net`, jeweils ohne Protokoll, Pfad oder Hash. `127.0.0.1` ist ein eigener Host und bei Verwendung separat zu prüfen.
3. Cloud Firestore mit der Datenbank `(default)` sowie Realtime Database einrichten. Die Regeln aus [firestore.rules](firestore.rules) und [database.rules.json](database.rules.json) prüfen und im richtigen Projekt veröffentlichen. Offene Lese-/Schreibregeln sind nicht vorgesehen.
4. Die Web-App-Konfiguration aus den Firebase-Projekteinstellungen in `public/firebase-config.json` übernehmen. Die bestehende Projektkonfiguration nicht durch Werte eines fremden Referenzprojekts ersetzen.

| Konfigurationsfeld                                                               | Herkunft / Bedeutung                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `firebase.apiKey`, `firebase.authDomain`, `firebase.projectId`, `firebase.appId` | Werte der eigenen Firebase-Web-App                                                  |
| `firebase.databaseURL`                                                           | HTTPS-URL der eigenen Realtime Database für den Online-Status                       |
| `emulators`                                                                      | Für die Cloud `false`; lokale Emulatornutzung muss ausdrücklich eingerichtet werden |

Die aktuelle Realtime-URL lautet `YOUR_FIREBASE_DATABASE_URL`. Die Webkonfiguration wird an den Browser ausgeliefert und ist kein privater Serverschlüssel. Zugriffsschutz entsteht durch Authentication und die Datenbankregeln. Service-Account-Dateien, private Schlüssel, Passwörter und Sitzungstokens gehören weder ins Repository noch in den FTP-Build.

Die vorhandene [firebase.json](firebase.json) enthält die lokale Emulator-Konfiguration für administrative Übungen: Auth auf `127.0.0.1:9099`, Firestore auf `127.0.0.1:8080`, Realtime Database auf `127.0.0.1:9000`, reserviertes Projekt `demo-dabubble-auth`. Diese Umgebung benötigt zusätzlich Java 21 oder neuer.

### Passwort-Reset

Die App fordert eine echte Reset-Mail an. Der Firebase-Standardhandler unter `YOUR_FIREBASE_AUTH_DOMAIN/__/auth/action` darf das neue Passwort entgegennehmen. Laut bestätigter Rückmeldung der Developer Akademie genügt dieser Ablauf für die Abgabe; ein eigener Mailhandler und eine Anfrage beim Firebase-Support sind nicht erforderlich.

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

Der Produktionsbuild liegt in `dist/da-bubble/browser/`. Lokale Vorschau des gebauten Stands:

```sh
npm run build
npm run preview
```

Die Vorschau läuft auf `http://127.0.0.1:4302/`; für Firebase-Anmeldungen bei Bedarf über `http://localhost:4302/` öffnen. Der Vorschau-Server liefert statische Dateien ohne SPA-Fallback. Auch hier gilt die Firebase-Konfiguration des Builds.

## Veröffentlichung per FTP

Das Projekt ist für die **Domainwurzel** von `dabubble-3278.developerakademie.net` eingerichtet. Der Zielordner ist der FTP-Ordner mit der öffentlich erreichbaren `index.html`; beim bisherigen Hosting war das Remote `/`.

1. Den vorhandenen Serverstand einschließlich versteckter Dateien sichern. `robots.txt` und unbekannte Serverregeln erhalten. Die vorhandene `.htaccess` vor einer Änderung mit [public/.htaccess](public/.htaccess) vergleichen und zusätzliche Hosting-/Zugriffsregeln nicht überschreiben.
2. `npm ci`, die Qualitätsprüfungen und `npm run build` ausführen. Im Build müssen `index.html`, alle JS-/CSS-Dateien, `assets/`, `media/`, Favicons, `firebase-config.json` und `.htaccess` vorhanden sein. Die Konfiguration muss das gewünschte Projekt und `emulators: false` enthalten.
3. Den **Inhalt** von `dist/da-bubble/browser/` mit allen Unterordnern hochladen, nicht den Projektordner oder den übergeordneten `dist`-Ordner. Zusätzlich `dist/da-bubble/3rdpartylicenses.txt` neben die öffentliche `index.html` übernehmen. Assets und Bundles zuerst, `index.html` zuletzt übertragen.
4. Keine Quelltexte, `node_modules`, Verwaltungswerkzeuge, lokalen Berichte, Emulator-Daten oder Zugangsdaten hochladen. Veraltete Serverdateien nur nach eindeutiger Zuordnung und Sicherung entfernen.

Hash-Routing benötigt für Angular-Routen keinen Apache-Fallback. Öffentliche Links verwenden daher zum Beispiel:

- `https://dabubble-3278.developerakademie.net/#/anmeldung`
- `https://dabubble-3278.developerakademie.net/#/registrierung`
- `https://dabubble-3278.developerakademie.net/#/passwort-reset`
- `https://dabubble-3278.developerakademie.net/#/passwort-reset/neues-passwort`
- `https://dabubble-3278.developerakademie.net/#/chat/channels/CHANNEL_ID`
- `https://dabubble-3278.developerakademie.net/#/chat/direkt/GESPRAECHS_ID`

Alte Links ohne `/#/` können auf einem Server ohne wirksames Rewrite weiterhin 404 liefern. Neue Direktlinks und Lesezeichen deshalb als Hash-URLs verwenden. Firebase-Mailparameter vor dem Hash werden vom eigenen optionalen Mailhandler ausgewertet; ein fehlender oder ungültiger Code darf keine Passwortänderung ermöglichen.

Nach dem Upload manuell prüfen: Intro und Assets; Direktaufruf und Neuladen der öffentlichen sowie erlaubten dynamischen Chat-Links; Browser-Zurück; Anmeldung, Logout und Kontowechsel in zwei Tabs; Registrierung mit Avatar; echte Reset-Mail und Google-Anmeldung; Chat, Mitgliedschaften und Anwesenheit mit getrennten eigenen Konten. Desktop und Mobilansichten bis 320 px einschließlich Tastatur und Touch einbeziehen. Diese Live-Abnahme wird durch einen lokalen Build nicht nachgewiesen.

**Manuelle Live-Prüfung durch Fabian Glanzer (30.09.2026):** Das aktuelle FTP-Paket wurde hochgeladen. „Log out“ ist zentriert. Online-Status und Schreiben funktionieren auf zwei Geräten. Abmelden, erneute Anmeldung und Neuladen funktionieren ohne Sitzungsfenster oder 404. Diese Ergebnisse wurden vom Betreiber bestätigt; sie sind keine automatisierte Cloud-Prüfung.

## Wichtige Betriebsgrenzen

- **Privatsphäre:** Private Profile sind nur dem jeweiligen Konto zugänglich. Ein angemeldeten Nutzern zugängliches Verzeichnis enthält Name und Avatar zur Personenauswahl. Gespräche, Nachrichten, Threads und Reaktionen sind an Mitgliedschaften gebunden; Gastkonten umgehen diese Regeln nicht.
- **Gastzugang:** Neuladen erhält die anonyme Sitzung. „Log out“ beendet die Sitzung, löscht aber weder das Konto noch Chatdaten. Ohne vorherige Verknüpfung kann ein abgemeldeter Gast seinen bisherigen Zugang nicht mit einem erneuten Gäste-Login zurückholen. Die Bestätigung vor Gastabmeldung ist deshalb nötig. Eine Kontoumwandlung während der aktiven Sitzung erhält die UID und ihre Chatbezüge.
- **Anmeldung und Logout:** Die Anmeldung zeigt keine zusätzliche Sitzungs-Auswahl. „Log out“ beendet die Firebase-Sitzung in den Tabs desselben Browserprofils und räumt deren Chat-Abonnements und Anwesenheitsverbindungen auf. Andere Geräte behalten ihre eigene Anmeldung. Konten und Chatdaten bleiben erhalten; das Anmeldeformular wird geleert. Eine aktive Gastsitzung wird bei einem Kontowechsel erst nach bestätigter Gastabmeldung aufgegeben.
- **Google:** Normale Anmeldung und ausdrücklich bestätigte Gastumwandlung bleiben möglich. Eine separate Verknüpfung dauerhafter Konten wird nicht angeboten. Bei einer Kollision mit einem Passwortkonto bleibt dessen Zugang erhalten; die App fordert die bisherige Anmeldemethode an. Direkte Google-Anmeldung kann bei einer von Google bestätigten Adresse einen unbestätigten Passwortanbieter ersetzen; ein nachträglich abgefangener Kollisionsfehler schützt nicht in jedem Fall. Deshalb prüft die App die Zuordnung über Firebase-Verknüpfung mit einer isolierten Hilfssitzung im Arbeitsspeicher, ohne Firestore-Profil, Chat oder Anwesenheit. Entfernt wird ausschließlich ihr neu angelegtes, laut erneuter Serverabfrage noch anonymes Konto; ein verknüpftes Google-Konto bleibt erhalten. Ein vorübergehender Bereinigungsfehler wird einmal wiederholt. Bei anhaltendem Netzfehler oder Browserabbruch kann ein Auth-Hilfskonto verbleiben. Eine vollständig garantierte Bereinigung würde zusätzlich einen administrativen oder serverseitigen Ablauf benötigen. Bereits bestehende Konten werden dabei nicht gelöscht. Eine Firebase-Abmeldung beendet nicht die unabhängige Google-Sitzung im Browser.
- **Anwesenheit:** Grün bedeutet mindestens eine vom Realtime-Dienst erkannte aktive Verbindung. Bei abruptem Netzabbruch kann die Erkennung verzögert erfolgen; bei Fehlern wird kein verlässlicher Online-Status behauptet. Statuspunkte sind keine Markierung ungelesener Nachrichten.
- **Chatdaten:** Das Entfernen einer Nachricht in der Oberfläche ist keine vollständige technische Kontolöschung. Threadstruktur und andere Beiträge können erhalten bleiben. Suche arbeitet mit zugänglichen Gesprächsdaten im Client; eine Skalierungszusage für große Datenbestände besteht nicht. Erwähnungen verwenden Namen und bleiben bei Umbenennungen oder gleichen Namen eingeschränkt.
- **Designbeispiele:** `/#/vorschau`, `/#/avatar-vorschau` und `/#/meldungen-vorschau` zeigen gekennzeichnete Beispiele ohne persistente Chataktionen. Der Gäste-Login öffnet hingegen den echten Chat.
- **Datenschutz:** Betreiber- und Hostingangaben stehen unter `/#/impressum` und `/#/datenschutz`. Die Developer Akademie stellt den Webspace bereit. Weitergehende Hosting-/Vertragsangaben und unbestätigte Firebase-Speicher-, Backup- oder Löschfristen werden hier nicht ergänzt. Es gibt keine zugesagte automatische Löschung aller Projektkonten zum Projektende.

### Löschanfragen für Betreiber

Löschanfragen gehen an `fabsdev@gmx.at`. Der Link in der Datenschutzerklärung bereitet eine E-Mail vor und führt selbst keine Löschung aus. Das erhaltene Werkzeug unter [scripts/account-deletion](scripts/account-deletion) ist ausschließlich für den Betreiber bestimmt und gehört nicht auf den Webserver.

1. Kontoinhaberschaft und gewünschten Umfang bestätigen lassen; E-Mail-Absender, Anzeigename oder UID allein sind kein ausreichender Nachweis. Bei aktiven Gästen kann ein einmaliger Prüfwert als vorübergehender eigener Profilname dienen: die Änderung an der vorher festgelegten UID selbst in Firestore kontrollieren, den Wert danach verwerfen und das Zurücksetzen des Namens erlauben. Ohne aktive Gastsitzung oder anderweitig belastbare Zuordnung nicht anhand eines Namens löschen. Keine Passwörter oder Tokens anfordern.
2. Berechtigte lokale Application Default Credentials für Authentication, Firestore und Realtime Database sowie lesenden Regelzugriff verwenden. Admin-Zugänge bleiben außerhalb des Repositorys. Cloud-Aufrufe sind auf `YOUR_FIREBASE_PROJECT_ID` begrenzt; dabei dürfen `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST` und `FIREBASE_DATABASE_EMULATOR_HOST` nicht gesetzt sein.
3. Zuerst nur den Bestand planen; `BESTAETIGTE_UID` durch die eindeutig bestätigte Kennung ersetzen:

   ```sh
   npm run account:delete -- plan --cloud --project YOUR_FIREBASE_PROJECT_ID --uid "BESTAETIGTE_UID"
   ```

4. Betroffene Gespräche, eigene und fremde Beiträge sowie die Archivfolgen einzeln prüfen. Erst nach Bestätigung des konkreten Umfangs den Fingerprint aus diesem Plan einsetzen:

   ```sh
   npm run account:delete -- execute --cloud --project YOUR_FIREBASE_PROJECT_ID --uid "BESTAETIGTE_UID" --confirm "BESTAETIGTE_UID" --fingerprint "GEPRUEFTER_HASH"
   ```

5. Das Werkzeug prüft die veröffentlichten Regeln gegen die lokalen Regeln und bricht bei Abweichungen ab. Es entfernt das Auth-Konto, Profil, Verzeichniseintrag, Mitgliedschaften, eigene Reaktionen und eigene Nachrichtentexte. Fremde Antworten bleiben erhalten; erforderliche Threadwurzeln werden durch leere Platzhalter ersetzt. Reaktionen anderer Personen auf entfernte eigene Nachrichten entfallen. Erhaltene Direktnachrichten werden für verbleibende Mitglieder in ein schreibgeschütztes Archiv überführt. Fremde Texte, Zitate und gemeinsame Metadaten können weiterhin personenbezogene Angaben enthalten und benötigen eine Einzelfallentscheidung. Ergebnis und verbliebene Daten in Authentication und beiden Datenbanken kontrollieren; bei Fehlern den Vorgang prüfen, nicht wahllos Dokumente löschen.
6. Firestore- und Presence-Sperrvermerke bleiben zunächst bestehen. Die im Code festgelegten **65 Minuten** sind eine Schutzfrist gegen noch gültige Tokens nach Abschluss, keine allgemeine Aufbewahrungsfrist oder automatische Löschung. Der gesonderte Befehl `purge` bearbeitet **alle** fälligen abgeschlossenen Vorgänge ohne UID-Filter; nur nach eigener Prüfung dieses gesamten Umfangs verwenden.

Vor einem echten Löschfall sind Verwaltungszugriff, Datensicherung und die konkrete Auswirkung auf andere Beteiligte zu prüfen.
