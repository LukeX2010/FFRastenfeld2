# WhatsApp Redaktionsbot FF Rastenfeld

Der Bot sammelt WhatsApp-Nachrichten und Bilder lokal, erstellt optional mit Ollama einen Website-Entwurf und uebernimmt freigegebene Beitraege in die konfigurierte `posts.json`.

## Installation

1. Gemini API-Key in `.env` eintragen:

```env
AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=dein-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_USE_GOOGLE_SEARCH=true
REDACT_SENSITIVE_DATA=true
```

2. Optional: Ollama nur noch verwenden, wenn du bewusst `AI_PROVIDER=ollama` setzt.

```powershell
ollama pull llama3.1:8b
```

Falls Ollama das Modell nur als `llama3.1:latest` anzeigt:

```powershell
ollama cp llama3.1:latest llama3.1:8b
```

In `.env` sollte fuer normale Laptops der Kontext begrenzt bleiben, sonst kann Llama wegen zu viel RAM abbrechen:

```env
OLLAMA_MODEL=llama3.1:8b
OLLAMA_NUM_CTX=4096
AI_TIMEOUT_MS=180000
```

3. Bot-Abhaengigkeiten installieren:

```powershell
cd C:\Users\lukas\RiderProjects\Feuerwehr\FFRastenfeld_clean\whatsapp-bot
npm install
```

4. `.env.example` nach `.env` kopieren, falls noch nicht vorhanden, und `ALLOWED_CHAT_IDS` pruefen.

## Start

```powershell
cd C:\Users\lukas\RiderProjects\Feuerwehr\FFRastenfeld_clean\whatsapp-bot
npm start
```

Beim ersten Start den QR-Code in WhatsApp unter "Verknuepfte Geraete" scannen.

## Gruppe erlauben

In `.env`:

```env
ALLOWED_CHAT_IDS=120363407513474923@g.us
```

Wenn `PRINT_CHAT_IDS=true` ist, zeigt der Bot erkannte Gruppen-IDs in der Konsole an.

## Ablauf

Der Bot speichert Inhalte nur nach einem bewussten Startkommando. Dadurch werden normale Gruppenchats, Bot-Antworten und Vorschau-Bilder nicht versehentlich als Beitrag gespeichert.

```text
START
```

Danach sammelt der Bot Nachrichten und Bilder aus der erlaubten Gruppe fuer `BATCH_WINDOW_MS` in einem Paket und legt einen Ordner unter `wwwroot/img/Bearbeiten` an. Weitere normale Nachrichten werden dem aktiven Entwurf zugeordnet, bis du den Vorgang mit `FERTIG`, `STOP` oder `ABBRUCH` beendest.

Sobald ein Entwurf existiert, sind normale freie Nachrichten Änderungswünsche an die KI und werden nicht mehr automatisch als Zusatzinfo gespeichert. Echte Zusatzinfos müssen bewusst markiert werden:

```text
Z: keine Uhrzeit eintragen
Zusatzinfo: Ort ist Rastenfeld
```

Pro Ordner entstehen u.a.:

```text
nachricht.txt
daten.json
analyse.txt
kategorie.txt
meta.json
codex-prompt.txt
research.json
draft.json
review-state.json
bild-01.jpeg
```

Wenn Gemini erreichbar ist, erzeugt der Bot automatisch `draft.json`, `entwurf.txt` und `redaction-report.json` und sendet eine Zusammenfassung in WhatsApp. Wenn Gemini offline ist oder kein Key gesetzt ist, speichert der Bot weiter und meldet sauber, dass nur lokal abgelegt wurde.

## WhatsApp-Befehle

Diese Befehle beziehen sich immer auf den zuletzt offenen Entwurf derselben Gruppe:

```text
START / NEU
MENÜ / M
STATUS / S
VORSCHAU / V
DETAILS / D
QUELLEN / Q
RECHERCHE / R
SUCHE: <Schlagworte>
BILDER / B
BILD <nummer> JA
BILD <nummer> NEIN
BILD <nummer> TITEL
KATEGORIE: <Kategorie>
DATUM: <Datum>
UHRZEIT: <Uhrzeit>
ORT: <Ort>
OK
ÄNDERN: <Text>
STIL: kurz
STIL: ausführlich
STIL: offizieller
STIL: lockerer
STATUS
ONLINE
ONLINE TROTZDEM
FERTIG
STOP
ABBRUCH
HILFE
GIT STATUS
COMMIT: <Nachricht>
PUSH
```

