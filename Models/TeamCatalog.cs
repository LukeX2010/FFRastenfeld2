namespace FFRastenfeld.Models;

public sealed class TeamCatalog
{
    public bool DemoAssignments { get; set; }
    public List<TeamMember> Members { get; set; } = [];
    public List<TeamPhoto> Photos { get; set; } = [];
    public void Validate()
    {
        if (Members.Count == 0 || Photos.Count == 0) throw new InvalidDataException("Mannschaftsdaten sind leer.");
        var duplicateMembers = Members.GroupBy(m => m.Id).Where(g => g.Count() > 1).ToList();
        if (duplicateMembers.Count > 0)
            throw new InvalidDataException("Mitglieds-IDs mehrfach vergeben: " + string.Join("; ", duplicateMembers.Select(g => $"{g.Key} ({string.Join(", ", g.Select(m => m.Name))})")) + ". Jede Person braucht eine eigene ID.");
        if (Photos.Select(p => p.Id).Distinct().Count() != Photos.Count)
            throw new InvalidDataException("Foto-IDs müssen eindeutig sein.");
        foreach (var photo in Photos)
        {
            if (photo.Width <= 0 || photo.Height <= 0 || photo.TrimTop < 0 || photo.TrimBottom < 0 || photo.TrimTop + photo.TrimBottom >= photo.Height || photo.Spots.Select(s => s.MemberId).Distinct().Count() != photo.Spots.Count)
                throw new InvalidDataException("Ungültige Bildgröße oder doppelte Person im Bild.");
            foreach (var spot in photo.Spots)
                if (!Members.Any(m => m.Id == spot.MemberId) || spot.X is < 0 or > 1 || spot.Y is < 0 or > 1 || spot.Crop.Length != 4 || spot.Crop[2] <= 0 || spot.Crop[3] <= 0)
                    throw new InvalidDataException("Ungültige Fotozuordnung.");
        }
    }
}
public sealed class TeamMember
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Rank { get; set; } = "";
    public string Role { get; set; } = "";
    public int? Since { get; set; }
    public int Order { get; set; }
    public bool Placeholder { get; set; }
    public string? PortraitPhotoId { get; set; }
}
public sealed class TeamPhoto
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Src { get; set; } = "";
    public string? DetailSrc { get; set; }
    public string Original { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public int TrimTop { get; set; }
    public int TrimBottom { get; set; }
    public List<TeamSpot> Spots { get; set; } = [];
}
public sealed class TeamSpot
{
    public string Id { get; set; } = "";
    public string MemberId { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double[] Crop { get; set; } = [];
}
