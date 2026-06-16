import fs from "node:fs/promises";
import path from "node:path";
import { generateJsonWithGemini } from "./geminiClient.js";
import { generateJsonWithOllama } from "./ollamaClient.js";
import { buildDraftPrompt } from "./prompts.js";
import { redactForExternalAi, redactObjectForExternalAi } from "./redaction.js";

export async function createPostDraft({
  folderPath,
  originalText,
  data,
  meta,
  research,
  config,
  revisionInstruction = ""
}) {
  const fallback = buildFallbackDraft({ originalText, data, meta, research });
  const styleExamples = await loadStyleExamples(config.postsJsonPath, data?.category);
  const redactionEnabled = config.redactSensitiveData !== false;
  const redactedText = redactForExternalAi(originalText, redactionEnabled);
  const redactedData = redactObjectForExternalAi(data, redactionEnabled);
  const redactedMeta = redactObjectForExternalAi(meta, redactionEnabled);

  if (!config.aiEnabled) {
    return {
      aiAvailable: false,
      error: "AI_ENABLED ist false.",
      draft: {
        ...fallback,
        sourceNotes: [...fallback.sourceNotes, "KI war deaktiviert; Entwurf ist ein einfacher Fallback."]
      }
    };
  }

  const prompt = buildDraftPrompt({
    originalText: redactedText.text,
    data: redactedData.value,
    meta: { ...redactedMeta.value, folderName: path.basename(folderPath) },
    research,
    styleExamples,
    revisionInstruction,
    provider: config.aiProvider || "gemini"
  });

  await fs.writeFile(path.join(folderPath, "ki-prompt.txt"), prompt, "utf8");

  const result = await callAiProvider({
    folderPath,
    prompt,
    data,
    config
  });

  if (!result.ok) {
    return {
      aiAvailable: false,
      error: result.error,
      redactionReport: mergeRedactionReports(redactedText.report, redactedData.report, redactedMeta.report),
      researchMetadata: result.metadata || null,
      draft: {
        ...fallback,
        sourceNotes: [...fallback.sourceNotes, `KI momentan nicht verfuegbar oder ungueltig: ${result.error}`]
      }
    };
  }

  return {
    aiAvailable: true,
    rawText: result.text,
    redactionReport: mergeRedactionReports(redactedText.report, redactedData.report, redactedMeta.report),
    researchMetadata: result.metadata || null,
    draft: normalizeDraft(result.data, fallback)
  };
}

async function callAiProvider({ folderPath, prompt, data, config }) {
  const provider = String(config.aiProvider || "gemini").toLowerCase();

  if (provider === "gemini") {
    return generateJsonWithGemini({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      prompt,
      folderPath,
      data,
      useGoogleSearch: config.geminiUseGoogleSearch && (config.geminiForceGoogleSearch || shouldUseGoogleSearch(data)),
      sendImages: config.geminiSendImages !== false,
      timeoutMs: config.aiTimeoutMs
    });
  }

  if (provider === "ollama") {
    return generateJsonWithOllama({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      numCtx: config.ollamaNumCtx,
      prompt,
      timeoutMs: config.aiTimeoutMs
    });
  }

  return { ok: false, error: `Unbekannter AI_PROVIDER '${provider}'.` };
}

function shouldUseGoogleSearch(data) {
  const category = normalizeCategory(data?.category || data?.fields?.kategorie || "FF-News");
  if (category === "EinsÃ¤tze") return false;
  return ["FF-News", "Ausbildung", "Feuerwehrjugend"].includes(category);
}

function mergeRedactionReports(...reports) {
  return {
    enabled: reports.some((report) => report?.enabled),
    replacements: reports.flatMap((report) => report?.replacements || [])
  };
}

export function buildFallbackDraft({ originalText, data, meta, research }) {
  const fields = data?.fields || {};
  const category = normalizeCategory(data?.category || fields.kategorie || "FF-News");
  const missingInfo = Array.isArray(data?.missingInfo) ? data.missingInfo : [];
  const firstLine = cleanText(originalText).split(/[.!?\n]/).find(Boolean) || "";
  const titleBase = fields.beschreibung || firstLine || category;
  const date = normalizeDate(fields.datum) || normalizeDate(meta?.messageDate) || "";
  const time = normalizeTime(fields.uhrzeit) || "";
  const location = fields.ort || "";
  const title = makeTitle(titleBase, category, location);
  const shortText = makeShortText(originalText, category, location);

  return {
    title,
    slug: slugify([date, category, location, title].filter(Boolean).join(" ")),
    category,
    date,
    time,
    location,
    shortText,
    fullText: cleanText(originalText) || "Zu diesem Beitrag wurden noch keine weiteren Informationen ergaenzt.",
    imageCaptions: (data?.images || []).map((image) => ({
      fileName: image.fileName,
      publishAllowed: image.publishAllowed !== false,
      caption: image.caption || ""
    })),
    missingInfo,
    safetyWarnings: collectSafetyWarnings(data, category),
    sourceNotes: [
      "WhatsApp-Rohdaten wurden lokal gespeichert.",
      research?.performed ? "Recherche-Snippets wurden als Vorschlag beruecksichtigt." : "Keine sichere Online-Recherche verwendet."
    ],
    status: missingInfo.length > 0 ? "needs_review" : "ready"
  };
}

