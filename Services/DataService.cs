using System.Net.Http.Json;
using System.Text.Json;
using FFRastenfeld.Models;
using Microsoft.Extensions.Configuration;

namespace FFRastenfeld.Services;

public class DataService
{
    // POSTS (werden zur Laufzeit aus der konfigurierten JSON-Quelle geladen)
    private static readonly JsonSerializerOptions PostJsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient;
    private readonly string _postsUrl;
    private readonly string _fallbackPostsUrl;
    private readonly string _imageBaseUrl;
    private readonly int _cacheBustingMinutes;
    private List<Post> _posts = new();
    private Task? _postsLoadTask;

    public DataService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;

        var dataConfig = configuration.GetSection("WebsiteData");
        _postsUrl = NormalizeConfigValue(dataConfig["PostsUrl"]) ?? "data/posts.json";
        _fallbackPostsUrl = NormalizeConfigValue(dataConfig["FallbackPostsUrl"]) ?? "data/posts.json";
        _imageBaseUrl = TrimTrailingSlash(NormalizeConfigValue(dataConfig["ImageBaseUrl"]) ?? "img");
        _cacheBustingMinutes = int.TryParse(dataConfig["CacheBustingMinutes"], out var minutes) ? minutes : 5;
    }

    public async Task EnsurePostsLoadedAsync()
    {
        _postsLoadTask ??= LoadPostsAsync();
        await _postsLoadTask;
    }

    public List<Post> GetPosts() => _posts;

    public async Task<List<Post>> GetPostsAsync()
    {
        await EnsurePostsLoadedAsync();
        return GetPosts();
    }

    public Post? GetPost(string slug) => GetPosts().FirstOrDefault(p => p.Slug == slug);

    public async Task<Post?> GetPostAsync(string slug)
    {
        await EnsurePostsLoadedAsync();
        return GetPost(slug);
    }

    public List<Post> GetByKategorie(string kat) =>
        GetPosts().Where(p => p.Kategorie == kat).OrderByDescending(p => p.Datum).ToList();

    public async Task<List<Post>> GetByKategorieAsync(string kat)
    {
        await EnsurePostsLoadedAsync();
        return GetByKategorie(kat);
    }

    public List<Post> GetEinsaetze() => GetByKategorie("Eins\u00e4tze");

    public Task<List<Post>> GetEinsaetzeAsync() => GetByKategorieAsync("Eins\u00e4tze");

    public string GetMainImageSrc(Post post)
    {
        var firstImage = post.Bilder?.FirstOrDefault()?.Replace('\\', '/');
        if (!string.IsNullOrWhiteSpace(firstImage))
        {
            return GetImageSrc(firstImage);
        }

        return GetImageSrc($"{post.Slug}.jpeg");
    }

    public bool HasPostImage(Post post) =>
        post.Bilder?.Any(image => !string.IsNullOrWhiteSpace(image)) == true;

    public string GetImageSrc(string? imagePath)
    {
        var normalized = imagePath?.Replace('\\', '/').Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return "img/keinbild.jpeg";
        }

        if (Uri.TryCreate(normalized, UriKind.Absolute, out _) ||
            normalized.StartsWith("/", StringComparison.Ordinal))
        {
            return normalized;
        }

        if (normalized.StartsWith("img/", StringComparison.OrdinalIgnoreCase))
        {
            return normalized;
        }

        return $"{_imageBaseUrl}/{normalized}";
    }

    private async Task LoadPostsAsync()
    {
        var errors = new List<string>();
        foreach (var postsUrl in GetPostsUrls())
        {
            try
            {
                var posts = await _httpClient.GetFromJsonAsync<List<Post>>(AddCacheBuster(postsUrl), PostJsonOptions);
                _posts = posts ?? new List<Post>();
                return;
            }
            catch (Exception ex)
            {
                errors.Add($"{postsUrl}: {ex.Message}");
            }
        }

        Console.Error.WriteLine($"Posts konnten nicht geladen werden: {string.Join(" | ", errors)}");
        _posts = new List<Post>();
    }

    private IEnumerable<string> GetPostsUrls()
    {
        var urls = new[] { _postsUrl, _fallbackPostsUrl };
        return urls
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private string AddCacheBuster(string url)
    {
        if (_cacheBustingMinutes <= 0)
        {
            return url;
        }

        var intervalSeconds = Math.Max(60, _cacheBustingMinutes * 60);
        var cacheBucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / intervalSeconds;
        var separator = url.Contains('?') ? "&" : "?";
        return $"{url}{separator}v={cacheBucket}";
    }

    private static string? NormalizeConfigValue(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private static string TrimTrailingSlash(string value)
    {
        return value.TrimEnd('/');
    }

    public List<Mitglied> GetMitglieder() => new()
{
    new Mitglied { Id=1, Name="Matthias Goll", Dienstgrad="Hauptbrandinspektor", Funktion="Kommandant", EintriebAb=2019, IstFuehrung=true },
    new Mitglied { Id=2, Name="Stefan Schulmeister", Dienstgrad="Brandinspektor", Funktion="Kommandant-Stv.", EintriebAb=2011, IstFuehrung=true },

    new Mitglied { Id=3, Name="Erwin Huber", Dienstgrad="Verwaltungsmeister", Funktion="Leiter des Verwaltungsdienstes", EintriebAb=2001, IstFuehrung=true },
    new Mitglied { Id=4, Name="Gregor Dastel", Dienstgrad="Verwaltungsmeister", Funktion="Stv. Leiter des Verwaltungsdienstes", EintriebAb=1998, IstFuehrung=true },

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
    new Mitglied { Id=17, Name="Felix Dornhackl", Dienstgrad="Feuerwehrmann", Funktion="", EintriebAb=2024, IstFuehrung=true },
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
            Name = "Tanklöschfahrzeug",
            Kuerzel = "TLF 4000",
            Funkrufname = "Tank Rastenfeld",
            BildDatei = "scaniaP340",
            Beschreibung =
                "Das Tanklöschfahrzeug 4000 dient zur Brandbekämpfung bei Bränden mit hohem Wasserbedarf, insbesondere bei Wald- und Flurbränden sowie in Gebieten ohne ausreichende Wasserversorgung.",
            Baujahr = "2008",
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
            Funkrufname = "Bus Rastenfeld",
            BildDatei = "MTF",
            Beschreibung =
                "Das Mannschaftstransportfahrzeug dient primär zum Transport von Feuerwehrmitgliedern und Ausrüstung zu Einsätzen, Übungen und Veranstaltungen. Es wird auch für logistische Aufgaben eingesetzt.",
            Baujahr = "2018",
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

        new Fahrzeug
        {
            Id = 3,
            Name = "Abschleppachse",
            Kuerzel = "AAchse",
            BildDatei = "keinbild",
            Beschreibung =
                "Die Abschleppachse wird bei technischen Einsätzen verwendet, um nicht mehr fahrbereite Fahrzeuge zu bewegen oder für eine sichere Bergung vorzubereiten.",
            Baujahr = "1995",
            Emoji = "🛞",
            Ausstattung = new()
            {
                "Hilfsmittel für Fahrzeugbergungen",
                "Transport und Sicherung beschädigter Fahrzeuge",
                "Einsatz bei technischen Hilfeleistungen"
            }
        },

        new Fahrzeug
        {
            Id = 4,
            Name = "TS-Anhänger",
            Kuerzel = "TSA 750",
            BildDatei = "keinbild",
            Beschreibung =
                "Der Tragkraftspritzenanhänger dient zum Transport einer Tragkraftspritze und ergänzender Ausrüstung für die Löschwasserversorgung.",
            Baujahr = "2005",
            Emoji = "🚒",
            Ausstattung = new()
            {
                "Tragkraftspritze",
                "Saugschläuche und wasserführende Armaturen",
                "Schlauchmaterial für die Löschwasserversorgung"
            }
        },
    };

}
