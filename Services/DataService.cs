using FFRastenfeld.Models;

namespace FFRastenfeld.Services;

public class DataService
{
    // ── POSTS (Einsätze + News + Ausbildung + Jugend) ─────────────────────────
    public List<Post> GetPosts() => new()
    {

    new Post
    {
        Id = 22,
        Slug = "florianimesse-rastenfeld-2026",
        Emoji = "florianimesse-rastenfeld-2026",
        Titel = "Florianimesse 2026 am Marktplatz Rastenfeld",
        Kategorie = "FF-News",
        Datum = new DateTime(2026, 5, 14),
        Kurztext =
            "Die FF Rastenfeld nahm gemeinsam mit der FF Peygarten an der Florianimesse am Marktplatz Rastenfeld teil.",
        Volltext =
            "Am Donnerstag, dem 14. Mai 2026, fand am Marktplatz Rastenfeld die Florianimesse statt. Die Freiwillige Feuerwehr Rastenfeld nahm gemeinsam mit der FF Peygarten daran teil.\n\n" +
            "Musikalisch begleitet wurde die Feier von der Musikkapelle Waldhausen. Nach der Messe folgte der gemeinsame Auszug am Marktplatz.\n\n" +
            "Die Florianimesse ist fuer die Feuerwehren ein wichtiger Fixpunkt im Jahreslauf: Sie verbindet das Gedenken an den Schutzpatron der Feuerwehr mit Kameradschaft, Tradition und dem gemeinsamen Auftreten in der Gemeinde.",
        BildPlaceholder = "ðŸš’",
        Bilder =
        [
            "florianimesse-rastenfeld-2026-ausrueckung.jpeg"
        ]
    },

    new Post
    {
        Id = 21,
        Slug = "abschnittsfeuerwehrleistungsbewerb-hadersdorf-2026",
        Emoji = "abschnittsfeuerwehrleistungsbewerb-hadersdorf-2026",
        Titel = "Bewerbsgruppe beim Abschnittsfeuerwehrleistungsbewerb in Hadersdorf",
        Kategorie = "FF-News",
        Datum = new DateTime(2026, 5, 30),
        Kurztext =
            "Die Bewerbsgruppe der FF Rastenfeld trat beim Abschnittsfeuerwehrleistungsbewerb in Hadersdorf am Kamp in Bronze und Silber an.",
        Volltext =
            "Am Samstag, dem 30. Mai 2026, nahm die Bewerbsgruppe der Freiwilligen Feuerwehr Rastenfeld am Abschnittsfeuerwehrleistungsbewerb in Hadersdorf am Kamp teil.\n\n" +
            "In Bronze erreichte die Gruppe eine Angriffszeit von 57,43 Sekunden, musste jedoch 35 Fehlerpunkte hinnehmen. In Silber gelang ein Lauf mit 1:12,00 Minuten und 15 Fehlerpunkten.\n\n" +
            "Auch wenn nicht alles fehlerfrei verlief, war der Bewerb ein wichtiger Teil der laufenden Vorbereitung. Jeder Antritt bringt Erfahrung, Routine und Zusammenhalt für die naechsten Bewerbe.",
        BildPlaceholder = "🚒"
    },

    new Post
    {
        Id = 20,
        Slug = "baum-auf-strasse-rastenberg-2026",
        Emoji = "baum-auf-strasse-rastenberg-2026",
        Titel = "Baum blockierte die L8245 bei Rastenberg",
        Kategorie = "Einsätze",
        Datum = new DateTime(2026, 5, 30, 13, 55, 0),
        Kurztext =
            "Nach einem Gewitter wurde die FF Rastenfeld zu einem umgestuerzten Baum auf der L8245 bei Rastenberg alarmiert.",
        Volltext =
            "Am Samstag, dem 30. Mai 2026, wurde die Freiwillige Feuerwehr Rastenfeld um 13:55 Uhr zu einem technischen Einsatz nach Rastenberg alarmiert.\n\n" +
            "Auf der L8245, im Bereich km 14,2 vor der Ortstafel Rastenberg in Fahrtrichtung B37, war nach einem Gewitter ein Baum auf die Strasse gestuerzt und blockierte die Fahrbahn.\n\n" +
            "Die Einsatzkraefte sicherten die Einsatzstelle ab, entfernten den Baum und reinigten anschliessend die Fahrbahn. Danach konnte die Strasse wieder freigegeben werden.",
        BildPlaceholder = "🚒",
        EinsatzTyp = "T1 - Objekt/Baum umgestuerzt",
        EinsatzOrt = "L8245 km 14,2, Rastenberg",
        EinsatzZeit = "13:55 Uhr",
        EinsatzKraefte = 4
    },

    new Post
    {
        Id = 19,
        Slug = "schadstoffuebung-mottingeramt-2026",
        Emoji = "schadstoffuebung-mottingeramt-2026",
        Titel = "Uebung Fahrzeugbrand und Schadstoffausruestung",
        Kategorie = "Ausbildung",
        Datum = new DateTime(2026, 5, 29),
        Kurztext =
            "In Mottingeramt beuebte die FF Rastenfeld einen Fahrzeugbrand in einer Garage und den Umgang mit neuer Schadstoffausruestung.",
        Volltext =
            "Am Freitag, dem 29. Mai 2026, fuehrte die Freiwillige Feuerwehr Rastenfeld in Mottingeramt eine praxisnahe Übung durch.\n\n" +
            "Angenommen wurde ein Fahrzeugbrand in einer Garage. Neben dem Vorgehen unter Atemschutz standen auch Erkundung, Brandbekaempfung und die sichere Arbeit im direkten Gefahrenbereich im Mittelpunkt.\n\n" +
            "Zusaetzlich wurde neue Ausruestung fuer Schadstoffeinsaetze getestet. Dazu gehoerten saeurebestaendige Ganzkoerperschutzanzuege der Kategorie 2, Moosplatten sowie eine Auffangwanne. Solche Uebungen helfen, Geraete und Ablaeufe im Team zu festigen.",
        BildPlaceholder = "🚒",
        Bilder =
        [
            "schadstoffuebung-mottingeramt-2026-ausruestung.jpeg",
            "schadstoffuebung-mottingeramt-2026-erkundung.jpeg"
        ]
    },

    new Post
    {
        Id = 18,
        Slug = "dreidoerfer-wandertag-niedergruenbach-2026",
        Emoji = "dreidoerfer-wandertag-niedergruenbach-2026",
        Titel = "28. Dreidoerfer Wandertag in Niedergruenbach",
        Kategorie = "FF-News",
        Datum = new DateTime(2026, 5, 24),
        Kurztext =
            "Beim 28. Dreidoerfer Wandertag in Niedergruenbach stellte die FF Rastenfeld die zweitgroesste Wandergruppe.",
        Volltext =
            "Am Sonntag, dem 24. Mai 2026, fand in Niedergruenbach der 28. Dreidoerfer Wandertag statt. Start und Ziel befanden sich in Niedergruenbach; die Route fuehrte durch die Orte Niedergruenbach, Marbach im Felde und Sperkental.\n\n" +
            "Bei sonnigem Wetter machte sich auch eine Gruppe der Freiwilligen Feuerwehr Rastenfeld auf den Weg. Entlang der Strecke sorgten drei Labstationen fuer Verpflegung und kurze Pausen.\n\n" +
            "Besonders erfreulich: Die FF Rastenfeld stellte die zweitgroesste Wandergruppe der Veranstaltung. Im Anschluss klang der Tag bei gemeinsamer Verpflegung in Niedergruenbach gemuetlich aus.",
        BildPlaceholder = "🚒"
    },

    new Post
    {
        Id = 17,
        Slug = "auffahrunfall-b38-rastenfeld",
        Emoji = "auffahrunfall-b38-rastenfeld",
        Titel = "Auffahrunfall auf der B38",
        Kategorie = "Einsätze",
        Datum = new DateTime(2026, 5, 22, 16, 36, 0),
        Kurztext =
            "Auffahrunfall auf der B38 bei Rastenfeld: Zwei verletzte Personen wurden vom Rettungsdienst versorgt.",
        Volltext =
            "Am Freitag, dem 22. Mai 2026, wurde die Freiwillige Feuerwehr Rastenfeld um 16:36 Uhr zu einem Verkehrsunfall mit Verletzungen auf die B38, Höhe km 29 bei der Kreuzung Rastenfeld/Umfahrung Zwettl, alarmiert.\n\n" +
            "Aus bislang unbekannter Ursache kam es zu einem Auffahrunfall. Beim Eintreffen der Feuerwehr wurden zwei verletzte Personen bereits vom Rettungsdienst versorgt; niemand war im Fahrzeug eingeklemmt.\n\n" +
            "Die Einsatzkräfte sicherten die Unfallstelle ab, stellten den Brandschutz sicher, unterstützten Rettungsdienst und Polizei und führten die Verkehrsregelung sowie Aufräumarbeiten durch. Auch ein Notarzthubschrauber war im Einsatz.",
        BildPlaceholder = "🚒",
        EinsatzTyp = "T1 – VU-Verletzungen",
        EinsatzOrt = "B38 km 29, Kreuzung Rastenfeld/Umfahrung Zwettl",
        EinsatzZeit = "16:36 Uhr",
        EinsatzKraefte = 11,
        Bilder =
        [
            "auffahrunfall-b38-rastenfeld-hubschrauber.jpeg",
            "auffahrunfall-b38-rastenfeld-absicherung.jpeg",
            "auffahrunfall-b38-rastenfeld-fahrzeug.jpeg"
        ]
    },

    new Post
    {
        Id = 6,
        Slug = "vu-menschenrettung-rastenberg",
        Emoji = "vu-menschenrettung-rastenberg",
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
        Slug = "keinbild",
        Emoji = "keinbild",
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
        Slug = "keinbild",
        Emoji = "keinbild",
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
            Emoji = "mosertronik-begehung",
            Titel = "Sicherheit durch Zusammenarbeit",
            Kategorie = "FF-News",
            Datum = new DateTime(2026, 3, 27),
            Kurztext =
                "Gemeinsame Gebäudebegehung bei der Mosertronik GmbH zur Verbesserung der Einsatzvorbereitung.",
            Volltext =
                "Kürzlich besuchte eine Abordnung der Freiwilligen Feuerwehr Rastenfeld die Mosertronik GmbH im Rahmen einer gemeinsamen Gebäudebegehung. Ziel dieser Besichtigung war es, wichtige Einblicke in die betrieblichen Abläufe sowie die örtlichen Gegebenheiten zu gewinnen.\n\nDurch das frühzeitige Kennenlernen von Zufahrtswegen, technischen Anlagen und möglichen Gefahrenstellen kann im Ernstfall schneller und gezielter reagiert werden. Solche Begehungen leisten einen wichtigen Beitrag zur optimalen Einsatzvorbereitung.\n\nDie Feuerwehr bedankt sich bei der Mosertronik GmbH für die Einladung sowie die konstruktive und professionelle Zusammenarbeit.",
            BildPlaceholder = "🔍🚒"
        },
        
        new  Post{
            Id = 15,
            Slug = "Tut-Gut-Wandertag",
            Emoji = "Tut-Gut-Wandertag",
            Titel = "Tut Gut Wandertag",
            Kategorie = "FF-News",
            Datum = new DateTime(2026, 4, 26),
            Kurztext =
                "Die FF Rastenfeld rundete den Wandertag kulinarisch ab, indem sie die Teilnehmer im Pfarrstadl mit einem gemeinsamen Mittagstisch verpflegte.",
            Volltext =
                "Bei idealem Wanderwetter fand am 26. April 2026 der diesjährige Familienwandertag der Marktgemeinde Rastenfeld im Rahmen der Niederösterreichweiten Aktion „Wandererwachen“ von „Tut gut!“ NÖ statt – heuer mit einem neuen Teilnehmerrekord: Rund 220 Personen, darunter etwa 40 Kinder unter 12 Jahren, machten sich unter der Leitung von Wanderführerin Doris Kunst auf den Weg.\n\nDer Start erfolgte am Marktplatz Rastenfeld, von wo aus die Wandergruppe eine rund 8 Kilometer lange Strecke durch die Gemeinde absolvierte.\n\nStärkung unterwegs und gemütlicher Ausklang\nEntlang der Route sorgte die Feuerwehr Peygarten‑Ottenstein mit einer Jausenstation für eine willkommene Pause. Zusätzlich erhielten alle Teilnehmenden eine gesunde Jause mit Apfel und Wasser.\n\nIm Pfarrstadl erwartete die Wanderer anschließend ein Mittagstisch der Feuerwehr Rastenfeld, der den Tag kulinarisch abrundete. Dort fand auch die Verlosung der Gesunden Gemeinde Rastenfeld statt:",
            BildPlaceholder = "🔍🚒",
            Bilder = ["Tut-Gut-Wandertag1.jpeg","Tut-Gut-Wandertag2.jpeg","Tut-Gut-Wandertag3.jpg"]
        },
        new Post{
            Id = 16,
            Slug = "maibaum-aufstellen-2026",
            Emoji = "🌲",
            Titel = "Maibaum aufstellen 2026",
            Kategorie = "FF-News",
            Datum = new DateTime(2026, 5, 1),
            Kurztext =
                "Die FF Rastenfeld hat heuer den Maibaum wieder selbst aufgestellt – von der Baumauswahl und dem Schälen bis zum Aufrichten am 1. Mai.",
            Volltext =
                "Auch 2026 hat die Freiwillige Feuerwehr Rastenfeld den Maibaum in Eigenregie aufgestellt. Bereits im Vorfeld wurde gemeinsam ein geeigneter Baum ausgesucht, gefällt und traditionell von Hand geschält.\n\nAm 1. Mai war es dann soweit: Mit vereinten Kräften wurde der Maibaum aufgerichtet – ganz ohne Maschinen, dafür mit viel Teamgeist.\n\nIm Anschluss an das Aufstellen lud die Feuerwehr zu einem gemütlichen Mittagessen im Pfarrstadl ein, wo die Mannschaft gemeinsam den gelungenen Vormittag ausklingen ließ.",
            BildPlaceholder = "🌲🚒",
            Bilder = ["Maibaum2026-1.jpeg","Maibaum2026-2.jpeg","Maibaum2026-3.jpeg"]
        },
        
    };

