# WhatsApp Bot fuer Bearbeiten-Ordner

Dieser Bot speichert neue WhatsApp-Gruppen-/Community-Nachrichten als Rohmaterial fuer spaetere Website-Beitraege.

Er aendert keine Website-Dateien und erstellt keine Posts. Pro passendem Nachrichtenpaket wird ein eigener Ordner in `wwwroot/img/Bearbeiten` angelegt:

```text
wwwroot/img/Bearbeiten/
  2026-05-31_14-22_bezirkswettkaempfe-hadersdorf/
    nachricht.txt
    daten.json
    analyse.txt
    kategorie.txt
    meta.json
    bild-01.jpeg
    bild-02.jpeg
```

Mehrere Bilder oder Texte, die kurz hintereinander in derselben Gruppe kommen, werden fuer `BATCH_WINDOW_MS` Millisekunden gesammelt und dann gemeinsam in einen einzigen Ordner geschrieben. Standard ist 15000, also 15 Sekunden.

Wenn der Bot fehlende Infos meldet, bleibt der Ordner fuer `FOLLOWUP_WINDOW_MS` offen. Neue Zusatzinfos aus derselben Gruppe werden dann in diesen bestehenden Ordner geschrieben statt in einen neuen.

## Start

```powershell
cd C:\Users\lukas\RiderProjects\Feuerwehr\FFRastenfeld_clean\whatsapp-bot
npm start
```

## Aktive Gruppe

```text
120363407513474923@g.us
```

## Hinweis

Der Bot speichert Rohdaten aus WhatsApp. Einsatzbilder, Alarmierungen, Kennzeichen, Namen und sensible Infos muessen vor einer Veroeffentlichung manuell geprueft werden.
