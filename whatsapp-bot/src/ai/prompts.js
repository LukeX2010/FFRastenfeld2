export function buildDraftPrompt({
  originalText,
  data,
  meta,
  research,
  styleExamples = [],
  revisionInstruction = "",
  provider = "gemini"
}) {
  return [
    "Du bist der Redaktionsassistent der Freiwilligen Feuerwehr Rastenfeld.",
    `KI-Anbieter: ${provider}.`,
    "Erstelle aus lokal gespeicherten WhatsApp-Rohdaten einen sachlichen Website-Beitragsentwurf.",
    "",
    "Stil:",
    "- Offiziell, ruhig, sachlich, freundlich.",
    "- Passend fuer eine Feuerwehr-Website.",
    "- Keine Werbung, keine Uebertreibung, keine Chat-Sprache.",
    "- Deutsche Umlaute korrekt verwenden: ä, ö, ü, ß.",
    "- Bei Ehrungen, Bewerben und Veranstaltungen neutral als Bericht formulieren.",
    "",
    "Harte Regeln:",
    "- Erfinde keine Fakten.",
    "- Trenne Fakten aus WhatsApp, Online-Recherche und Unsicherheiten.",
    "- Wenn Informationen fehlen, neutral formulieren und in missingInfo nennen.",
    "- Bei Einsaetzen keine Ursachen, Schuld, Verletzungen, Personen, Kennzeichen oder sensible Details erfinden.",
    "- Bilder mit publishAllowed=false niemals als Website-Bild vorschlagen; sie duerfen nur als Kontext dienen.",
    "- Online-Daten nur verwenden, wenn sie eindeutig zum Thema passen.",
    "- Wenn eine Quelle unsicher ist oder nicht passt, nicht verwenden.",
    "- Wenn Google Search/Grounding Quellen liefert, nenne sie kurz in sourceNotes.",
    "",
    revisionInstruction
      ? `Ueberarbeitungswunsch des Nutzers: ${revisionInstruction}`
      : "Kein Ueberarbeitungswunsch; erstelle einen neuen Entwurf.",
    "",
    "Gib ausschliesslich ein gueltiges JSON-Objekt in diesem Schema aus:",
    JSON.stringify({
      title: "kurzer, passender Titel",
      slug: "url-tauglicher-slug",
      category: "Einsätze | Ausbildung | Feuerwehrjugend | FF-News",
      date: "YYYY-MM-DD oder leer",
      time: "HH:mm oder leer",
      location: "Ort oder leer",
      shortText: "1-2 Saetze",
      fullText: "vollstaendiger Website-Bericht mit Absätzen",
      imageCaptions: [
        {
          fileName: "bild-01.jpeg",
          publishAllowed: true,
          caption: "neutraler Bildtext oder leer"
        }
      ],
      missingInfo: ["fehlende Information"],
      safetyWarnings: ["Datenschutz-/Sicherheitswarnung"],
      sourceNotes: [
        "WhatsApp: ...",
        "Online: ...",
        "Unsicher: ..."
      ],
      status: "needs_review oder ready"
    }, null, 2),
    "",
    "Originalnachricht aus WhatsApp, fuer externe KI bereits bereinigt:",
    originalText || "(kein Text)",
    "",
    "Strukturierte Bot-Daten, fuer externe KI bereits bereinigt:",
    JSON.stringify(data || {}, null, 2),
    "",
    "Meta:",
    JSON.stringify({
      folderName: meta?.folderName,
      messageDate: meta?.messageDate,
      imageCount: meta?.imageCount,
      detectedImageCount: meta?.detectedImageCount
    }, null, 2),
    "",
    "Lokale Recherche-Snippets:",
    JSON.stringify(research || { enabled: false, results: [] }, null, 2),
    "",
    "Stilbeispiele bestehender Website-Beitraege:",
    JSON.stringify(styleExamples, null, 2)
  ].join("\n");
}