- `START` oder `NEU` startet das Sammeln fuer genau einen neuen Beitrag.
- `OK` markiert den Entwurf als geprueft.
- `ÄNDERN: ...` laesst die KI den Entwurf mit deiner Anweisung ueberarbeiten.
- `MENÜ` zeigt alle Optionen fuer den aktiven Entwurf.
- `VORSCHAU` zeigt den kompletten Beitrag und sendet bis zu 5 Bilder als WhatsApp-Vorschau.
- `BILDER` verwaltet die Bildfreigabe.
- `QUELLEN` zeigt Recherchequellen aus `research.json` und Gemini Grounding.
- `RECHERCHE` startet eine passende Recherche, bei Einsaetzen aber nicht breit automatisch.
- `SUCHE: ...` startet eine bewusste gezielte Suche.
- `STATUS` zeigt den aktuellen Entwurf erneut.
- `ONLINE` schreibt den Beitrag nach `POSTS_JSON_PATH` und kopiert freigegebene Bilder nach `PUBLIC_IMAGE_DIR/<slug>/`.
- `ONLINE TROTZDEM` veroeffentlicht bewusst trotz fehlender Infos, aber nicht bei harten Datenschutz-/Sicherheitswarnungen.
- `FERTIG` verschiebt den Entwurf nach `wwwroot/img/Bearbeiten/Entwurf/` und neue Nachrichten starten wieder einen neuen Beitrag.
- `STOP` beendet die aktuelle Aufnahme, ohne neue Nachrichten weiter anzuhängen.
- `ABBRUCH` lehnt den Entwurf ab. Der lokale Ordner bleibt erhalten.
- `GIT STATUS` zeigt, welche erlaubten Dateien der Bot committen wuerde.
- `COMMIT: ...` erstellt einen Git-Commit nur mit erlaubten Website-Dateien.
- `PUSH` schiebt den letzten vorbereiteten Commit nach GitHub. Falls GitHub am Laptop ein Benutzer-/Login-Fenster zeigt, muss dieses dort bestaetigt werden.

## Datenschutz und Bilder

Bilder mit Caption wie:

```text
nein
nicht posten
intern
privat
nur info
nur kontext
```

werden niemals als Website-Bild kopiert. Sie bleiben nur im Bearbeiten-Ordner und dienen hoechstens als Kontext fuer die Erstellung.

Bei Einsaetzen gilt: keine Ursachen, Schuld, Verletzungen, Personen, Kennzeichen oder sensiblen Details erfinden. Fehlende Informationen muessen neutral formuliert oder als fehlend markiert werden.

## Online-Recherche

Die Recherche-Schnittstelle ist eingebaut, aber standardmaessig sicher deaktiviert:

```env
WEB_RESEARCH_ENABLED=true
WEB_RESEARCH_PROVIDER=bing
WEB_RESEARCH_MAX_RESULTS=5
WEB_RESEARCH_FETCH_PAGES=true
```

Mit `GEMINI_USE_GOOGLE_SEARCH=true` darf Gemini bei passenden News, Veranstaltungen, Ehrungen, Bewerben, Ausbildung und Feuerwehrjugend aktuelle Google-Suchergebnisse als Kontext verwenden. Quellenhinweise landen, soweit Gemini sie liefert, in `research.json` und `redaction-report.json`.

Mit `provider=bing` sucht der Bot zusaetzlich lokal nach passenden oeffentlichen Quellen und speichert Treffer, URLs, Snippets und teilweise kurze Seitenauszuege in `research.json`. Instagram/Facebook werden meist nur als Suchtreffer/Snippet verwendet, weil direkte Seitenabrufe oft Login oder Bot-Schutz haben.

Fuer Einsaetze bleibt Recherche automatisch sehr vorsichtig beziehungsweise deaktiviert. Online-Daten sind nur Kontext fuer die KI und werden nicht als sichere Wahrheit behandelt.

## Website-Daten

Standardmaessig liegen bestehende und neue Beitraege in:

```text
wwwroot/data/posts.json
```

Wenn die Website ihre Inhalte ohne Netlify-Deploy aus einem separaten GitHub-Pages-Content-Repository laden soll, setze in `.env` stattdessen zum Beispiel:

```env
POSTS_JSON_PATH=../../ffrastenfeld-content/posts.json
PUBLIC_IMAGE_DIR=../../ffrastenfeld-content/img/posts
```

Der genaue Ablauf ist in `../EXTERNAL_CONTENT.md` beschrieben.

Vor jeder Aenderung erstellt der Bot ein Backup unter:

```text
wwwroot/data/backups/
```

Freigegebene neue Bilder landen unter:

```text
wwwroot/img/posts/<slug>/
```

## Checks

```powershell
npm run check
```

Der Check validiert `posts.json` und importiert die Kernmodule. Doppelte alte Slugs werden als Hinweis gemeldet, vorhandene IDs duerfen nicht doppelt sein.

## Migration

Falls `posts.json` neu aus `Services/DataService.cs` erstellt werden soll:

```powershell
npm run migrate:posts
```

Das Script ueberschreibt vorhandene Daten nicht blind. Wenn `posts.json` existiert, wird ein Backup erstellt und ohne `--force` nicht geschrieben.
