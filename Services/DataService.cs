using FFRastenfeld.Models;

namespace FFRastenfeld.Services;

public class DataService
{
    // ── POSTS (Einsätze + News + Ausbildung + Jugend) ─────────────────────────
    public List<Post> GetPosts() => new()
    {
        new Post
        {
            Id = 1, Slug = "zimmerbrand-ortszentrum", Titel = "Zimmerbrand im Ortszentrum", Kategorie = "Einsätze",
            Datum = new DateTime(2025, 3, 15, 3, 17, 0),
            Kurztext =
                "In den frühen Morgenstunden wurden die Einsatzkräfte zu einem Zimmerbrand alarmiert. Starke Rauchentwicklung erschwerte die Löscharbeiten.",
            Volltext =
                "Um 03:17 Uhr wurde die FF Rastenfeld zu einem Zimmerbrand im Ortszentrum alarmiert. Beim Eintreffen der ersten Kräfte drang starker Rauch aus den Fenstern des Erdgeschoßes. Drei Atemschutztrupps gingen zur Brandbekämpfung vor. Die Bewohner konnten das Gebäude rechtzeitig verlassen und blieben unverletzt. Nach rund 90 Minuten konnte der Einsatz beendet werden.",
            BildPlaceholder = "🏠", EinsatzTyp = "B2 – Zimmerbrand", EinsatzOrt = "Rastenfeld, Ortszentrum",
            EinsatzZeit = "03:17 Uhr", EinsatzKraefte = 18
        },

        new Post
        {
            Id = 2, Slug = "verkehrsunfall-b35", Titel = "Verkehrsunfall mit eingeklemmter Person – B35",
            Kategorie = "Einsätze",
            Datum = new DateTime(2025, 2, 28, 7, 45, 0),
            Kurztext =
                "Auf der B35 kam es zu einem schweren Verkehrsunfall. Eine Person musste durch hydraulisches Rettungsgerät befreit werden.",
            Volltext =
                "Am frühen Morgen ereignete sich auf der B35 Richtung Zwettl ein Verkehrsunfall, bei dem ein PKW von der Fahrbahn abkam und mit der Leitplanke kollidierte. Die Fahrerin war im Fahrzeug eingeklemmt und musste mittels Spreizer und Schere befreit werden. Nach rund 35 Minuten konnte die verletzte Person dem Rettungsdienst übergeben werden.",
            BildPlaceholder = "🚗", EinsatzTyp = "T2 – Verkehrsunfall", EinsatzOrt = "B35 bei Rastenfeld",
            EinsatzZeit = "07:45 Uhr", EinsatzKraefte = 14
        },

        new Post
        {
            Id = 3, Slug = "waldbrand-ottenstein", Titel = "Waldbrand im Bereich Stausee Ottenstein",
            Kategorie = "Einsätze",
            Datum = new DateTime(2024, 7, 14, 14, 22, 0),
            Kurztext = "Ausgedehnter Waldbrand am Ufer des Stausees Ottenstein. Mehrere Feuerwehren im Großeinsatz.",
            Volltext =
                "Durch die anhaltende Trockenheit brach am Ostufer des Stausees Ottenstein ein Waldbrand aus. Mehrere Feuerwehren des Abschnitts Krems rückten aus. Das TLF 4000 der FF Rastenfeld übernahm die Wasserversorgung aus dem Stausee. Nach rund vier Stunden konnte das Feuer unter Kontrolle gebracht werden. Ein Übergreifen auf Wohngebiet konnte verhindert werden.",
            BildPlaceholder = "🌲", EinsatzTyp = "B3 – Waldbrand", EinsatzOrt = "Stausee Ottenstein",
            EinsatzZeit = "14:22 Uhr", EinsatzKraefte = 32
        },

        new Post
        {
            Id = 4, Slug = "unwetter-sturm-rastenfeld", Titel = "Sturmschäden im gesamten Gemeindegebiet",
            Kategorie = "Einsätze",
            Datum = new DateTime(2024, 5, 19, 18, 10, 0),
            Kurztext =
                "Nach einem Unwetter musste die FF Rastenfeld zu zahlreichen Sturmeinsätzen ausrücken. Bäume blockierten mehrere Straßen.",
            Volltext =
                "Ein heftiges Unwetter zog über das Gemeindegebiet Rastenfeld und hinterließ zahlreiche Sturmschäden. Die FF Rastenfeld rückte zu insgesamt 11 Einsatzstellen aus. Umgestürzte Bäume blockierten die Zufahrt zur B37 sowie mehrere Gemeindestraßen. Keller wurden ausgepumpt, Dächer gesichert.",
            BildPlaceholder = "⛈️", EinsatzTyp = "S1 – Sturm", EinsatzOrt = "Gemeindegebiet Rastenfeld",
            EinsatzZeit = "18:10 Uhr", EinsatzKraefte = 22
        },

        new Post
    {
        Id = 5,
        Slug = "gma-brand-steininger",
        Titel = "GMA-Brand bei Gebrüder Steininger",
        Kategorie = "Einsätze",
        Datum = new DateTime(2025, 12, 17, 21, 27, 0),
        Kurztext =
            "Auslösung einer Brandmeldeanlage bei der Firma Gebrüder Steininger in Rastenfeld.",
        Volltext =
            "Am 17.12.2025 wurde die Feuerwehr zu einer ausgelösten Brandmeldeanlage bei der Firma Gebrüder Steininger alarmiert. Nach Kontrolle des betroffenen Bereichs konnte kein Brand festgestellt werden. Die Anlage wurde zurückgestellt und der Einsatz beendet.",
        BildPlaceholder = "🚒",
        EinsatzTyp = "B1 – GMA-Brand",
        EinsatzOrt = "Rastenfeld 168",
        EinsatzZeit = "21:27 Uhr",
        EinsatzKraefte = 0
    },

    new Post
    {
        Id = 6,
        Slug = "vu-menschenrettung-rastenberg",
        Titel = "Verkehrsunfall mit Menschenrettung",
        Kategorie = "Einsätze",
        Datum = new DateTime(2025, 11, 25, 17, 56, 0),
        Kurztext =
            "Verkehrsunfall mit eingeklemmter Person auf der L8245 bei Rastenberg.",
        Volltext =
            "Am 25.11.2025 wurde die Feuerwehr zu einem Verkehrsunfall mit Menschenrettung alarmiert. Zwei PKW kollidierten auf der L8245 bei Rastenberg, wobei eine Person im Fahrzeug eingeklemmt wurde. Die Einsatzkräfte sicherten die Unfallstelle und unterstützten bei der Rettung der Person.",
        BildPlaceholder = "🚒",
        EinsatzTyp = "T2 – VU mit Menschenrettung",
        EinsatzOrt = "L8245 km 14.2, Rastenberg",
        EinsatzZeit = "17:56 Uhr",
        EinsatzKraefte = 14
    },

    new Post
    {
        Id = 7,
        Slug = "bergung-pkw-b38",
        Titel = "PKW-Bergung nach Auffahrunfall",
        Kategorie = "Einsätze",
        Datum = new DateTime(2026, 1, 27, 17, 35, 0),
        Kurztext =
            "Auffahrunfall auf der B38 bei Rastenfeld – keine Verletzten.",
        Volltext =
            "Am 27.01.2026 wurde die Feuerwehr zu einer PKW-Bergung auf die B38 alarmiert. Nach einem Auffahrunfall mussten die beteiligten Fahrzeuge von der Fahrbahn entfernt werden. Glücklicherweise gab es keine Verletzten.",
        BildPlaceholder = "🚒",
        EinsatzTyp = "T1 – Bergung PKW",
        EinsatzOrt = "B38 km 30, Rastenfeld",
        EinsatzZeit = "17:35 Uhr",
        EinsatzKraefte = 8
    },

    new Post
    {
        Id = 8,
        Slug = "gma-brand-hotel-ottenstein",
        Titel = "GMA-Alarm im Hotel Ottenstein",
        Kategorie = "Einsätze",
        Datum = new DateTime(2025, 12, 20, 23, 50, 0),
        Kurztext =
            "Auslösung einer Brandmeldeanlage im Hotel Ottenstein.",
        Volltext =
            "Am 20.12.2025 wurde die Feuerwehr zu einer ausgelösten Brandmeldeanlage im Hotel Ottenstein alarmiert. Nach Kontrolle vor Ort konnte kein Brand festgestellt werden. Die Anlage wurde überprüft und zurückgesetzt.",
        BildPlaceholder = "🚒",
        EinsatzTyp = "B1 – GMA-Brand",
        EinsatzOrt = "Peygarten-Ottenstein 60",
        EinsatzZeit = "23:50 Uhr",
        EinsatzKraefte = 0
    },

        new Post
        {
            Id = 12, Slug = "kinderfeuerwehr-besuch", Titel = "Kinderfeuerwehr besucht das Feuerwehrhaus",
            Kategorie = "Feuerwehrjugend",
            Datum = new DateTime(2024, 4, 20),
            Kurztext =
                "20 Kinder der Volksschule Rastenfeld besuchten das Feuerwehrhaus und lernten spielerisch die Arbeit der Feuerwehr kennen.",
            Volltext =
                "Im Rahmen der Kinderfeuerwehr besuchten 20 Schülerinnen und Schüler der Volksschule Rastenfeld das Feuerwehrhaus. Sie lernten die Fahrzeuge kennen, durften den Schlauch ausrollen und erfuhren, was zu tun ist, wenn es brennt. Notruf 122 und der richtige Umgang mit Feuer standen im Mittelpunkt.",
            BildPlaceholder = "🧒"
        },
        new Post
        {
            Id = 13,
            Slug = "schwimmpumpe",
            Titel = "Anschaffung einer Schwimmpumpe",
            Kategorie = "FF-News",
            Datum = new DateTime(2026, 4, 2),
            Kurztext =
                "Neue Schwimmpumpe wurde durch Unterstützung der Gemeinde Rastenfeld angekauft.",
            Volltext =
                "Die Freiwillige Feuerwehr Rastenfeld konnte kürzlich eine neue Schwimmpumpe in den Dienst stellen. " +
                "Die Anschaffung wurde durch die Unterstützung der Gemeinde Rastenfeld ermöglicht. Die Pumpe kommt vor" +
                " allem bei Einsätzen mit offenen Gewässern wie Teichen oder Bächen zum Einsatz und stellt eine wichtige " +
                "Ergänzung für die Wasserversorgung bei Bränden dar. Durch die neue Ausrüstung kann die Feuerwehr noch " +
                "schneller und effizienter Hilfe leisten.",
            BildPlaceholder = "🚒"
        },
        new  Post{
            Id = 14,
            Slug = "mosertronik-begehung",
            Titel = "Sicherheit durch Zusammenarbeit",
            Kategorie = "FF-News",
            Datum = new DateTime(2026, 3, 27),
            Kurztext =
                "Gemeinsame Gebäudebegehung bei der Mosertronik GmbH zur Verbesserung der Einsatzvorbereitung.",
            Volltext =
                "Kürzlich besuchte eine Abordnung der Freiwilligen Feuerwehr Rastenfeld die Mosertronik GmbH im Rahmen einer gemeinsamen Gebäudebegehung. Ziel dieser Besichtigung war es, wichtige Einblicke in die betrieblichen Abläufe sowie die örtlichen Gegebenheiten zu gewinnen.\n\nDurch das frühzeitige Kennenlernen von Zufahrtswegen, technischen Anlagen und möglichen Gefahrenstellen kann im Ernstfall schneller und gezielter reagiert werden. Solche Begehungen leisten einen wichtigen Beitrag zur optimalen Einsatzvorbereitung.\n\nDie Feuerwehr bedankt sich bei der Mosertronik GmbH für die Einladung sowie die konstruktive und professionelle Zusammenarbeit.",
            BildPlaceholder = "🔍🚒"
        },
    };