    public Post? GetPost(string slug) => GetPosts().FirstOrDefault(p => p.Slug == slug);

    public List<Post> GetByKategorie(string kat) =>
        GetPosts().Where(p => p.Kategorie == kat).OrderByDescending(p => p.Datum).ToList();

    public List<Post> GetEinsaetze() => GetByKategorie("Einsätze");

   
// ── MITGLIEDER ──────────────────────────────────────────────────────────
    public List<Mitglied> GetMitglieder() => new()
{
    new Mitglied { Id=1, Name="Matthias Goll", Dienstgrad="Hauptbrandinspektor", Funktion="Kommandant", EintriebAb=2019, IstFuehrung=true },
    new Mitglied { Id=2, Name="Stefan Schulmeister", Dienstgrad="Brandinspektor", Funktion="Kommandant-Stv.", EintriebAb=2011, IstFuehrung=true },

    new Mitglied { Id=3, Name="Gregor Dastel", Dienstgrad="Verwaltungsmeister", Funktion="Stv. Leiter des Verwaltungsdienstes", EintriebAb=1998, IstFuehrung=true },
    new Mitglied { Id=4, Name="Erwin Huber", Dienstgrad="Verwaltungsmeister", Funktion="Stv. Leiter des Verwaltungsdienstes", EintriebAb=2010, IstFuehrung=true },

    new Mitglied { Id=5, Name="Johann Herzog jun.", Dienstgrad="Oberbrandmeister", Funktion="1. Gruppenkommandant", EintriebAb=2012, IstFuehrung=true },
    new Mitglied { Id=6, Name="Emanuel Huber", Dienstgrad="Oberbrandmeister", Funktion="2. Gruppenkommandant / Zeugmeister", EintriebAb=2011, IstFuehrung=true },
    new Mitglied { Id=7, Name="Max Artner", Dienstgrad="Oberbrandmeister", Funktion="3. Gruppenkommandant", EintriebAb=2015, IstFuehrung=true },

    new Mitglied { Id=8, Name="Alexander Gassner", Dienstgrad="Löschmeister", Funktion="Fahrmeister", EintriebAb=2015, IstFuehrung=true },
    new Mitglied { Id=9, Name="Richard Kröpfl", Dienstgrad="Brandinspektor", Funktion="Zugskommandant", EintriebAb=1998, IstFuehrung=true },
    new Mitglied { Id=10, Name="Patrick Kirchberger", Dienstgrad="Löschmeister", Funktion="Sachbearbeiter Vorbeugender Brandschutz", EintriebAb=2017, IstFuehrung=true },
    new Mitglied { Id=11, Name="Marina Kröpfl", Dienstgrad="Löschmeister", Funktion="Sachbearbeiter Öffentlichkeitsarbeit", EintriebAb=2018, IstFuehrung=true },
    new Mitglied { Id=12, Name="Bernhard Traxler", Dienstgrad="Hauptbrandinspektor", Funktion="", EintriebAb=2005, IstFuehrung=true },

    new Mitglied { Id=13, Name="Johann Herzog sen.", Dienstgrad="Hauptlöschmeister", Funktion="Sachbearbeiter Feuerwehrgeschichte", EintriebAb=1995, IstFuehrung=true },
    new Mitglied { Id=14, Name="Christian Frühwirt", Dienstgrad="Brandinspektor", Funktion="Sachbearbeiter Wasserdienst", EintriebAb=2008, IstFuehrung=true },

    new Mitglied { Id=15, Name="Lukas Assfall", Dienstgrad="Feuerwehrmann", Funktion="Sachbearbeiter EDV / Informationstechnologie", EintriebAb=2025, IstFuehrung=true },
    new Mitglied { Id=16, Name="Carmen Goll", Dienstgrad="Feuerwehrfrau", Funktion="Sachbearbeiter Feuerwehrmedizinischer Dienst", EintriebAb=2019, IstFuehrung=true },
    new Mitglied { Id=17, Name="Felix Dornahckl", Dienstgrad="Feuerwehrmamnn", Funktion="", EintriebAb=2024, IstFuehrung=true },
    new Mitglied { Id=18, Name="Jakob Assfall", Dienstgrad="Feuerwehrmann", Funktion="", EintriebAb=2025, IstFuehrung=true },
    new Mitglied { Id=16, Name="Victoria Lenz", Dienstgrad="Feuerwehrfrau", Funktion="Sachbearbeiter Öffentlichkeitsarbeit", EintriebAb=2024, IstFuehrung=true },
    new Mitglied { Id=17, Name="Hannes Auer", Dienstgrad="Löschmeister", Funktion="Sachbearbeiter Nachrichtendienst", EintriebAb=2016, IstFuehrung=true },
    new Mitglied { Id=18, Name="Gerhard Steininger", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=2010, IstFuehrung=true },
    new Mitglied { Id=19, Name="Thomas Hofbauer", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=2018, IstFuehrung=true },
    new Mitglied { Id=20, Name="Reinhard Hasengst", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=2018, IstFuehrung=true },
    new Mitglied { Id=21, Name="Walter Göschl", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=2018, IstFuehrung=true },
    new Mitglied { Id=22, Name="Wolfgang Göschl", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=1982, IstFuehrung=true },
    new Mitglied { Id=23, Name="Franz Hofmann", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=1982, IstFuehrung=true },
    new Mitglied { Id=24, Name="Herbert Weitl", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=1990, IstFuehrung=true },
    new Mitglied { Id=25, Name="Robert Zinner", Dienstgrad="Oberfeuerwehrmann", Funktion="", EintriebAb=1990, IstFuehrung=true },
    
};
    
    
    
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

}
