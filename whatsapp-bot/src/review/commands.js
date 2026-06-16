export function parseReviewCommand(text) {
  const raw = String(text || "").trim();
  const normalized = normalize(raw);

  if (!raw) return null;
  if (["start", "neu", "neuer beitrag", "@bot", "@bot start", "bot start"].includes(normalized)) {
    return { type: "start", label: "START" };
  }
  if (["stop", "ende"].includes(normalized)) return { type: "finish", label: "STOP" };

  const numberMap = {
    "1": { type: "preview", label: "VORSCHAU" },
    "2": { type: "details", label: "DETAILS" },
    "3": { type: "images", label: "BILDER" },
    "4": { type: "sources", label: "QUELLEN" },
    "5": { type: "research", label: "RECHERCHE" },
    "6": { type: "menu", label: "MENUE" },
    "7": { type: "style", style: "offizieller", label: "STIL" }
  };
  if (numberMap[normalized]) return numberMap[normalized];

  if (["menu", "menue", "m"].includes(normalized)) return { type: "menu", label: "MENUE" };
  if (["hilfe", "help", "?"].includes(normalized)) return { type: "help", label: "HILFE" };
  if (["status", "s"].includes(normalized)) return { type: "status", label: "STATUS" };
  if (["vorschau", "v"].includes(normalized)) return { type: "preview", label: "VORSCHAU" };
  if (["details", "d"].includes(normalized)) return { type: "details", label: "DETAILS" };
  if (["quellen", "quelle", "q"].includes(normalized)) return { type: "sources", label: "QUELLEN" };
  if (["recherche", "r"].includes(normalized)) return { type: "research", label: "RECHERCHE" };
  if (["bilder", "bild", "b"].includes(normalized)) return { type: "images", label: "BILDER" };
  if (normalized === "ok") return { type: "approve", label: "OK" };
  if (["abbruch", "x"].includes(normalized)) return { type: "reject", label: "ABBRUCH" };
  if (["fertig", "done"].includes(normalized)) return { type: "finish", label: "FERTIG" };
  if (/^online\s+tro(tz|z)dem$/.test(normalized)) return { type: "publish", force: true, label: "ONLINE TROTZDEM" };
  if (normalized === "online") return { type: "publish", force: false, label: "ONLINE" };

  const imageCommand = /^bild\s+(\d+)\s+(ja|nein|titel)$/i.exec(normalized);
  if (imageCommand) {
    return {
      type: imageCommand[2] === "titel" ? "imageTitle" : "imageSet",
      index: Number(imageCommand[1]),
      publishAllowed: imageCommand[2] === "ja",
      label: "BILD"
    };
  }

  const separator = raw.indexOf(":");
  if (separator > 0) {
    const command = normalize(raw.slice(0, separator));
    const value = raw.slice(separator + 1).trim();

    if (["suche", "search"].includes(command)) return { type: "search", query: value, label: "SUCHE" };
    if (["andern", "aendern", "change"].includes(command)) return { type: "change", instruction: value, label: "AENDERN" };
    if (command === "stil") return { type: "style", style: normalize(value), rawStyle: value, label: "STIL" };
    if (["kategorie", "category"].includes(command)) return { type: "fieldSet", field: "category", value, label: "KATEGORIE" };
    if (["datum", "date"].includes(command)) return { type: "fieldSet", field: "date", value, label: "DATUM" };
    if (["uhrzeit", "zeit", "time"].includes(command)) return { type: "fieldSet", field: "time", value, label: "UHRZEIT" };
    if (["ort", "location"].includes(command)) return { type: "fieldSet", field: "location", value, label: "ORT" };
  }

  return null;
}

export function parseReviewCommands(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const single = parseReviewCommand(raw);
  if (single) return [single];

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const commands = lines.map((line) => parseReviewCommand(line));
  return commands.every(Boolean) ? commands : [];
}

export function isReviewCommand(text) {
  return parseReviewCommands(text).length > 0;
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ü/g, "u")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ß/g, "ss");
}
