# DaBubble

Angular-Abschlussprojekt mit TypeScript Strict Mode, Figma-Oberflächen für Desktop und Mobilgeräte sowie Firebase Authentication, Firestore-Profilen und persistenten Gesprächen. Stand: 24.09.2026.

## Lokal starten

Voraussetzungen: Node gemäß `package.json` (getestet mit 24.20.0), npm (11.19.0).

```sh
npm ci
npx playwright install chromium
npm start -- --host 127.0.0.1
```

Öffne die App für Cloud-Tests unter `http://localhost:4200`. Im eigenen Firebase-Projekt ist `localhost` als Domain freigegeben; `127.0.0.1` ist derzeit nicht freigegeben und führt beim Passwort-Reset zu `UNAUTHORIZED_DOMAIN`. Der obige lokale Server ist auch über `localhost` erreichbar. Für Auth-/Firestore-Emulatortests wird zusätzlich Java 21+ im PATH benötigt. Sie brauchen weder ein Cloud-Projekt noch eine Firebase-Anmeldung.

## Bedienung und aktueller Funktionsumfang

- `/intro`: fünfsekündige Animation mit Überspringen und Reduced Motion. Ein Klick auf das DABubble-Logo öffnet `/intro?replay=true` und spielt sie erneut vor der Anmeldung ab.
- `/anmeldung`, `/registrierung`, `/avatar-auswahl`: E-Mail-/Passwort-Anmeldung, Registrierung, eigene Avatar-/Profilanlage, Feldfehler und Ladezustände. Unterbrochene Profilanlage lässt sich nach Anmeldung vervollständigen; ein noch nicht gespeicherter Name muss nach Neuladen erneut eingegeben werden.
- `/passwort-reset`: Reset anfordern. `/passwort-reset/neues-passwort` prüft den Firebase-Aktionscode, bevor ein neues Passwort gespeichert werden kann.
- `/chat` und `/avatar-auswahl` sind geschützt. Anmeldung bleibt nach Neuladen erhalten; Abmeldung wirkt auch in anderen offenen Tabs. Das eigene Profil lässt sich mit Name und Avatar ändern.
- `/vorschau`, `/avatar-vorschau` und `/meldungen-vorschau` sind ausdrücklich öffentliche Designbeispiele und erzeugen keine Anmeldung.
- Menü, Channel-/Direktansichten, neue Nachricht, Suche, Thread, Profile und Dialoge sind bedienbar. Mobil sind Menü, Suche, Gespräch und Thread getrennte Ansichten; Browser-Zurück, Dialogschließen und Tastaturfokus werden berücksichtigt.
- `/chat` verwendet Firestore: Channels erstellen und bearbeiten, Mitglieder hinzufügen und austreten, Nachrichten senden/bearbeiten/löschen, Direktnachrichten, Threads und Emoji-Reaktionen. Suche und Erwähnungen greifen auf eigene Gespräche und das Benutzerverzeichnis zu. `/vorschau` behält alle bisherigen Figma-Beispiele und lokalen Entwürfe. Google-/Gäste-Login und echte Presence fehlen weiterhin.
- `/impressum` und `/datenschutz` enthalten nur die vorbereitete Struktur; Betreiberangaben und freigegebene Rechtstexte fehlen.

`public/firebase-config.json` verbindet die App mit dem eigenen Firebase-Projekt `YOUR_FIREBASE_PROJECT_ID` und der Firestore-Datenbank `(default)`; `emulators` ist `false`. Die vier öffentlichen Web-App-Werte wurden vom Projektinhaber bereitgestellt. Analytics wird nicht initialisiert. Registrierung, Avatar-/Profilanlage, Abmeldung, erneute Anmeldung und Sitzungswiederherstellung wurden am echten Projekt bei Desktopbreite und 375 px geprüft; Name und Avatar wurden geändert und nach Neuladen sowie direkt aus Firestore bestätigt. Der echte Passwort-Reset wurde mit einem bestehenden Konto geprüft; die genaue Abgrenzung zwischen automatischem Nachweis und Nutzerbestätigung steht unten.

