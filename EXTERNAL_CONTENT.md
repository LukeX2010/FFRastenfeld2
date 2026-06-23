# Externe Website-Daten ohne Netlify-Deploy

## Empfohlene kostenlose Architektur

Die Website bleibt auf Netlify. Veraenderliche Inhalte liegen in einem separaten oeffentlichen GitHub-Pages-Repository, zum Beispiel `ffrastenfeld-content`.

Struktur im Content-Repository:

```text
posts.json
img/
  posts/
    beispiel-beitrag/
      bild-01.jpeg
```

GitHub Pages veroeffentlicht diese Dateien kostenlos als statische Dateien. Die Blazor-App lädt `posts.json` zur Laufzeit und loest Beitragsbilder ueber `ImageBaseUrl` auf. Aenderungen am Content-Repository loesen keinen Netlify-Deploy aus.

## Einmalige Website-Konfiguration

In `wwwroot/appsettings.json` die lokalen Werte durch die GitHub-Pages-URLs ersetzen:

```json
{
  "WebsiteData": {
    "PostsUrl": "https://<github-user>.github.io/ffrastenfeld-content/posts.json",
    "FallbackPostsUrl": "data/posts.json",
    "ImageBaseUrl": "https://<github-user>.github.io/ffrastenfeld-content/img",
    "CacheBustingMinutes": 5
  }
}
```

Danach die Website einmalig deployen. Ab dann werden neue Daten bei Seitenaufruf aus GitHub Pages geladen. `FallbackPostsUrl` bleibt lokal, damit die Seite bei einem Ausfall des externen Hosts nicht komplett leer ist.

## WhatsApp-Bot auf Content-Repository umstellen

Das Content-Repository lokal neben dem Website-Repo klonen, zum Beispiel:

```text
C:\Users\lukas\RiderProjects\Feuerwehr\ffrastenfeld-content
```

Dann in `whatsapp-bot/.env`:

```env
POSTS_JSON_PATH=../../ffrastenfeld-content/posts.json
PUBLIC_IMAGE_DIR=../../ffrastenfeld-content/img/posts
```

Wenn der Bot mit `ONLINE` veroeffentlicht, schreibt er dann in das Content-Repository. Anschliessend nur dieses Content-Repository committen und pushen.

## Hinweise

- Das Content-Repository muss oeffentlich sein, weil die Website die JSON-Datei und Bilder direkt im Browser laedt.
- Keine Geheimnisse, internen Daten, Telefonnummern von Privatpersonen oder personenbezogene Einsatzdetails in `posts.json` speichern.
- GitHub Pages setzt fuer oeffentliche Seiten CORS-Header, die Browser-Fetches von der Netlify-Domain erlauben.
- `CacheBustingMinutes` steuert, wie schnell Aenderungen sichtbar werden. Bei `5` kann es bis zu etwa fuenf Minuten dauern.
- SEO: Die Blazor-WASM-Seite rendert Inhalte clientseitig. Das ist bereits heute so. Externe Runtime-Daten verbessern die Deploy-Kosten, machen aber keine serverseitig vorgerenderten Detailseiten.
