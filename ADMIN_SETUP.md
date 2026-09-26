# FF Rastenfeld – Redaktion

Die mobile Redaktion liegt unter `/admin`. Die öffentliche Blazor-Website bleibt bestehen. Netlify Functions übernehmen Anmeldung, Gemini und GitHub; Geheimnisse bleiben auf dem Server.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer und die ignorierte `.env.local` (Vorlage: `.env.example`). Im Projektordner:

```powershell
.\scripts\start-admin.ps1
# alternativ:
npm start
```

Dann http://localhost:5050/admin öffnen. Der Server läuft, solange Prozess und Laptop laufen. Er lauscht nur auf dem Laptop, nicht im WLAN.

Entwürfe, Einstellungen und Test-Veröffentlichungen landen ausschließlich im ignorierten Ordner `.admin-data`. Die echte `wwwroot/data/posts.json` und GitHub bleiben unverändert. Gemini-Aufrufe sind echte API-Aufrufe. Die öffentliche lokale Vorschau verwendet diese Testkopie. Für deren Blazor-Dateien einmal ausführen:

```powershell
dotnet publish FFRastenfeld.csproj -c Release -o .publish
```

Der alte C#-Ordner `AdminServer` ist nicht mehr der Startpunkt. Der neue Admin-Start benötigt keinen erneuten .NET-Build und vermeidet die früheren Cache-Dateisperren.

## Online auf Netlify

1. Website-Repository: `LukeX2010/FFRastenfeld2`, Branch `main`.
2. Ein **privates**, mit einem ersten Commit initialisiertes Repository für Entwürfe anlegen: `LukeX2010/ffrastenfeld-drafts`. Es enthält interne Notizen und Informationsbilder und darf nicht öffentlich sein.
3. GitHub Fine-grained Token mit `Contents: Read and write` ausschließlich für diese beiden Repositories erstellen.
4. In Netlify Variablen aus `.env.example` einrichten. Passwort-Hash, Session-Geheimnis, GitHub-Token und Gemini-Key niemals unter `wwwroot` oder in Git speichern. Falls der Tarif keine getrennten Scopes erlaubt, normale Netlify-Umgebungsvariablen verwenden: Der Build darf sie nicht in öffentliche Dateien übernehmen. Keine `PUBLIC_`- oder `VITE_`-Präfixe verwenden. Mit passenden Tarifrechten auf Functions begrenzen. Für Produktion neues starkes Passwort und Session-Geheimnis verwenden. Den im Chat geteilten API-Key vor Produktivbetrieb ersetzen.
5. Geprüften Code pushen. `netlify.toml` konfiguriert Build und Functions; `scripts/netlify-build.sh` installiert bei Bedarf .NET 8. Die bestehende Domain-Verknüpfung bleibt erhalten.
6. Nach Deploy `https://ffrastenfeld.at/admin` prüfen: Login, Entwurf speichern und auf zweitem Gerät laden, KI, anschließend freigegebenen Beitrag veröffentlichen. Dieser produktive End-to-End-Test benötigt die GitHub-Freigabe.

Passwort-Hash lokal erzeugen, nachdem `ADMIN_SETUP_PASSWORD` temporär in der eigenen Umgebung gesetzt wurde:

```powershell
node --input-type=module -e "import {passwordHash} from './server/admin.mjs'; console.log(passwordHash(process.env.ADMIN_SETUP_PASSWORD))"
```

Die temporäre Variable anschließend entfernen. `SESSION_SECRET` benötigt mindestens 32 zufällige Zeichen.

## Arbeitsweise und Grenzen

- Bilder auswählen, Titelbild markieren, Reihenfolge und Beschreibungen bearbeiten. Informationsbilder bleiben privat.
- Notizen und Anweisungen an Gemini geben, Text manuell bearbeiten oder erneut generieren. Vorheriger KI-Text kann zurückgeholt werden.
- Entwürfe und Einstellungen liegen online im privaten Repository und sind geräteübergreifend verfügbar.
- Veröffentlichung schreibt Bilder und `posts.json` gemeinsam in **einem** öffentlichen Git-Commit. Netlify baut danach neu; Änderungen werden zeitversetzt sichtbar.
- Versionskonflikte verhindern das Überschreiben zwischenzeitlicher Änderungen. Wiederholung nach Teilfehler erzeugt keinen doppelten Beitrag.
- Maximal 12 Bilder, nach Browser-Komprimierung zusammen 2,5 MB pro Entwurf, Einzelbilder maximal 900 KB.
- GitHub-, Netlify- und Gemini-Kontingente gelten. Kostenloser Betrieb hängt von Nutzung und Tarifen ab; keine unbegrenzte Gratiszusage.

## Tests

`npm test` prüft Anmeldung, CSRF-Schutz, Geheimnisschutz, Entwurfsrevisionen, Publikation, Bildfilterung, KI-Anfragen und Git-Transaktionen. Lokale Tests ersetzen nicht den abschließenden Test auf Netlify.