## Eigenes Firebase-Projekt einrichten

1. In der [Firebase Console](https://console.firebase.google.com/) ein eigenes Projekt und unter **Projekteinstellungen → Allgemein** eine Web-App anlegen. Hosting und Analytics werden für die Anbindung nicht benötigt.
2. Unter **Authentication → Anmeldemethode** E-Mail/Passwort aktivieren; Schutz vor E-Mail-Enumeration beibehalten.
3. Unter **Firestore Database** die Standard-Datenbank `(default)` im Produktionsmodus anlegen und die Region wählen. Die Regeln aus [firestore.rules](firestore.rules) im eigenen Projekt einsetzen, bevor die Anbindung genutzt wird. Keine offenen Testregeln verwenden.
4. Unter **Authentication → Einstellungen → Autorisierte Domains** die benötigten lokalen Domains (`localhost`, `127.0.0.1`) und später die tatsächliche Website-Domain eintragen, jeweils ohne Protokoll/Port.
5. Für die eigene Reset-Maske in der Passwort-Reset-Mailvorlage die Aktions-URL lokal auf `http://localhost:4200/passwort-reset/neues-passwort` setzen; später auf dieselbe Route unter der eigenen HTTPS-Domain. Die Aktions-URL ist von der Weiterleitungs-URL nach dem Reset zu unterscheiden. Absender und Mailtext prüfen.
6. Aus der eigenen Web-App-Konfiguration **`apiKey`, `authDomain`, `projectId`, `appId`** bereitstellen. Diese vier öffentlichen Clientwerte gehören in das Objekt `firebase` der Konfigurationsdatei; `emulators` bleibt für die Cloud `false`. Keine fremden Werte, Passwörter, Service-Account-Dateien oder privaten Schlüssel eintragen.
7. Anschließend mit zwei Testkonten Registrierung, Avatar, Logout/Login, Reload, Profiländerung und eine echte Reset-Mail prüfen. Dafür wird Zugriff auf die Testpostfächer benötigt. Hosting muss bei einem späteren Deployment direkte Angular-Routen auf `index.html` zurückführen.

Die Webkonfiguration ist kein Serverschlüssel. Firebase Authentication und Firestore-Regeln sichern den Zugriff. `users/{uid}` enthält nur `uid`, `name`, `avatarId`, `createdAt`, `updatedAt`; E-Mail und Passwort werden nicht in Firestore-Profilen gespeichert. Nur der Eigentümer darf sein Profil lesen/anlegen und Name/Avatar ändern. Auflisten, Löschen, fremde Zugriffe, zusätzliche Felder und Änderungen unveränderlicher Daten sind gesperrt. Die neuen Gesprächsregeln sind unten beschrieben.

Vor der Chat-Erweiterung war die Regeldatei auf Benutzerprofile beschränkt und durch 20 Emulatortests geprüft. Der Projektinhaber hat inzwischen auch die Veröffentlichung der erweiterten Chat-Regeln für `YOUR_FIREBASE_PROJECT_ID → (default)` bestätigt. Bei der früheren Cloud-Prüfung wurden mit einem bestehenden Konto eigene Profil-Lesezugriffe und ein gültiges Update von `updatedAt` mit Serverzeitstempel mit HTTP 200 bestätigt. Name, Avatar, UID und Erstellungszeit blieben gleich. Anonyme und fremde Profil-Lesezugriffe, dieselbe gültige Schreiboperation auf einen fremden Profilpfad und Benutzerauflistung wurden mit HTTP 403 abgewiesen. Das fremde Ziel war ein zuvor angelegtes Testprofil; seine aktuelle Existenz wurde nicht erneut über eine Eigentümersitzung nachgewiesen. Projekt und Datenbank waren im REST-Endpunkt explizit festgelegt, das Firebase-ID-Token gehörte zu `YOUR_FIREBASE_PROJECT_ID`. Kein Emulator und kein Admin-Zugang wurden dafür verwendet. Der veröffentlichte Regeltext konnte nicht unabhängig ausgelesen und mit der lokalen Datei verglichen werden.

Beim echten Reset-Test wurde die erste Anfrage über `127.0.0.1` wegen der fehlenden Domainfreigabe abgelehnt. Über das bereits freigegebene `localhost` nahm Firebase genau eine Reset-Mail-Anfrage mit HTTP 200 an. Eingang und Passwortänderung bestätigte der Nutzer in einem anderen Browser. Die anschließende frische Cloud-Anmeldung mit dem vom Nutzer eingegebenen neuen Passwort, das Lesen des eigenen Profils und die Sitzungswiederherstellung nach Reload wurden direkt geprüft; dabei traten keine unbehandelten Browserfehler auf. Die Passwortänderungs-Antwort selbst, die Ablehnung des alten Passworts und die eigene Angular-Reset-Linkansicht wurden in diesem Cloud-Durchlauf nicht unabhängig geprüft. Die Domainfreigaben wurden nicht geändert.

Der frühere Cloud-Browsertest verwendete zwei getrennte Konten. Insgesamt entstanden damals einschließlich eines ersten Prüflaufs drei klar benannte Testkonten (`dabubble-cloud-…@example.test`) mit Profilen; ihre zufälligen Passwörter wurden nicht gespeichert. Bei der erneuten Regel- und Reset-Prüfung wurden keine weiteren Konten angelegt. Lokale Prüfberichte und Screenshots liegen ignoriert unter `tmp/cloud-audit/`; Passwörter, ID-Tokens und Reset-Codes werden darin nicht gespeichert.

## Chat-Regeln und manuelle Cloud-Prüfung

Die vollständigen Regeln stehen in [firestore.rules](firestore.rules). Ihre Veröffentlichung unter **YOUR_FIREBASE_PROJECT_ID → Firestore Database → (default) → Regeln** wurde vom Projektinhaber bestätigt. Der Agent hat weder Regeln noch Anwendung deployt. Die automatisierten Chat-Tests verwenden ausschließlich Emulatoren; die folgenden Cloud-Prüfungen wurden vom Projektinhaber selbst durchgeführt.

**Manuell geprüft durch den Projektinhaber:**

- Cloud-Chat mit zwei Konten auf PC und Handy geprüft.
- Channels, Nachrichten, Threads und Emoji-Reaktionen wurden in Echtzeit synchronisiert.
- Ein drittes Konto ohne Mitgliedschaft konnte den fremden Channel und seine Nachrichten nicht lesen.

Diese Ergebnisse sind Nutzerbestätigungen, keine unabhängig vom Agenten ausgeführten Cloud-Tests. Direktnachrichten, Bearbeiten/Löschen, Mitgliedschaftsänderungen und die Ablehnung fremder Schreibzugriffe sind durch diese Rückmeldung nicht als manuell in der Cloud geprüft belegt. Geräte, Betriebssysteme und Browser wurden nicht näher angegeben.

| Datenpfad                                      | Inhalt und Zugriff                                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                                  | Bisheriges privates Profil; nur Eigentümerzugriff.                                                                                                                           |
| `directory/{uid}`                              | Nur UID, Name, Avatar und Änderungszeit. Angemeldete dürfen lesen; jeder schreibt nur seine eigenen, mit dem privaten Profil übereinstimmenden Werte. Keine E-Mail-Adressen. |
| `conversations/{id}`                           | Channel oder deterministische Direktkonversation mit Teilnehmerliste; nur Mitglieder lesen. Direktnachrichten haben ein oder zwei unveränderliche Teilnehmer.                |
| `channelNames/{nameKey}`                       | Atomare Reservierung normalisierter Namen verhindert Duplikate. Kein Auflisten; angemeldete Nutzer können einzelne Reservierungen prüfen.                                    |
| `conversations/{id}/messages/{messageId}`      | Mitglieder lesen/senden. Nur Verfasser bearbeiten oder löschen ihren Inhalt dauerhaft per Tombstone. Antworten referenzieren eine Hauptnachricht desselben Gesprächs.        |
| `conversations/{id}/reactions/{messageId_uid}` | Jeder verändert nur seine Emoji-Auswahl. Zähler und Namen werden aus den einzelnen Reaktionen berechnet.                                                                     |

Jedes Channel-Mitglied darf weitere registrierte Personen hinzufügen, selbst austreten und Name/Beschreibung bearbeiten. Niemand darf andere Mitglieder entfernen, eine Direktnachricht um Teilnehmer erweitern oder fremde Nachrichten/Reaktionen verändern. Ein Austritt entzieht auch Zugriff auf Nachrichten, Threads und Reaktionen. Unbekannte Pfade bleiben gesperrt. Schreibregeln prüfen Schema, unveränderliche Felder und Serverzeitstempel.

Bedienung: Channel über **+ / Channel hinzufügen** erstellen und danach über den Mitgliederknopf einladen. Direktnachrichten beginnen über **Neue Nachricht → @Name**. **Enter** sendet, **Shift+Enter** erzeugt eine neue Zeile. Nachrichtenaktionen erscheinen am Desktop bei Hover/Fokus und mobil über den Drei-Punkte-Knopf. Threads lassen sich schließen oder mit Browser-Zurück verlassen. Erneutes Wählen entfernt eine Reaktion; **Wer hat reagiert?** zeigt die Namen auch per Touch. Mobil und im Thread sind zunächst sieben Emoji-Arten sichtbar. Die Aktionsleiste merkt sich die letzten beiden Emoji-Arten innerhalb der Sitzung.

Technische Grenzen: 4000 Zeichen pro Nachricht, 80 pro Channel-Name (a–z/äöüß, Zahlen, Leerzeichen, -/_), 1000 für Beschreibungen, 100 Mitglieder. Mehrere Einladungen werden einzeln bestätigt; bei Fehlern bleiben zuvor erfolgreiche Einladungen bestehen. Nach Austritt des letzten Mitglieds bleibt der Channel mit reserviertem Namen erhalten. Es gibt keine Channel-Löschfunktion, Dateianhänge oder Presence-Attrappe. Bestehende Konten erscheinen im Verzeichnis nach ihrem ersten Besuch des neuen Chats. Erwähnungen verwenden sichtbare Namen; doppelte oder später geänderte Namen sind dadurch nicht dauerhaft eindeutig zugeordnet.

Für das Abschlussprojekt werden Nachrichten/Reaktionen aller eigenen Gespräche live geladen und lokal durchsucht. Für große Datenmengen fehlen Pagination und ein gesonderter Suchindex. Beim Offline-Senden vor Übermittlung bleibt der Entwurf erhalten. Eine bereits laufende Übermittlung wartet nach Verbindungsabbruch auf die Firebase-Bestätigung; wiederholtes Absenden ist solange gesperrt. Die oben genannten Cloud-Chat-Abläufe auf PC und Handy sind manuell bestätigt; weitergehende Cloud- und Geräteprüfungen bleiben offen.

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
| `npm run test:firebase` | Build, Emulatoren, 32 Regeltests, 9 Auth- und 4 Chat-Browserabläufe    |
| `npm run check:secrets` | Private Schlüssel/Token in Arbeitsdateien und Git-/Reflog-Blobs suchen |
| `npm run check`         | Typecheck, Lint, Format, Dateilängen, Build und Browsertests           |

Die Browsertests laden den Build über lokale Request-Interception. Firebase-Tests erlauben ausschließlich die lokalen Emulator-Ursprünge: Authentication `127.0.0.1:9099`, Firestore `127.0.0.1:8080`. Der reservierte Namensraum `demo-dabubble-auth` ist keine Cloud-Projektkennung. Testpasswörter werden bei jedem Lauf generiert; Emulatorzustand, Logs und Screenshots bleiben ignoriert. Ein bereits gestarteter Emulator auf diesen Ports muss vorher beendet werden.

Chat-Abgleich am 24.09.2026: Build, Strict-Typecheck, Lint, Format, Dateilängen und Geheimnisprüfung bestanden; 32 Regeltests und insgesamt 50 Browsertests (37 bisherige Oberflächen-, 9 Auth-, 4 Chat-Tests) bestanden. Zwei getrennte Browserkonten prüften Live-Empfang, Bearbeiten/Löschen, gemeinsame Reaktionen, Channel-/private Threads, Suche, Reload und Austritt. Screenshots bei 320/375/430/1920 px liegen unter `tmp/auth-audit/browser-results/`; Figma-Farben, Originalassets und Layout wurden abgeglichen. Kein horizontaler Seitenüberlauf, keine unerwarteten Browserfehler. Alle neu angelegten Testkonten existierten ausschließlich im lokalen Emulator.

Die Emulatoren stellen keine E-Mails zu. Die Tests lesen lokale Reset-Codes und verwenden die echte Anwendungsroute. Erwartete negative Auth-Antworten (HTTP 400) und beim Logout/Neuladen abgebrochene Firestore-Listen-/Write-Verbindungen sind von unerwarteten Konsolenfehlern abgegrenzt. Der gezielte Offline-Test erwartet die künstlich ausgelösten lokalen Netzwerkfehler; die SDK-Konnektivitätsprobe wird lokal beantwortet. Profil-, Channel-, Nachrichten-, Thread- und Reaktionsrechte werden mit Alice, Bob und einem Nichtmitglied positiv und negativ geprüft. Reale Mailzustellung, Cloud-Passwortpolicy und zeitlicher Ablauf echter Reset-Links müssen separat geprüft werden.

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

Mobilansichten wurden bei 320, 375 und 430 px verglichen, Desktop bis 1920 px geprüft. Die mobilen Originalframes messen 430 × 932 px; kleinere Breiten sind responsive Ableitungen. Öffentliche Vorschauen behalten Hinweise und deaktivierte Datenaktionen. Der echte Chat verwendet dieselben Layout-/Nachrichtenstyles mit echten Daten. Touch-Aktionsleisten klappen innerhalb der Nachricht auf, damit sie keine Nachbarn verdecken. Echte Inhalte, Fehlerzustände und Reaktionsnamen verursachen kleinere Abweichungen zu den Figma-Beispielen. Touch, Tastatur, Intro und Browser-Verlauf sind in Chromium geprüft. Zusätzlich hat der Projektinhaber die oben genannten Cloud-Abläufe auf PC und Handy manuell geprüft; gezielte Android-/iOS-, Bildschirmtastatur-, Safe-Area- und Safari-Prüfungen sind damit noch nicht belegt.

Lokale Screenshots/Analysen bleiben unter `test-results/` und `tmp/`; sie werden nicht versioniert. Die vollständige Abschlusscheckliste ist wegen der noch offenen vollständigen Reset-Link-Abnahme, weitergehenden Cloud-Chat-Abnahme, Rechtstexte und Veröffentlichung der Anwendung nicht erfüllt. Für den abschließenden Reset-Abgleich ist die echte Mail-Aktions-URL mit der eigenen Angular-Reset-Maske zu prüfen; außerdem bleiben die Abweisung des alten Passworts und der direkte Abgleich des veröffentlichten Regeltexts offen. Push, Veröffentlichung durch den Agenten und Deployment sind nicht Bestandteil dieser Prüfung.
