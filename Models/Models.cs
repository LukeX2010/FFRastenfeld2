namespace FFRastenfeld.Models;

public class Post
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Emoji { get; set; } = "";
    public string Titel { get; set; } = "";
    public string Kategorie { get; set; } = "";  // "Einsätze" | "FF-News" | "Ausbildung" | "Feuerwehrjugend"
    public DateTime Datum { get; set; }
    public string Kurztext { get; set; } = "";
    public string Volltext { get; set; } = "";
    
    public List<string> Bilder { get; set; } = new List<string>();
    
    
    public string BildPlaceholder { get; set; } = "🔥"; // emoji for placeholder img
    public string? EinsatzTyp { get; set; }   // z.B. "B2 – Zimmerbrand"
    public string? EinsatzOrt { get; set; }
    public string? EinsatzZeit { get; set; }
    public int?   EinsatzKraefte { get; set; }
}

public class Fahrzeug
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Kuerzel { get; set; } = "";
    public string Beschreibung { get; set; } = "";
    public string Baujahr { get; set; } = "";
    public string Hersteller { get; set; } = "";
    public string Emoji { get; set; } = "🚒";
    public List<string> Ausstattung { get; set; } = new();
}

public class Mitglied
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Dienstgrad { get; set; } = "";
    public string Funktion { get; set; } = "";
    public int EintriebAb { get; set; }
    public bool IstFuehrung { get; set; }
}
