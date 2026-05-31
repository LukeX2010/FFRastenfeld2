import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  fetchLatestBaileysVersion,
  getContentType,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const botRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(botRoot, "..");

await loadDotEnv(path.join(botRoot, ".env"));

const outputDir = path.resolve(botRoot, process.env.OUTPUT_DIR || "../wwwroot/img/Bearbeiten");
const allowedChatIds = (process.env.ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ignoreOwnMessages = parseBoolean(process.env.IGNORE_OWN_MESSAGES, false);
const saveAllGroups = parseBoolean(process.env.SAVE_ALL_GROUPS);
const printChatIds = parseBoolean(process.env.PRINT_CHAT_IDS, true);
const replyInWhatsApp = parseBoolean(process.env.REPLY_IN_WHATSAPP, true);
const batchWindowMs = Number(process.env.BATCH_WINDOW_MS || 15000);
const followupWindowMs = Number(process.env.FOLLOWUP_WINDOW_MS || 30 * 60 * 1000);
const pendingBatches = new Map();
const openFollowups = new Map();
const CATEGORY_EINSAETZE = "Eins\u00e4tze";
const CATEGORY_AUSBILDUNG = "Ausbildung";
const CATEGORY_JUGEND = "Feuerwehrjugend";
const CATEGORY_NEWS = "FF-News";

await fs.mkdir(outputDir, { recursive: true });

console.log("WhatsApp Bot gestartet");
console.log(`Projektroot: ${projectRoot}`);
console.log(`Zielordner:  ${outputDir}`);
console.log(
  allowedChatIds.length > 0
    ? `Aktive Gruppen: ${allowedChatIds.join(", ")}`
    : "Noch keine Gruppe konfiguriert. Gruppen-IDs werden nur angezeigt."
);

startBot();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(botRoot, "auth_info_baileys"));
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`WhatsApp-Web-Version: ${version.join(".")} (${isLatest ? "aktuell" : "nicht aktuell"})`);

  const sock = makeWASocket({
    auth: state,
    version,
    browser: ["FF Rastenfeld Bot", "Chrome", "1.0.0"],
    logger: P({ level: "warn" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("QR-Code mit WhatsApp unter 'Verknuepfte Geraete' scannen:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("WhatsApp verbunden.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`Verbindung geschlossen. Status: ${statusCode ?? "unbekannt"}`);

      if (!loggedOut) {
        console.log("Verbinde erneut...");
        setTimeout(() => startBot(), 5000);
      } else {
        console.log("Ausgeloggt. Ordner whatsapp-bot/auth_info_baileys loeschen und neu scannen.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      try {
        await handleMessage(sock, message);
      } catch (error) {
        console.error("Nachricht konnte nicht gespeichert werden:", error);
      }
    }
  });
}

async function handleMessage(sock, message) {
  if (!message.message) return;
  if (ignoreOwnMessages && message.key.fromMe) return;

  const chatId = message.key.remoteJid || "";
  if (!chatId.endsWith("@g.us")) return;

  const text = extractText(message.message);
  const mediaParts = extractMediaParts(message.message);
  if (isBotReply(text)) return;

  if (printChatIds) {
    console.log(`Gruppe erkannt: ${chatId}${text ? ` | ${text.slice(0, 80)}` : ""}`);
  }

  const maySave = saveAllGroups || allowedChatIds.includes(chatId);
  if (!maySave) return;
  if (!text && mediaParts.length === 0) return;

  const openFollowup = openFollowups.get(chatId);
  if (openFollowup && Date.now() <= openFollowup.expiresAt) {
    addToFollowupBatch(sock, chatId, message, text, mediaParts, openFollowup);
    return;
  }

  if (openFollowup) {
    openFollowups.delete(chatId);
  }

  const diskFollowup = await findOpenFollowupForChat(chatId);
  if (diskFollowup) {
    openFollowups.set(chatId, diskFollowup);
    addToFollowupBatch(sock, chatId, message, text, mediaParts, diskFollowup);
    return;
  }

  addToBatch(sock, chatId, message, text, mediaParts);
}

function addToBatch(sock, chatId, message, text, mediaParts) {
  const existing = pendingBatches.get(chatId);
  if (existing?.timer) clearTimeout(existing.timer);

  const batch = existing || {
    sock,
    chatId,
    firstMessage: message,
    messages: [],
    texts: [],
    mediaMessages: []
  };

  batch.sock = sock;
  batch.messages.push(message);
  if (text) batch.texts.push(text);
  if (mediaParts.length > 0) {
    batch.mediaMessages.push({
      message,
      parts: mediaParts
    });
  }

  batch.timer = setTimeout(() => {
    pendingBatches.delete(chatId);
    saveBatch(batch).catch((error) => console.error("Paket konnte nicht gespeichert werden:", error));
  }, batchWindowMs);

  pendingBatches.set(chatId, batch);
  console.log(`Nachricht vorgemerkt. Speichern in ${Math.round(batchWindowMs / 1000)} Sekunden...`);
}

function addToFollowupBatch(sock, chatId, message, text, mediaParts, openFollowup) {
  const batchKey = `${chatId}:followup`;
  const existing = pendingBatches.get(batchKey);
  if (existing?.timer) clearTimeout(existing.timer);

  const batch = existing || {
    sock,
    chatId,
    firstMessage: message,
    messages: [],
    texts: [],
    mediaMessages: [],
    followup: openFollowup
  };

  batch.sock = sock;
  batch.messages.push(message);
  if (text) batch.texts.push(text);
  if (mediaParts.length > 0) {
    batch.mediaMessages.push({
      message,
      parts: mediaParts
    });
  }

  batch.timer = setTimeout(() => {
    pendingBatches.delete(batchKey);
    appendFollowup(batch).catch((error) => console.error("Zusatzinfo konnte nicht gespeichert werden:", error));
  }, batchWindowMs);

  pendingBatches.set(batchKey, batch);
  console.log(`Zusatzinfo vorgemerkt. Aktualisieren in ${Math.round(batchWindowMs / 1000)} Sekunden...`);
}

async function saveBatch(batch) {
  const text = batch.texts.join("\n\n");
  const timestamp = getMessageDate(batch.firstMessage);
  const fields = extractFields(text);
  const analysis = analyzeMessage(text, countDetectedImages(batch.mediaMessages), fields);
  const folderName = await createUniqueFolderName(timestamp, text || analysis.category);
  const folderPath = path.join(outputDir, folderName);
  await fs.mkdir(folderPath, { recursive: true });

  await fs.writeFile(path.join(folderPath, "nachricht.txt"), text || "", "utf8");
  await fs.writeFile(path.join(folderPath, "daten.json"), `${JSON.stringify(fields, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(folderPath, "kategorie.txt"), `${analysis.category}\n`, "utf8");
  await fs.writeFile(path.join(folderPath, "analyse.txt"), buildAnalysisText(analysis), "utf8");

  const { savedImages, imageErrors } = await saveImages(folderPath, batch.mediaMessages, 0);

  const meta = {
    chatId: batch.chatId,
    messageIds: batch.messages.map((item) => item.key.id).filter(Boolean),
    sender: batch.firstMessage.key.participant || null,
    receivedAt: new Date().toISOString(),
    messageDate: timestamp.toISOString(),
    category: analysis.category,
    fields,
    missingInfo: analysis.missingInfo,
    text,
    imageCount: savedImages.length,
    detectedImageCount: countDetectedImages(batch.mediaMessages),
    images: savedImages,
    imageErrors
  };

  await fs.writeFile(path.join(folderPath, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`Gespeichert: ${folderPath}`);

  if (analysis.missingInfo.length > 0) {
    openFollowups.set(batch.chatId, {
      folderName,
      folderPath,
      category: analysis.category,
      missingInfo: analysis.missingInfo,
      expiresAt: Date.now() + followupWindowMs
    });
  } else {
    openFollowups.delete(batch.chatId);
  }

  if (replyInWhatsApp) {
    const detectedImageCount = countDetectedImages(batch.mediaMessages);
    await batch.sock.sendMessage(
      batch.chatId,
      { text: buildReplyText(analysis, savedImages.length, folderName, false, detectedImageCount) },
      { quoted: batch.firstMessage }
    );
  }
}

async function appendFollowup(batch) {
  const followup = batch.followup;
  const existingText = await readTextFile(path.join(followup.folderPath, "nachricht.txt"));
  const additionText = batch.texts.join("\n\n");
  const combinedText = [existingText, additionText].filter(Boolean).join("\n\n--- Zusatzinfo ---\n\n");
  const existingMeta = await readJsonFile(path.join(followup.folderPath, "meta.json"));
  const existingFields = await readJsonFile(path.join(followup.folderPath, "daten.json"));
  const additionFields = extractFields(additionText, followup.missingInfo);
  const combinedFields = mergeFields(existingFields, additionFields);
  const existingImageCount = Number(existingMeta.images?.length || existingMeta.imageCount || 0);
  const { savedImages, imageErrors } = await saveImages(followup.folderPath, batch.mediaMessages, existingImageCount);
  const allImages = [...(existingMeta.images || []), ...savedImages];
  const allErrors = [...(existingMeta.imageErrors || []), ...imageErrors];
  const analysis = analyzeMessage(combinedText, allImages.length, combinedFields);

  await fs.writeFile(path.join(followup.folderPath, "nachricht.txt"), combinedText, "utf8");
  await fs.writeFile(path.join(followup.folderPath, "daten.json"), `${JSON.stringify(combinedFields, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(followup.folderPath, "kategorie.txt"), `${analysis.category}\n`, "utf8");
  await fs.writeFile(path.join(followup.folderPath, "analyse.txt"), buildAnalysisText(analysis), "utf8");

  const meta = {
    ...existingMeta,
    category: analysis.category,
    fields: combinedFields,
    missingInfo: analysis.missingInfo,
    text: combinedText,
    imageCount: allImages.length,
    detectedImageCount: Number(existingMeta.detectedImageCount || 0) + countDetectedImages(batch.mediaMessages),
    images: allImages,
    imageErrors: allErrors,
    followupMessageIds: [
      ...(existingMeta.followupMessageIds || []),
      ...batch.messages.map((item) => item.key.id).filter(Boolean)
    ],
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(path.join(followup.folderPath, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  if (analysis.missingInfo.length > 0) {
    openFollowups.set(batch.chatId, {
      folderName: followup.folderName,
      folderPath: followup.folderPath,
      category: analysis.category,
      missingInfo: analysis.missingInfo,
      expiresAt: Date.now() + followupWindowMs
    });
  } else {
    openFollowups.delete(batch.chatId);
  }

  console.log(`Aktualisiert: ${followup.folderPath}`);

  if (replyInWhatsApp) {
    const detectedImageCount = Number(meta.detectedImageCount || allImages.length);
    await batch.sock.sendMessage(
      batch.chatId,
      { text: buildReplyText(analysis, allImages.length, followup.folderName, true, detectedImageCount) },
      { quoted: batch.firstMessage }
    );
  }
}

function extractText(message) {
  const content = extractMessageContent(message) || message;
  const direct =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.albumMessage?.caption ||
    "";

  return normalizeWhitespace(direct);
}

function extractMediaParts(message) {
  const content = extractMessageContent(message) || message;
  const contentType = getContentType(content);
  const parts = [];

  if (content.imageMessage) {
    parts.push({
      kind: "image",
      contentType,
      mimetype: content.imageMessage.mimetype,
      caption: content.imageMessage.caption
    });
  }

  return parts;
}

function getMessageDate(message) {
  const seconds = Number(message.messageTimestamp || 0);
  return seconds > 0 ? new Date(seconds * 1000) : new Date();
}

async function createUniqueFolderName(date, text) {
  const datePart = formatDateForFolder(date);
  const textPart = slugify(text).slice(0, 60) || "whatsapp-nachricht";
  const baseName = `${datePart}_${textPart}`;

  for (let index = 0; index < 100; index++) {
    const suffix = index === 0 ? "" : `-${String(index + 1).padStart(2, "0")}`;
    const candidate = `${baseName}${suffix}`;

    try {
      await fs.access(path.join(outputDir, candidate));
    } catch {
      return candidate;
    }
  }

  return `${baseName}-${Date.now()}`;
}

function formatDateForFolder(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function mimeToExtension(mimetype = "") {
  if (mimetype.includes("png")) return "png";
  if (mimetype.includes("webp")) return "webp";
  if (mimetype.includes("gif")) return "gif";
  return "jpeg";
}

async function saveImages(folderPath, mediaMessages, existingCount) {
  const savedImages = [];
  const imageErrors = [];
  let imageIndex = existingCount;

  for (const mediaMessage of mediaMessages) {
    for (const media of mediaMessage.parts) {
      imageIndex++;
      const extension = mimeToExtension(media.mimetype);
      const fileName = `bild-${String(imageIndex).padStart(2, "0")}.${extension}`;

      try {
        const buffer = await downloadMediaMessage(mediaMessage.message, "buffer", {});
        await fs.writeFile(path.join(folderPath, fileName), buffer);
        savedImages.push({
          fileName,
          mimetype: media.mimetype || null,
          caption: media.caption || null,
          messageId: mediaMessage.message.key.id || null
        });
      } catch (error) {
        imageErrors.push({
          fileName,
          mimetype: media.mimetype || null,
          messageId: mediaMessage.message.key.id || null,
          error: error?.message || String(error)
        });
      }
    }
  }

  return { savedImages, imageErrors };
}

function countDetectedImages(mediaMessages) {
  return mediaMessages.reduce((sum, item) => sum + item.parts.length, 0);
}

async function readTextFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function findOpenFollowupForChat(chatId) {
  let entries = [];

  try {
    entries = await fs.readdir(outputDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const folderPath = path.join(outputDir, entry.name);
    const meta = await readJsonFile(path.join(folderPath, "meta.json"));
    if (meta.chatId !== chatId || !Array.isArray(meta.missingInfo) || meta.missingInfo.length === 0) continue;

    const timestamp = Date.parse(meta.updatedAt || meta.receivedAt || meta.messageDate || "");
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > followupWindowMs) continue;

    candidates.push({
      folderName: entry.name,
      folderPath,
      category: meta.category || CATEGORY_NEWS,
      missingInfo: meta.missingInfo,
      expiresAt: timestamp + followupWindowMs,
      timestamp
    });
  }

  candidates.sort((a, b) => b.timestamp - a.timestamp);
  return candidates[0] || null;
}

function analyzeMessage(text, imageCount = 0, fields = extractFields(text)) {
  const normalized = normalizeForAnalysis(text);
  const category = fields.kategorie || detectCategory(text);
  const missingInfo = [];
  const hasAnyText = normalizeWhitespace(text).length > 0;

  if (!hasAnyText && imageCount > 0) {
    return {
      category,
      missingInfo: [
        "kurze Beschreibung",
        "Datum",
        category === CATEGORY_EINSAETZE ? "Einsatzort" : "Ort/Veranstaltungsort"
      ]
    };
  }

  if (!fields.datum && !hasDate(text)) missingInfo.push("Datum");

  if (category === CATEGORY_EINSAETZE) {
    if (!fields.uhrzeit && !hasTime(text)) missingInfo.push("Alarmzeit/Uhrzeit");
    if (!fields.ort && !hasPlace(text)) missingInfo.push("Einsatzort");
    if (!fields.beschreibung && !/(einsatz|alarm|t\d|b\d|s\d|vu|verkehrsunfall|brand|bergung|menschenrettung|unwetter)/i.test(normalized)) {
      missingInfo.push("Einsatzart");
    }
  } else {
    if (!fields.ort && !hasPlace(text)) missingInfo.push("Ort/Veranstaltungsort");
    if (!fields.beschreibung && !hasEventTopic(text)) missingInfo.push("was genau passiert ist");
  }

  return { category, missingInfo: [...new Set(missingInfo)] };
}

function legacyDetectCategory(lower) {
  if (/(einsatz|alarm|alarmierung|t\d|b\d|s\d|vu|verkehrsunfall|brand|bergung|menschenrettung|unwetter|technischer einsatz)/i.test(lower)) {
    return "Einsätze";
  }

  if (/(ausbildung|uebung|übung|schulung|atemschutz|funkuebung|funkübung|einsatzuebung|einsatzübung|mitgliederschulung)/i.test(lower)) {
    return "Ausbildung";
  }

  if (/(feuerwehrjugend|jugend|bewerb der jugend|wissenstest|fertigkeitsabzeichen|kinderfeuerwehr)/i.test(lower)) {
    return "Feuerwehrjugend";
  }

  return "FF-News";
}

function legacyHasDate(text) {
  return /(\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b|\b\d{1,2}\.\s?(januar|februar|maerz|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|\bheute\b|\bgestern\b|\bmorgen\b)/i.test(text);
}

function legacyHasTime(text) {
  return /(\b\d{1,2}:\d{2}\b|\b\d{1,2}\.\d{2}\s?uhr\b|\b\d{1,2}\s?uhr\b)/i.test(text);
}

function legacyHasPlace(text) {
  return /(\b(in|bei|auf|am)\s+[A-ZÄÖÜA-Za-zÃ¤Ã¶Ã¼Ã„Ã–Ãœ][\wÃ¤Ã¶Ã¼Ã„Ã–ÃœÃŸ-]+|\b(ort|einsatzort)\b|rastenfeld|rastenberg|peygarten|ottenstein|niedernondorf|haderdorf|hadersdorf|b38|b 38|l8245|l 8245)/i.test(text);
}

function legacyHasEventTopic(text) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length >= 35) return true;

  return /(bewerb|wettkampf|wettk[aä]mpf|fest|messe|floriani|wandertag|maibaum|ausflug|begehung|anschaffung|ehrung|besuch|veranstaltung|uebung|übung|ausbildung|jugend|feuerwehrjugend|einsatz)/i.test(text);
}

function extractFields(text, missingInfo = []) {
  const fields = {
    kategorie: readField(text, ["kategorie", "category"]),
    datum: readField(text, ["datum", "date"]),
    uhrzeit: readField(text, ["uhrzeit", "zeit", "alarmzeit"]),
    ort: readField(text, ["ort", "veranstaltungsort", "einsatzort"]),
    beschreibung: readField(text, ["beschreibung", "info", "text", "was"])
  };

  if (fields.kategorie) fields.kategorie = normalizeCategory(fields.kategorie);

  const shortText = normalizeWhitespace(text);
  const hasExplicitFields = Object.values(fields).some(Boolean);
  if (!hasExplicitFields && shortText && shortText.length <= 60) {
    if (missingInfo.some((item) => item.toLowerCase().includes("ort"))) {
      fields.ort = shortText;
    } else if (missingInfo.some((item) => item.toLowerCase().includes("datum"))) {
      fields.datum = shortText;
    } else if (missingInfo.some((item) => item.toLowerCase().includes("beschreibung") || item.toLowerCase().includes("was genau"))) {
      fields.beschreibung = shortText;
    }
  }

  if (!fields.kategorie) fields.kategorie = detectCategory(text);
  if (!fields.datum && hasDate(text)) fields.datum = extractDateValue(text);
  if (!fields.uhrzeit && hasTime(text)) fields.uhrzeit = extractTimeValue(text);

  return fields;
}

function readField(text, names) {
  for (const name of names) {
    const match = new RegExp(`(?:^|\\n)\\s*${name}\\s*:\\s*(.+)`, "i").exec(text);
    if (match) return normalizeWhitespace(match[1]);
  }

  return "";
}

function mergeFields(existing, addition) {
  return {
    kategorie: addition.kategorie || existing.kategorie || CATEGORY_NEWS,
    datum: addition.datum || existing.datum || "",
    uhrzeit: addition.uhrzeit || existing.uhrzeit || "",
    ort: addition.ort || existing.ort || "",
    beschreibung: addition.beschreibung || existing.beschreibung || ""
  };
}

function normalizeCategory(value) {
  const normalized = normalizeForAnalysis(value);
  if (normalized.includes("eins")) return CATEGORY_EINSAETZE;
  if (normalized.includes("ausbildung") || normalized.includes("ubung") || normalized.includes("uebung")) return CATEGORY_AUSBILDUNG;
  if (normalized.includes("jugend")) return CATEGORY_JUGEND;
  return CATEGORY_NEWS;
}

function extractDateValue(text) {
  const match = /(\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b|\b\d{1,2}\.\s?(januar|februar|maerz|märz|marz|april|mai|juni|juli|august|september|oktober|november|dezember)\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|\bheute\b|\bgestern\b|\bmorgen\b)/i.exec(text);
  return match ? normalizeWhitespace(match[1]) : "";
}

function extractTimeValue(text) {
  const match = /(\b\d{1,2}:\d{2}\b|\b\d{1,2}\.\d{2}\s?uhr\b|\b\d{1,2}\s?uhr\b)/i.exec(text);
  return match ? normalizeWhitespace(match[1]) : "";
}

function buildAnalysisText(analysis) {
  const missing = analysis.missingInfo.length > 0
    ? analysis.missingInfo.map((item) => `- ${item}`).join("\n")
    : "- keine offensichtlichen Pflichtinfos fehlen";

  return `Website Bot Analyse\n\nKategorie: ${analysis.category}\n\nFehlende/unklare Infos:\n${missing}\n`;
}

function buildReplyText(analysis, imageCount, folderName, updated = false, detectedImageCount = imageCount) {
  const imageLine = detectedImageCount === imageCount
    ? `Bilder: ${imageCount}`
    : `Bilder: ${imageCount} gespeichert, ${detectedImageCount} erkannt`;
  const lines = [
    "*----- Website Bot :) -----*",
    updated ? "Update gespeichert" : "Material gespeichert",
    "",
    `Status: ${analysis.missingInfo.length > 0 ? "Rueckfrage offen" : "bereit fuer Bearbeitung"}`,
    `Kategorie: ${analysis.category}`,
    imageLine,
    `Ordner: ${folderName}`
  ];

  if (analysis.missingInfo.length > 0) {
    lines.push("");
    lines.push("Mir fehlt noch:");
    for (const item of analysis.missingInfo) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push("Bitte so antworten:");
    lines.push("Kategorie: FF-News");
    lines.push("Datum: 31.05.2026");
    lines.push("Ort: Rastenfeld");
    lines.push("Beschreibung: kurzer Inhalt fuer den Bericht");
  } else {
    lines.push("");
    lines.push("Danke, alle Basisinfos sind vorhanden.");
  }

  return lines.join("\n");
}

function isBotReply(text) {
  return text.startsWith("*----- Website Bot") || text.startsWith("Gespeichert fuer die Website-Bearbeitung.");
}

function normalizeForAnalysis(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectCategory(text) {
  const normalized = normalizeForAnalysis(text);

  if (/(einsatz|alarm|alarmierung|t\d|b\d|s\d|vu|verkehrsunfall|brand|bergung|menschenrettung|unwetter|technischer einsatz)/i.test(normalized)) {
    return CATEGORY_EINSAETZE;
  }

  if (/(ausbildung|ubung|uebung|schulung|atemschutz|funkubung|funkuebung|einsatzubung|einsatzuebung|mitgliederschulung)/i.test(normalized)) {
    return CATEGORY_AUSBILDUNG;
  }

  if (/(feuerwehrjugend|jugend|bewerb der jugend|wissenstest|fertigkeitsabzeichen|kinderfeuerwehr)/i.test(normalized)) {
    return CATEGORY_JUGEND;
  }

  return CATEGORY_NEWS;
}

function hasDate(text) {
  const normalized = normalizeForAnalysis(text);
  return /(\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b|\b\d{1,2}\.\s?(januar|februar|maerz|marz|april|mai|juni|juli|august|september|oktober|november|dezember)\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|\bheute\b|\bgestern\b|\bmorgen\b)/i.test(normalized);
}

function hasTime(text) {
  const normalized = normalizeForAnalysis(text);
  return /(\b\d{1,2}:\d{2}\b|\b\d{1,2}\.\d{2}\s?uhr\b|\b\d{1,2}\s?uhr\b)/i.test(normalized);
}

function hasPlace(text) {
  const original = normalizeWhitespace(text);
  const normalized = normalizeForAnalysis(text);

  return /(\b(in|bei|auf|am)\s+[A-Za-z][A-Za-z0-9-]+|\b(ort|einsatzort)\b)/.test(original)
    || /(rastenfeld|rastenberg|peygarten|ottenstein|niedernondorf|niedergrunbach|haderdorf|hadersdorf|b38|b 38|l8245|l 8245)/i.test(normalized);
}

function hasEventTopic(text) {
  const normalized = normalizeForAnalysis(text);
  if (normalized.length >= 35) return true;

  return /(bewerb|wettkampf|fest|messe|floriani|wandertag|maibaum|ausflug|begehung|anschaffung|ehrung|besuch|veranstaltung|ubung|uebung|ausbildung|jugend|feuerwehrjugend|einsatz)/i.test(normalized);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "ja"].includes(String(value).toLowerCase());
}

function loadDotEnv(filePath) {
  return fs.readFile(filePath, "utf8")
    .then((content) => {
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;

        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (key && process.env[key] === undefined) {
          process.env[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    })
    .catch(() => undefined);
}
