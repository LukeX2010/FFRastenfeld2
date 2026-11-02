using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using FFRastenfeld.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddHttpClient();
builder.Services.AddSingleton<AdminSessions>();
builder.Services.AddSingleton<DraftStore>();
builder.Services.AddSingleton<GitHubPublisher>();
builder.Services.AddSingleton<AiWriter>();

var app = builder.Build();
var clientRoot = builder.Configuration["ClientRoot"];
if (!string.IsNullOrWhiteSpace(clientRoot) && Directory.Exists(clientRoot))
{
    var clientFiles = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(clientRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = clientFiles });
    // Blazor liefert die Sprachdaten als .dat aus. ASP.NET kennt diese Endung nicht
    // standardmäßig und würde sonst genau beim App-Start mit einem 404 abbrechen.
    app.UseStaticFiles(new StaticFileOptions { FileProvider = clientFiles, ServeUnknownFileTypes = true });
}

app.MapPost("/api/admin/login", (AdminLoginRequest request, IConfiguration config, AdminSessions sessions, HttpContext context) =>
{
    var username = config["Admin:Username"];
    var password = config["Admin:Password"];
    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        return Results.Problem("Die lokalen Admin-Zugangsdaten sind noch nicht eingerichtet.", statusCode: 503);
    if (!FixedTimeEquals(request.Username, username) || !FixedTimeEquals(request.Password, password))
        return Results.Unauthorized();

    var token = sessions.Create();
    context.Response.Cookies.Append(AdminSessions.CookieName, token, new CookieOptions
    {
        HttpOnly = true, SameSite = SameSiteMode.Strict, Secure = !app.Environment.IsDevelopment(), MaxAge = TimeSpan.FromHours(12), IsEssential = true
    });
    return Results.Ok(new { authenticated = true });
});

app.MapPost("/api/admin/logout", (AdminSessions sessions, HttpContext context) =>
{
    sessions.Remove(context.Request.Cookies[AdminSessions.CookieName]);
    context.Response.Cookies.Delete(AdminSessions.CookieName);
    return Results.Ok();
});

app.MapGet("/api/admin/session", (AdminSessions sessions, HttpContext context) => Results.Ok(new { authenticated = sessions.IsAuthenticated(context) }));

app.MapGet("/api/admin/drafts", (AdminSessions sessions, HttpContext context, DraftStore store) =>
    Require(sessions, context) ?? Results.Ok(store.GetAll()));

app.MapGet("/api/admin/drafts/{id}", (string id, AdminSessions sessions, HttpContext context, DraftStore store) =>
{
    if (Require(sessions, context) is { } denied) return denied;
    return store.Get(id) is { } draft ? Results.Ok(draft) : Results.NotFound();
});

app.MapPost("/api/admin/drafts", (AdminDraft draft, AdminSessions sessions, HttpContext context, DraftStore store) =>
{
    if (Require(sessions, context) is { } denied) return denied;
    store.Save(draft);
    return Results.Ok(new { saved = true, id = draft.Id });
});

app.MapPost("/api/admin/ai", async (AdminDraft draft, AdminSessions sessions, HttpContext context, AiWriter ai) =>
{
    if (Require(sessions, context) is { } denied) return denied;
    try { return Results.Ok(await ai.WriteAsync(draft)); }
    catch (InvalidOperationException ex) { return Results.Problem(ex.Message, statusCode: 503); }
    catch (Exception) { return Results.Problem("Die KI konnte gerade keinen Entwurf erstellen. Bitte später noch einmal versuchen.", statusCode: 502); }
});

app.MapPost("/api/admin/publish", async (AdminDraft draft, AdminSessions sessions, HttpContext context, GitHubPublisher publisher) =>
{
    if (Require(sessions, context) is { } denied) return denied;
    try { await publisher.PublishAsync(draft); return Results.Ok(new { published = true }); }
    catch (InvalidOperationException ex) { return Results.Problem(ex.Message, statusCode: 503); }
    catch (Exception ex) { app.Logger.LogError(ex, "GitHub-Veröffentlichung fehlgeschlagen"); return Results.Problem("GitHub konnte den Beitrag nicht veröffentlichen. Es wurde nichts als veröffentlicht bestätigt.", statusCode: 502); }
});

if (!string.IsNullOrWhiteSpace(clientRoot) && Directory.Exists(clientRoot))
{
    var indexFile = Path.Combine(clientRoot, "index.html");
    app.MapFallback(async context =>
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexFile);
    });
}

app.Run();

static IResult? Require(AdminSessions sessions, HttpContext context) => sessions.IsAuthenticated(context) ? null : Results.Unauthorized();
static bool FixedTimeEquals(string left, string right) => CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));