function normalizeDraft(value, fallback) {
  const draft = value && typeof value === "object" ? value : {};
  const missingInfo = asStringArray(draft.missingInfo);
  const safetyWarnings = asStringArray(draft.safetyWarnings);
  const status = draft.status === "ready" && missingInfo.length === 0 ? "ready" : "needs_review";

  return {
    title: cleanText(draft.title) || fallback.title,
    slug: slugify(draft.slug || draft.title || fallback.slug) || fallback.slug,
    category: normalizeCategory(draft.category || fallback.category),
    date: normalizeDate(draft.date) || fallback.date,
    time: normalizeTime(draft.time) || fallback.time,
    location: cleanText(draft.location) || fallback.location,
    shortText: cleanText(draft.shortText) || fallback.shortText,
    fullText: cleanText(draft.fullText) || fallback.fullText,
    imageCaptions: Array.isArray(draft.imageCaptions) ? draft.imageCaptions : fallback.imageCaptions,
    missingInfo,
    safetyWarnings,
    sourceNotes: asStringArray(draft.sourceNotes).length > 0 ? asStringArray(draft.sourceNotes) : fallback.sourceNotes,
    status
  };
}

async function loadStyleExamples(postsJsonPath, category) {
  try {
    const posts = JSON.parse(await fs.readFile(postsJsonPath, "utf8"));
    if (!Array.isArray(posts)) return [];

    const preferred = posts.filter((post) => post.Kategorie === category);
    const examples = (preferred.length > 0 ? preferred : posts).slice(0, 4);
    return examples.map((post) => ({
      title: post.Titel,
      category: post.Kategorie,
      shortText: post.Kurztext,
      fullText: String(post.Volltext || "").slice(0, 1200)
    }));
  } catch {
    return [];
  }
}

function collectSafetyWarningsLegacy(data, category) {
  const warnings = [];
  const images = Array.isArray(data?.images) ? data.images : [];

  if (images.some((image) => image.publishAllowed === false)) {
    warnings.push("Mindestens ein Bild ist nur als Kontext markiert und darf nicht veroeffentlicht werden.");
  }

  if (category === "Einsätze") {
    warnings.push("Bei Einsaetzen sensible Details, Personen, Kennzeichen, Ursachen und Verletzungen nicht erfinden.");
  }

  return warnings;
}

function collectSafetyWarnings(data, category) {
  const warnings = [];
  const images = Array.isArray(data?.images) ? data.images : [];

  if (images.some((image) => image.publishAllowed === false)) {
    warnings.push("Mindestens ein Bild ist nur als Kontext markiert und darf nicht veroeffentlicht werden.");
  }

  if (category === "Einsätze") {
    warnings.push("Bei Einsaetzen sensible Details, Personen, Kennzeichen, Ursachen und Verletzungen nicht erfinden.");
  }

  return warnings;
}

function makeTitleLegacy(text, category, location) {
  const cleaned = cleanText(text);
  if (!cleaned) return category === "Einsätze" ? `Einsatz${location ? ` in ${location}` : ""}` : "Bericht der FF Rastenfeld";

  const title = cleaned.length > 70 ? `${cleaned.slice(0, 67).trim()}...` : cleaned;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function makeTitle(text, category, location) {
  const cleaned = cleanText(text);
  if (!cleaned) return category === "Einsätze" ? `Einsatz${location ? ` in ${location}` : ""}` : "Bericht der FF Rastenfeld";

  const title = cleaned.length > 70 ? `${cleaned.slice(0, 67).trim()}...` : cleaned;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function makeShortTextLegacy(text, category, location) {
  const cleaned = cleanText(text);
  if (cleaned) return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
  if (category === "Einsätze") return `Die FF Rastenfeld wurde${location ? ` nach ${location}` : ""} alarmiert.`;
  return "Die FF Rastenfeld berichtet ueber aktuelle Aktivitaeten und Ereignisse.";
}

function makeShortText(text, category, location) {
  const cleaned = cleanText(text);
  if (cleaned) return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
  if (category === "Einsätze") return `Die FF Rastenfeld wurde${location ? ` nach ${location}` : ""} alarmiert.`;
  return "Die FF Rastenfeld berichtet ueber aktuelle Aktivitaeten und Ereignisse.";
}

function normalizeCategoryLegacy(value) {
  const normalized = normalizeForMatch(value);
  if (normalized.includes("eins")) return "Einsätze";
  if (normalized.includes("ausbildung") || normalized.includes("uebung") || normalized.includes("ubung")) return "Ausbildung";
  if (normalized.includes("jugend")) return "Feuerwehrjugend";
  return "FF-News";
}

function normalizeCategory(value) {
  const normalized = normalizeForMatch(value);
  if (normalized.includes("eins")) return "Einsätze";
  if (normalized.includes("ausbildung") || normalized.includes("uebung") || normalized.includes("ubung")) return "Ausbildung";
  if (normalized.includes("jugend")) return "Feuerwehrjugend";
  return "FF-News";
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (!text) return "";

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dotted = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})/.exec(text);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }

  return "";
}

function normalizeTime(value) {
  const text = cleanText(value).replace(".", ":");
  const match = /(\d{1,2}):(\d{2})/.exec(text);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;

  const hour = /(\d{1,2})\s*uhr/i.exec(text);
  if (hour) return `${hour[1].padStart(2, "0")}:00`;

  return "";
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function cleanText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function normalizeForMatch(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function slugify(value) {
  return normalizeForMatch(value)
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