    public Post? GetPost(string slug) => GetPosts().FirstOrDefault(p => p.Slug == slug);

    public List<Post> GetByKategorie(string kat) =>
        GetPosts().Where(p => p.Kategorie == kat).OrderByDescending(p => p.Datum).ToList();

    public List<Post> GetEinsaetze() => GetByKategorie("Einsätze");

    // ── FAHRZEUGE ────────────────────────────────────────────────────────────
    public List<Fahrzeug> GetFahrzeuge() => new()
    {
        new Fahrzeug
        {
            Id = 1,
            Name = "Tanklöschfahrzeug 4000",
            Kuerzel = "scaniaP340",
            Beschreibung =
                "Das Tanklöschfahrzeug 4000 dient zur Brandbekämpfung bei Bränden mit hohem Wasserbedarf, insbesondere bei Wald- und Flurbränden sowie in Gebieten ohne ausreichende Wasserversorgung.",
            Baujahr = "2019",
            Hersteller = "Rosenbauer / Scania P340",
            Emoji = "🚒",
            Ausstattung = new()
            {
                "4.000 L Wassertank",
                "Einbaupumpe ca. 2.000 l/min",
                "Schaummittelanlage",
                "Schnellangriffseinrichtung",
                "Mehrere Atemschutzgeräte",
                "Wärmebildkamera",
                "Lichtmast",
                "Schlauchmaterial für lange Zubringerleitungen"
            }
        },

        new Fahrzeug
        {
            Id = 2,
            Name = "Mannschaftstransportfahrzeug",
            Kuerzel = "MTF",
            Beschreibung =
                "Das Mannschaftstransportfahrzeug dient primär zum Transport von Feuerwehrmitgliedern und Ausrüstung zu Einsätzen, Übungen und Veranstaltungen. Es wird auch für logistische Aufgaben eingesetzt.",
            Baujahr = "2016",
            Hersteller = "Ford Transit / ähnlich",
            Emoji = "🚒",
            Ausstattung = new()
            {
                "Sitzplätze für Mannschaft",
                "Funkgerät",
                "Grundausstattung Erste Hilfe",
                "Warnwesten",
                "Transportmöglichkeit für Material",
                "Absicherungsmaterial (Pylonen, Lampen)"
            }
        },
    };

// ── MITGLIEDER ──────────────────────────────────────────────────────────
    public List<Mitglied> GetMitglieder() => new()
{
    new Mitglied { Id=1, Name="Matthias Goll", Dienstgrad="Hauptbrandinspektor", Funktion="Kommandant", EintriebAb=2005, IstFuehrung=true },
    new Mitglied { Id=2, Name="Stefan Schulmeister", Dienstgrad="Brandinspektor", Funktion="Kommandant-Stv.", EintriebAb=2008, IstFuehrung=true },

    new Mitglied { Id=3, Name="Gregor Dastel", Dienstgrad="Verwaltungsmeister", Funktion="Stv. Leiter des Verwaltungsdienstes", EintriebAb=2010, IstFuehrung=true },

    new Mitglied { Id=4, Name="Richard Kröpfl", Dienstgrad="Brandinspektor", Funktion="Zugskommandant", EintriebAb=2009, IstFuehrung=true },

    new Mitglied { Id=5, Name="Johann Herzog jun.", Dienstgrad="Oberbrandmeister", Funktion="1. Gruppenkommandant", EintriebAb=2012, IstFuehrung=true },
    new Mitglied { Id=6, Name="Emanuel Huber", Dienstgrad="Oberbrandmeister", Funktion="2. Gruppenkommandant / Zeugmeister", EintriebAb=2011, IstFuehrung=true },
    new Mitglied { Id=7, Name="Max Artner", Dienstgrad="Oberbrandmeister", Funktion="3. Gruppenkommandant", EintriebAb=2013, IstFuehrung=true },

    new Mitglied { Id=8, Name="Alexander Gassner", Dienstgrad="Löschmeister", Funktion="Fahrmeister", EintriebAb=2015, IstFuehrung=true },

    new Mitglied { Id=9, Name="Hannes Auer", Dienstgrad="Löschmeister", Funktion="Sachbearbeiter Nachrichtendienst", EintriebAb=2016, IstFuehrung=true },
    new Mitglied { Id=10, Name="Patrick Kirchberger", Dienstgrad="Löschmeister", Funktion="Sachbearbeiter Vorbeugender Brandschutz", EintriebAb=2017, IstFuehrung=true },
    new Mitglied { Id=11, Name="Marina Kröpfl", Dienstgrad="Löschmeister", Funktion="Sachbearbeiter Öffentlichkeitsarbeit", EintriebAb=2018, IstFuehrung=true },
    new Mitglied { Id=12, Name="Matthias Goll", Dienstgrad="Hauptbrandinspektor", Funktion="Sachbearbeiter Schadstoffdienst", EintriebAb=2005, IstFuehrung=true },

    new Mitglied { Id=13, Name="Johann Herzog sen.", Dienstgrad="Hauptlöschmeister", Funktion="Sachbearbeiter Feuerwehrgeschichte", EintriebAb=1995, IstFuehrung=true },
    new Mitglied { Id=14, Name="Stefan Schulmeister", Dienstgrad="Brandinspektor", Funktion="Sachbearbeiter Wasserdienst", EintriebAb=2008, IstFuehrung=true },

    new Mitglied { Id=15, Name="Lukas Assfall", Dienstgrad="Feuerwehrmann", Funktion="Sachbearbeiter EDV / Informationstechnologie", EintriebAb=2022, IstFuehrung=true },
    new Mitglied { Id=16, Name="Carmen Goll", Dienstgrad="Feuerwehrfrau", Funktion="Sachbearbeiter Feuerwehrmedizinischer Dienst", EintriebAb=2019, IstFuehrung=true }
};
}