public sealed class AdminSessions
{
    public const string CookieName = "ffr_admin_session";
    private readonly ConcurrentDictionary<string, DateTime> _sessions = new();
    public string Create() { var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)); _sessions[token] = DateTime.UtcNow.AddHours(12); return token; }
    public void Remove(string? token) { if (token is not null) _sessions.TryRemove(token, out _); }
    public bool IsAuthenticated(HttpContext context) => context.Request.Cookies.TryGetValue(CookieName, out var token) && token is not null && _sessions.TryGetValue(token, out var expires) && expires > DateTime.UtcNow;
}

public sealed class DraftStore
{
    private readonly string _directory;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    public DraftStore(IHostEnvironment environment) { _directory = Path.Combine(environment.ContentRootPath, "data", "drafts"); Directory.CreateDirectory(_directory); }
    public List<AdminDraft> GetAll() => Directory.EnumerateFiles(_directory, "*.json").Select(Read).Where(x => x is not null).Cast<AdminDraft>().ToList();
    public AdminDraft? Get(string id) => IsSafeId(id) ? Read(Path.Combine(_directory, $"{id}.json")) : null;
    public void Save(AdminDraft draft) { if (!IsSafeId(draft.Id)) draft.Id = Guid.NewGuid().ToString("N"); draft.UpdatedAt = DateTime.UtcNow; File.WriteAllText(Path.Combine(_directory, $"{draft.Id}.json"), JsonSerializer.Serialize(draft, JsonOptions)); }
    private AdminDraft? Read(string path) { try { return JsonSerializer.Deserialize<AdminDraft>(File.ReadAllText(path), JsonOptions); } catch { return null; } }
    private static bool IsSafeId(string value) => value.Length is > 10 and < 80 && value.All(char.IsLetterOrDigit);
}

public sealed class AiWriter
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    public AiWriter(IHttpClientFactory httpClientFactory, IConfiguration config) { _httpClientFactory = httpClientFactory; _config = config; }
    public async Task<AdminDraft> WriteAsync(AdminDraft draft)
    {
        // Lokal darf der bereits vorhandene GEMINI_API_KEY aus der Umgebung
        // verwendet werden; im Hosting ist Gemini__ApiKey der bevorzugte Secret-Name.
        var key = _config["Gemini:ApiKey"] ?? _config["GEMINI_API_KEY"];
        if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("KI ist noch nicht eingerichtet. Setze Gemini__ApiKey als Server-Secret.");
        var prompt = $"""
            Du bist Redakteur der Freiwilligen Feuerwehr Rastenfeld in Niederösterreich. Erstelle einen sachlichen deutschsprachigen Website-Beitrag. Erfinde keine Fakten, Namen, Uhrzeiten oder Ereignisse. Bei Einsätzen nenne keine Ursachen, Verletzungen, Kennzeichen oder Schuldzuweisungen ohne explizite Information. Gib ausschließlich gültiges JSON mit den Feldern titel, kurztext und volltext zurück.
            Kategorie: {draft.Kategorie}
            Datum: {draft.Datum:dd.MM.yyyy}
            Ort: {draft.Ort}
            Bestehender Titel: {draft.Titel}
            Notizen: {draft.Notizen}
            Wunsch der Redaktion: {draft.KiAnweisung}
            Veröffentlicht werden nur {draft.Bilder.Count(x => !x.IsInformationOnly)} Bilder. Kontextbilder: {string.Join(", ", draft.Bilder.Where(x => x.IsInformationOnly).Select(x => x.Caption))}
            """;
        var model = _config["Gemini:Model"] ?? "gemini-2.5-flash";
        var client = _httpClientFactory.CreateClient();
        var payload = new { contents = new[] { new { parts = new[] { new { text = prompt } } } }, generationConfig = new { responseMimeType = "application/json", temperature = 0.45 } };
        using var response = await client.PostAsJsonAsync($"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Uri.EscapeDataString(key)}", payload);
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var text = document.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
        var generated = JsonSerializer.Deserialize<GeneratedText>(text ?? "{}", new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? new GeneratedText();
        draft.Titel = generated.Titel ?? draft.Titel;
        draft.Kurztext = generated.Kurztext ?? draft.Kurztext;
        draft.Volltext = generated.Volltext ?? draft.Volltext;
        return draft;
    }
    private sealed class GeneratedText { public string? Titel { get; set; } public string? Kurztext { get; set; } public string? Volltext { get; set; } }
}

