namespace FFRastenfeld.Models;

public class AdminImage
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "bild.jpeg";
    public string DataUrl { get; set; } = "";
    public bool IsTitleImage { get; set; }
    public bool IsInformationOnly { get; set; }
    public string Caption { get; set; } = "";
}

public class AdminDraft
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Status { get; set; } = "Entwurf";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string Titel { get; set; } = "";
    public string Kategorie { get; set; } = "FF-News";
    public DateTime Datum { get; set; } = DateTime.Today;
    public string Ort { get; set; } = "";
    public string Notizen { get; set; } = "";
    public string KiAnweisung { get; set; } = "";
    public string Kurztext { get; set; } = "";
    public string Volltext { get; set; } = "";
    public List<AdminImage> Bilder { get; set; } = new();
}

public class AdminLoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}
