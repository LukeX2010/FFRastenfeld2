using System.Text.Json;
using System.Text.Json.Serialization;

namespace FFRastenfeld.Models;

public class PostBildJsonConverter : JsonConverter<PostBild>
{
    public override PostBild? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            return new PostBild { Pfad = reader.GetString() ?? "" };
        }

        if (reader.TokenType == JsonTokenType.StartObject)
        {
            using var doc = JsonDocument.ParseValue(ref reader);
            var root = doc.RootElement;

            var pfad = ReadStringProperty(root, "Pfad", "Path", "pfad") ?? "";
            var beschreibung = ReadStringProperty(root, "Beschreibung", "Description", "beschreibung");

            return new PostBild { Pfad = pfad, Beschreibung = beschreibung };
        }

        throw new JsonException($"Unerwarteter JSON-Typ für PostBild: {reader.TokenType}");
    }

    public override void Write(Utf8JsonWriter writer, PostBild value, JsonSerializerOptions options)
    {
        if (string.IsNullOrWhiteSpace(value.Beschreibung))
        {
            writer.WriteStringValue(value.Pfad);
            return;
        }

        writer.WriteStartObject();
        writer.WriteString("Pfad", value.Pfad);
        writer.WriteString("Beschreibung", value.Beschreibung);
        writer.WriteEndObject();
    }

    private static string? ReadStringProperty(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (root.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.String)
            {
                return property.GetString();
            }
        }

        return null;
    }
}