public sealed class GitHubPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    public GitHubPublisher(IHttpClientFactory httpClientFactory, IConfiguration config) { _httpClientFactory = httpClientFactory; _config = config; }
    public async Task PublishAsync(AdminDraft draft)
    {
        var token = _config["GitHub:Token"];
        if (string.IsNullOrWhiteSpace(token)) throw new InvalidOperationException("GitHub ist noch nicht eingerichtet. Setze GitHub__Token als Server-Secret.");
        if (string.IsNullOrWhiteSpace(draft.Titel) || string.IsNullOrWhiteSpace(draft.Volltext)) throw new InvalidOperationException("Titel und vollständiger Beitrag müssen vor dem Veröffentlichen ausgefüllt sein.");
        var owner = _config["GitHub:Owner"] ?? throw new InvalidOperationException("GitHub Owner fehlt.");
        var repo = _config["GitHub:Repository"] ?? throw new InvalidOperationException("GitHub Repository fehlt.");
        var branch = _config["GitHub:Branch"] ?? "main";
        var imagesPath = (_config["GitHub:ImagesPath"] ?? "wwwroot/img/posts").Trim('/');
        var postsPath = (_config["GitHub:PostsPath"] ?? "wwwroot/data/posts.json").Trim('/');
        var slug = ToSlug(draft.Titel);
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd("FFRastenfeld-Redaktion/1.0");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

        var postImages = new List<string>();
        var number = 1;
        foreach (var image in draft.Bilder.Where(x => !x.IsInformationOnly))
        {
            var extension = FileExtension(image.DataUrl, image.Name);
            var path = $"{imagesPath}/{slug}/bild-{number:D2}.{extension}";
            await PutFile(client, owner, repo, branch, path, DataUrlBytes(image.DataUrl), $"Redaktion: Bild {number} für {draft.Titel}");
            postImages.Add($"posts/{slug}/bild-{number:D2}.{extension}");
            number++;
        }
        var (posts, sha) = await ReadJsonArray(client, owner, repo, branch, postsPath);
        var nextId = posts.Select(x => x?["Id"]?.GetValue<int>() ?? 0).DefaultIfEmpty().Max() + 1;
        var imageNodes = postImages.Select(path => (JsonNode?)JsonValue.Create(path)).ToArray();
        posts.Insert(0, new JsonObject { ["Id"] = nextId, ["Slug"] = slug, ["Emoji"] = "", ["Titel"] = draft.Titel, ["Kategorie"] = draft.Kategorie, ["Datum"] = draft.Datum.ToString("O"), ["Kurztext"] = draft.Kurztext, ["Volltext"] = draft.Volltext, ["Bilder"] = new JsonArray(imageNodes), ["BildPlaceholder"] = "🔥", ["EinsatzTyp"] = null, ["EinsatzOrt"] = string.IsNullOrWhiteSpace(draft.Ort) ? null : draft.Ort, ["EinsatzZeit"] = null, ["EinsatzKraefte"] = null });
        await PutFile(client, owner, repo, branch, postsPath, Encoding.UTF8.GetBytes(posts.ToJsonString(new JsonSerializerOptions { WriteIndented = true })), $"Redaktion: Beitrag {draft.Titel}", sha);
    }
    private static async Task<(JsonArray Posts, string Sha)> ReadJsonArray(HttpClient client, string owner, string repo, string branch, string path)
    {
        using var response = await client.GetAsync($"https://api.github.com/repos/{owner}/{repo}/contents/{Uri.EscapeDataString(path).Replace("%2F", "/")}?ref={Uri.EscapeDataString(branch)}");
        response.EnsureSuccessStatusCode();
        using var content = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var encoded = content.RootElement.GetProperty("content").GetString() ?? "";
        var posts = JsonNode.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(encoded.Replace("\n", ""))))?.AsArray() ?? new JsonArray();
        return (posts, content.RootElement.GetProperty("sha").GetString() ?? "");
    }
    private static async Task PutFile(HttpClient client, string owner, string repo, string branch, string path, byte[] data, string message, string? sha = null)
    {
        var body = new JsonObject { ["message"] = message, ["content"] = Convert.ToBase64String(data), ["branch"] = branch };
        if (!string.IsNullOrWhiteSpace(sha)) body["sha"] = sha;
        using var response = await client.PutAsJsonAsync($"https://api.github.com/repos/{owner}/{repo}/contents/{Uri.EscapeDataString(path).Replace("%2F", "/")}", body);
        response.EnsureSuccessStatusCode();
    }
    private static byte[] DataUrlBytes(string dataUrl) { var comma = dataUrl.IndexOf(','); return comma < 0 ? throw new InvalidOperationException("Ein Bild ist ungültig.") : Convert.FromBase64String(dataUrl[(comma + 1)..]); }
    private static string FileExtension(string dataUrl, string name) => dataUrl.StartsWith("data:image/png", StringComparison.OrdinalIgnoreCase) ? "png" : dataUrl.StartsWith("data:image/webp", StringComparison.OrdinalIgnoreCase) ? "webp" : Path.GetExtension(name).Trim('.').ToLowerInvariant() is "jpg" or "jpeg" ? "jpeg" : "jpeg";
    private static string ToSlug(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD); var builder = new StringBuilder();
        foreach (var c in normalized) { if (char.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark) builder.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-'); }
        return string.Join('-', builder.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries)).Trim('-');
    }
}
