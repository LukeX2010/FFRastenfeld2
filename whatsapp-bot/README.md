# WhatsApp Bot fuer Bearbeiten-Ordner

Dieser Bot speichert neue WhatsApp-Gruppen-/Community-Nachrichten als Rohmaterial fuer spaetere Website-Beitraege.

Er aendert keine Website-Dateien und erstellt keine Posts. Pro passender Nachricht wird ein eigener Ordner in `wwwroot/img/Bearbeiten` angelegt:

```text
wwwroot/img/Bearbeiten/
  2026-05-31_14-22_bezirkswettkaempfe-hadersdorf/
    nachricht.txt
    meta.json
    bild-01.jpeg
    bild-02.jpeg
```

## Einrichtung

```powershell
cd whatsapp-bot
npm install
Copy-Item .env.example .env
npm start
```

Beim ersten Start erscheint ein QR-Code. Diesen mit WhatsApp am Handy unter "Verknuepfte Geraete" scannen.

## Gruppe/Community auswaehlen

Beim Start ist `SAVE_ALL_GROUPS=false`. Der Bot speichert dann noch nichts, zeigt aber Gruppen-IDs in der Konsole an.

1. Bot starten.
2. In der gewuenschten Gruppe eine Testnachricht schicken.
3. Die angezeigte ID, z.B. `120363123456789012@g.us`, in `.env` eintragen:

```env
ALLOWED_CHAT_IDS=120363123456789012@g.us
IGNORE_OWN_MESSAGES=false
```

4. Bot neu starten.

Danach speichert der Bot nur Nachrichten aus diesen Gruppen.

Mehrere Bilder oder Texte, die kurz hintereinander in derselben Gruppe kommen, werden fuer `BATCH_WINDOW_MS` Millisekunden gesammelt und dann gemeinsam in einen einzigen Ordner geschrieben. Standard ist 15000, also 15 Sekunden.

Wenn der Bot fehlende Infos meldet, bleibt der Ordner fuer `FOLLOWUP_WINDOW_MS` offen. Neue Zusatzinfos aus derselben Gruppe werden dann in diesen bestehenden Ordner geschrieben statt in einen neuen.

Der Bot antwortet in WhatsApp mit:

- gespeicherter Kategorie
- Anzahl Bilder
- Ordnername
- fehlenden Infos wie Datum, Ort oder Uhrzeit

Wenn Infos fehlen, am besten mit dieser Vorlage antworten:

```text
Kategorie: FF-News
Datum: 31.05.2026
Ort: Rastenfeld
Beschreibung: kurzer Inhalt fuer den Bericht
```

Der Bot schreibt diese strukturierten Infos in `daten.json`. Kurze Antworten wie `Niedergruenbach` werden als Ort gewertet, wenn vorher der Ort gefehlt hat.

## Wichtiger Datenschutz

Der Bot speichert Rohdaten aus WhatsApp. Einsatzbilder, Alarmierungen, Kennzeichen, Namen und sensible Infos muessen vor einer Veroeffentlichung manuell geprueft werden.
