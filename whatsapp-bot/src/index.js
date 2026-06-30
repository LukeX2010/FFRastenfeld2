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
import { createPostDraft } from "./ai/postGenerator.js";
import { parseReviewCommands } from "./review/commands.js";
import { runWebResearch } from "./search/webSearch.js";
import { publishDraft } from "./website/publisher.js";
import { createCommit, getGitStatus, pushToOrigin } from "./git/gitActions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const botRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(botRoot, "..");
const pidFilePath = path.join(botRoot, "bot.pid");

await loadDotEnv(path.join(botRoot, ".env"));
await ensureSingleBotInstance();

const outputDir = path.resolve(botRoot, process.env.OUTPUT_DIR || "../wwwroot/img/Bearbeiten");
const allowedChatIds = (process.env.ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ignoreOwnMessages = parseBoolean(process.env.IGNORE_OWN_MESSAGES, false);
const saveAllGroups = parseBoolean(process.env.SAVE_ALL_GROUPS);
const printChatIds = parseBoolean(process.env.PRINT_CHAT_IDS, true);
const replyInWhatsApp = parseBoolean(process.env.REPLY_IN_WHATSAPP, true);
const startupOnlineMessage = parseBoolean(process.env.STARTUP_ONLINE_MESSAGE, true);
const whatsappWebVersion = parseVersion(process.env.WHATSAPP_WEB_VERSION || "2.3000.1035194821");
const batchWindowMs = Number(process.env.BATCH_WINDOW_MS || 15000);
const followupWindowMs = Number(process.env.FOLLOWUP_WINDOW_MS || 30 * 60 * 1000);
const requireStartCommand = parseBoolean(process.env.REQUIRE_START_COMMAND, true);
const aiEnabled = parseBoolean(process.env.AI_ENABLED, true);
const aiProvider = process.env.AI_PROVIDER || "gemini";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.1:8b";
const ollamaNumCtx = Number(process.env.OLLAMA_NUM_CTX || 4096);
const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS || 60000);
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiUseGoogleSearch = parseBoolean(process.env.GEMINI_USE_GOOGLE_SEARCH, true);
const geminiSendImages = parseBoolean(process.env.GEMINI_SEND_IMAGES, true);
const redactSensitiveData = parseBoolean(process.env.REDACT_SENSITIVE_DATA, true);
const webResearchEnabled = parseBoolean(process.env.WEB_RESEARCH_ENABLED, true);
const webResearchProvider = process.env.WEB_RESEARCH_PROVIDER || "none";
const webResearchApiKey = process.env.BRAVE_SEARCH_API_KEY || process.env.WEB_RESEARCH_API_KEY || "";
const webResearchTimeoutMs = Number(process.env.WEB_RESEARCH_TIMEOUT_MS || 8000);
const webResearchMaxResults = Number(process.env.WEB_RESEARCH_MAX_RESULTS || 5);
const webResearchFetchPages = parseBoolean(process.env.WEB_RESEARCH_FETCH_PAGES, true);
const autoPublish = parseBoolean(process.env.AUTO_PUBLISH, false);
const requireApproval = parseBoolean(process.env.REQUIRE_APPROVAL, true);
const postsJsonPath = path.resolve(botRoot, process.env.POSTS_JSON_PATH || "../wwwroot/data/posts.json");
const publicImageDir = path.resolve(botRoot, process.env.PUBLIC_IMAGE_DIR || "../wwwroot/img/posts");
const pendingBatches = new Map();
const openFollowups = new Map();
const openReviews = new Map();
const activeCaptures = new Map();
const lastStartHints = new Map();
const pendingPushes = new Map();
const startupMessagesSent = new Set();
const botStartedAtMs = Date.now();

const botConfig = {
  aiEnabled,
  aiProvider,
  ollamaBaseUrl,
  ollamaModel,
  ollamaNumCtx,
  aiTimeoutMs,
  geminiApiKey,
  geminiModel,
  geminiUseGoogleSearch,
  geminiSendImages,
  redactSensitiveData,
  webResearchEnabled,
  webResearchProvider,
  webResearchApiKey,
  webResearchTimeoutMs,
  webResearchMaxResults,
  webResearchFetchPages,
  autoPublish,
  requireApproval,
  postsJsonPath,
  publicImageDir
};

const CATEGORY_EINSAETZE = "Eins\u00e4tze";
const CATEGORY_AUSBILDUNG = "Ausbildung";
const CATEGORY_JUGEND = "Feuerwehrjugend";
const CATEGORY_NEWS = "FF-News";

await fs.mkdir(outputDir, { recursive: true });

console.log("WhatsApp Bot gestartet");
console.log(`Projektroot: ${projectRoot}`);
console.log(`Zielordner:  ${outputDir}`);
console.log(`Posts JSON:  ${postsJsonPath}`);
console.log(`KI:          ${aiEnabled ? `${aiProvider} (${aiProvider === "gemini" ? geminiModel : ollamaModel})` : "deaktiviert"}`);
console.log(
  allowedChatIds.length > 0
    ? `Aktive Gruppen: ${allowedChatIds.join(", ")}`
    : "Noch keine Gruppe konfiguriert. Gruppen-IDs werden nur angezeigt."
);

startBot();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(botRoot, "auth_info_baileys"));
  const latest = await fetchLatestBaileysVersion();
  const version = latest.isLatest ? latest.version : whatsappWebVersion;
  const isLatest = latest.isLatest;

  console.log(`WhatsApp-Web-Version: ${version.join(".")} (${isLatest ? "aktuell" : "Fallback"})`);

  const sock = makeWASocket({
    auth: state,
    version,
    browser: ["FF Rastenfeld Bot", "Chrome", "1.0.0"],
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("QR-Code mit WhatsApp unter 'Verknuepfte Geraete' scannen:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("WhatsApp verbunden.");
      sendStartupOnlineMessage(sock).catch((error) => {
        console.error("Online-Meldung konnte nicht gesendet werden:", error?.message || error);
      });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const connectionReplaced = statusCode === DisconnectReason.connectionReplaced;
      console.log(`Verbindung geschlossen. Status: ${statusCode ?? "unbekannt"}`);

      if (connectionReplaced) {
        console.log("Verbindung wurde von einer anderen WhatsApp-Web/Bot-Sitzung ersetzt.");
        console.log("Kein automatischer Reconnect, damit keine Endlosschleife entsteht. Bitte doppelte Bot-Prozesse beenden.");
      } else if (!loggedOut) {
        console.log("Verbinde erneut...");
        setTimeout(() => startBot(), 5000);
      } else {
        console.log("Ausgeloggt. Ordner whatsapp-bot/auth_info_baileys loeschen und neu scannen.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`Nachrichten empfangen: type=${type}, anzahl=${messages.length}`);

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
  if (!chatId.endsWith("@g.us")) {
    console.log(`Ignoriert, keine Gruppe: ${chatId}`);
    return;
  }

  const messageDate = getMessageDate(message);
  if (messageDate.getTime() < botStartedAtMs - 10 * 60 * 1000) {
    console.log(`Ignoriert, alte Sync-Nachricht: ${messageDate.toISOString()}`);
    return;
  }

  const text = extractText(message.message);
  const mediaParts = extractMediaParts(message.message);
  if (isBotReply(text)) return;

  if (printChatIds) {
    console.log(`Gruppe erkannt: ${chatId}${text ? ` | ${text.slice(0, 80)}` : ""}`);
  }

  const maySave = saveAllGroups || allowedChatIds.includes(chatId);
  if (!maySave) {
    console.log(`Ignoriert, Gruppe nicht freigegeben: ${chatId}`);
    return;
  }

  const reviewCommands = parseReviewCommands(text);
  if (reviewCommands.length > 0) {
    for (const reviewCommand of reviewCommands) {
      await handleReviewCommand(sock, chatId, message, reviewCommand);
    }
    return;
  }

  if (!text && mediaParts.length === 0) {
    console.log("Ignoriert, keine Text- oder Bildnachricht.");
    return;
  }

  if (requireStartCommand && !activeCaptures.has(chatId)) {
    await sendStartHintIfNeeded(sock, chatId, message);
    console.log("Ignoriert, keine aktive START-Sitzung.");
    return;
  }

  if (requireStartCommand && activeCaptures.has(chatId)) {
    const capture = activeCaptures.get(chatId);
    const currentReview = capture?.folderPath
      ? { folderName: capture.folderName, folderPath: capture.folderPath, status: "review_pending", updatedAt: Date.now() }
      : null;

    if (currentReview) {
      const supplement = parseSupplementText(text);
      if (supplement || (mediaParts.length > 0 && text && isSupplementPrefix(text))) {
        const supplementText = supplement || "";
        const followupMessage = {
          ...message,
          message: rewriteMessageText(message.message, supplementText)
        };

        const followupMediaParts = mediaParts.map((part) => ({
          ...part,
          caption: supplementText || part.caption || ""
        }));

        const followup = {
          folderName: currentReview.folderName,
          folderPath: currentReview.folderPath,
          category: "",
          missingInfo: [],
          expiresAt: Date.now() + followupWindowMs
        };
        openFollowups.set(chatId, followup);
        await addToFollowupBatch(sock, chatId, followupMessage, supplementText, followupMediaParts, followup);
        return;
      }

      if (mediaParts.length > 0) {
        await sock.sendMessage(chatId, {
          text: buildBotNotice("Bild(er) nach dem Entwurf werden nicht automatisch angehängt. Schreib `Z: <Text>` als Caption/Nachricht, wenn sie bewusst als Zusatzinfo zum aktuellen Entwurf gehören.")
        }, { quoted: message });
        return;
      }

      if (text) {
        await handleReviewCommand(sock, chatId, message, {
          type: "change",
          instruction: text,
          label: "AENDERN"
        });
        return;
      }
    } else {
      await addToBatch(sock, chatId, message, text, mediaParts);
      return;
    }
  }

  const openFollowup = openFollowups.get(chatId);
  if (!requireStartCommand && openFollowup && Date.now() <= openFollowup.expiresAt) {
    const supplement = parseSupplementText(text);
    if (!supplement && text) {
      await sock.sendMessage(chatId, {
        text: buildBotNotice("Ich hänge normale Nachrichten nicht mehr automatisch als Zusatzinfo an. Für echte Zusatzinfo bitte `Z: ...` oder `Zusatzinfo: ...` schreiben.")
      }, { quoted: message });
      return;
    }

    if (supplement || mediaParts.length > 0) {
      const followupMessage = supplement ? { ...message, message: rewriteMessageText(message.message, supplement) } : message;
      await addToFollowupBatch(sock, chatId, followupMessage, supplement || text, mediaParts, openFollowup);
      return;
    }
  }

  const staleFollowup = openFollowups.get(chatId);
  if (staleFollowup) {
    openFollowups.delete(chatId);
  }

  if (requireStartCommand) return;

  const diskFollowup = await findOpenFollowupForChat(chatId);
  if (diskFollowup) {
    openFollowups.set(chatId, diskFollowup);
    await addToFollowupBatch(sock, chatId, message, text, mediaParts, diskFollowup);
    return;
  }

  await addToBatch(sock, chatId, message, text, mediaParts);
}

async function addToBatch(sock, chatId, message, text, mediaParts) {
  const existing = pendingBatches.get(chatId);
  if (existing?.timer) clearTimeout(existing.timer);
  const isNewBatch = !existing;

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
  if (text && shouldAddBatchText(text, mediaParts)) batch.texts.push(text);
  if (mediaParts.length > 0) {
    batch.mediaMessages.push({ message, parts: mediaParts });
  }

  batch.timer = setTimeout(() => {
    pendingBatches.delete(chatId);
    saveBatch(batch).catch((error) => console.error("Paket konnte nicht gespeichert werden:", error));
  }, batchWindowMs);

  pendingBatches.set(chatId, batch);
  console.log(`Nachricht vorgemerkt. Speichern in ${Math.round(batchWindowMs / 1000)} Sekunden...`);

  if (replyInWhatsApp && isNewBatch) {
    await sock.sendMessage(
      chatId,
      { text: buildBotNotice(`Material empfangen. Ich sammle jetzt ${Math.round(batchWindowMs / 1000)} Sekunden und speichere dann alles in einen Ordner.`) },
      { quoted: message }
    );
  }
}

async function addToFollowupBatch(sock, chatId, message, text, mediaParts, openFollowup) {
  const batchKey = `${chatId}:followup`;
  const existing = pendingBatches.get(batchKey);
  if (existing?.timer) clearTimeout(existing.timer);
  const isNewBatch = !existing;

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
  if (text && shouldAddBatchText(text, mediaParts)) batch.texts.push(text);
  if (mediaParts.length > 0) {
    batch.mediaMessages.push({ message, parts: mediaParts });
  }

  batch.timer = setTimeout(() => {
    pendingBatches.delete(batchKey);
    appendFollowup(batch).catch((error) => console.error("Zusatzinfo konnte nicht gespeichert werden:", error));
  }, batchWindowMs);

  pendingBatches.set(batchKey, batch);
  console.log(`Zusatzinfo vorgemerkt. Aktualisieren in ${Math.round(batchWindowMs / 1000)} Sekunden...`);

  if (replyInWhatsApp && isNewBatch) {
    await sock.sendMessage(
      chatId,
      { text: buildBotNotice(`Zusatzinfo empfangen. Ich ergänze gleich den bestehenden Ordner: ${openFollowup.folderName}`) },
      { quoted: message }
    );
  }
}

async function saveBatch(batch) {
  const text = batch.texts.join("\n\n");
  const timestamp = getMessageDate(batch.firstMessage);
  const fields = extractFields(text);
  const analysis = analyzeMessage(text, countDetectedImages(batch.mediaMessages), fields);
  const folderName = await createUniqueFolderName(timestamp, text || analysis.category);
  const folderPath = path.join(outputDir, folderName);
  await fs.mkdir(folderPath, { recursive: true });

  const { savedImages, imageErrors } = await saveImages(folderPath, batch.mediaMessages, 0);
  const data = buildDataJson(fields, analysis, savedImages);

  await fs.writeFile(path.join(folderPath, "nachricht.txt"), text || "", "utf8");
  await fs.writeFile(path.join(folderPath, "daten.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(folderPath, "kategorie.txt"), `${analysis.category}\n`, "utf8");
  await fs.writeFile(path.join(folderPath, "analyse.txt"), buildAnalysisText(analysis), "utf8");
  await fs.writeFile(path.join(folderPath, "codex-prompt.txt"), buildCodexPrompt(data, text), "utf8");

  const meta = {
    folderName,
    chatId: batch.chatId,
    messageIds: batch.messages.map((item) => item.key.id).filter(Boolean),
    sender: batch.firstMessage.key.participant || null,
    receivedAt: new Date().toISOString(),
    messageDate: timestamp.toISOString(),
    category: analysis.category,
    fields: data,
    missingInfo: analysis.missingInfo,
    text,
    imageCount: savedImages.length,
    detectedImageCount: countDetectedImages(batch.mediaMessages),
    images: savedImages,
    imageErrors
  };

  await fs.writeFile(path.join(folderPath, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`Gespeichert: ${folderPath}`);

  if (activeCaptures.has(batch.chatId)) {
    activeCaptures.set(batch.chatId, {
      ...activeCaptures.get(batch.chatId),
      folderName,
      folderPath
    });
  }

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

  const replyText = await buildEditorialReply({
    folderPath,
    folderName,
    text,
    data,
    meta,
    chatId: batch.chatId,
    updated: false
  });

  if (replyInWhatsApp) {
    await batch.sock.sendMessage(
      batch.chatId,
      { text: replyText || buildReplyText(analysis, savedImages.length, folderName, false, countDetectedImages(batch.mediaMessages)) },
      { quoted: batch.firstMessage }
    );
  }

  return { folderName, folderPath, data, meta };
}

async function appendFollowup(batch) {
  const followup = batch.followup;
  const existingText = await readTextFile(path.join(followup.folderPath, "nachricht.txt"));
  const additionText = batch.texts.join("\n\n");
  const combinedText = [existingText, additionText].filter(Boolean).join("\n\n--- Zusatzinfo ---\n\n");
  const existingMeta = await readJsonFile(path.join(followup.folderPath, "meta.json"));
  const existingData = await readJsonFile(path.join(followup.folderPath, "daten.json"));
  const existingFields = existingData.fields || existingData;
  const additionFields = extractFields(additionText, followup.missingInfo);
  const combinedFields = mergeFields(existingFields, additionFields);
  const existingImageCount = Number(existingMeta.images?.length || existingMeta.imageCount || 0);
  const { savedImages, imageErrors } = await saveImages(followup.folderPath, batch.mediaMessages, existingImageCount);
  const allImages = [...(existingMeta.images || []), ...savedImages];
  const allErrors = [...(existingMeta.imageErrors || []), ...imageErrors];
  const analysis = analyzeMessage(combinedText, allImages.length, combinedFields);
  const data = buildDataJson(combinedFields, analysis, allImages);

  await fs.writeFile(path.join(followup.folderPath, "nachricht.txt"), combinedText, "utf8");
  await fs.writeFile(path.join(followup.folderPath, "daten.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(followup.folderPath, "kategorie.txt"), `${analysis.category}\n`, "utf8");
  await fs.writeFile(path.join(followup.folderPath, "analyse.txt"), buildAnalysisText(analysis), "utf8");
  await fs.writeFile(path.join(followup.folderPath, "codex-prompt.txt"), buildCodexPrompt(data, combinedText), "utf8");

  const meta = {
    ...existingMeta,
    folderName: followup.folderName,
    category: analysis.category,
    fields: data,
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

  const replyText = await buildEditorialReply({
    folderPath: followup.folderPath,
    folderName: followup.folderName,
    text: combinedText,
    data,
    meta,
    chatId: batch.chatId,
    updated: true
  });

  if (replyInWhatsApp) {
    await batch.sock.sendMessage(
      batch.chatId,
      { text: replyText || buildReplyText(analysis, allImages.length, followup.folderName, true, Number(meta.detectedImageCount || allImages.length)) },
      { quoted: batch.firstMessage }
    );
  }
}

async function buildEditorialReply({ folderPath, folderName, text, data, meta, chatId, updated }) {
  try {
    const research = await runWebResearch({
      folderPath,
      originalText: text,
      data,
      config: botConfig
    });

    const effectiveConfig = {
      ...botConfig,
      aiEnabled: botConfig.aiEnabled && ["gemini", "ollama"].includes(String(botConfig.aiProvider).toLowerCase())
    };

    const draftResult = await createPostDraft({
      folderPath,
      originalText: text,
      data,
      meta,
      research,
      config: effectiveConfig
    });

    const draft = draftResult.draft;
    await fs.writeFile(path.join(folderPath, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(folderPath, "entwurf.txt"), buildDraftText(draft), "utf8");
    await fs.writeFile(path.join(folderPath, "redaction-report.json"), `${JSON.stringify(draftResult.redactionReport || { enabled: false, replacements: [] }, null, 2)}\n`, "utf8");
    await writeRedactionReport(folderPath, draftResult, research);
    if (draftResult.rawText) {
      await fs.writeFile(path.join(folderPath, "ki-response.txt"), draftResult.rawText, "utf8");
    }

    const state = {
      chatId,
      folderName,
      folderPath,
      status: "review_pending",
      draftStatus: draft.status,
      aiAvailable: draftResult.aiAvailable,
      aiError: draftResult.error || null,
      updatedAt: new Date().toISOString(),
      commands: ["OK", "ÄNDERN: <Text>", "STATUS", "ONLINE", "ONLINE TROTZDEM", "ABBRUCH"]
    };

    await fs.writeFile(path.join(folderPath, "review-state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
    openReviews.set(chatId, { folderName, folderPath, status: state.status, updatedAt: Date.now() });

    if (!draftResult.aiAvailable) {
      return [
        "*----- Website Bot :) -----*",
        updated ? "Zusatzinfos gespeichert." : "Gespeichert.",
        "KI ist momentan nicht verfügbar, daher wurde nur lokal abgelegt.",
        `Ordner: ${folderName}`,
        draftResult.error ? `Grund: ${draftResult.error}` : ""
      ].filter(Boolean).join("\n");
    }

    return buildDraftDashboard(draft, data, folderName, research, updated);
  } catch (error) {
    console.error("KI-/Redaktionsschritt fehlgeschlagen:", error);
    return [
      "*----- Website Bot :) -----*",
      updated ? "Zusatzinfos gespeichert." : "Gespeichert.",
      "Der Redaktionsschritt ist fehlgeschlagen, die Rohdaten liegen aber lokal im Ordner.",
      `Ordner: ${folderName}`,
      `Fehler: ${error?.message || error}`
    ].join("\n");
  }
}

function buildDraftSummaryLegacy(draft, data, folderName, updated = false) {
  const publishableImages = (data.images || []).filter((image) => image.publishAllowed !== false).length;
  const contextOnlyImages = (data.images || []).filter((image) => image.publishAllowed === false).length;
  const missing = draft.missingInfo?.length ? draft.missingInfo.join(", ") : "keine offensichtlichen";
  const warnings = draft.safetyWarnings?.length ? draft.safetyWarnings.join(", ") : "keine";
  const dateLine = [draft.date, draft.time].filter(Boolean).join(" ");

  return [
    "*----- Website Bot :) -----*",
    updated ? "Entwurf mit Zusatzinfos aktualisiert." : "Entwurf erstellt und lokal gespeichert.",
    "",
    `Titel: ${draft.title}`,
    `Kategorie: ${draft.category}`,
    dateLine ? `Datum/Zeit: ${dateLine}` : "Datum/Zeit: nicht sicher erkannt",
    draft.location ? `Ort: ${draft.location}` : "Ort: nicht sicher erkannt",
    `Kurztext: ${draft.shortText}`,
    `Bilder: ${publishableImages} Website, ${contextOnlyImages} nur Kontext`,
    `Fehlende Infos: ${missing}`,
    `Hinweise: ${warnings}`,
    `Ordner: ${folderName}`,
    "",
    "Befehle:",
    "OK = Entwurf als geprüft markieren",
    "ÄNDERN: <Text> = Entwurf überarbeiten",
    "STATUS = aktuellen Entwurf anzeigen",
    "ONLINE = in posts.json übernehmen",
    "ONLINE TROTZDEM = bewusst trotz fehlender Infos übernehmen",
    "ABBRUCH = Entwurf ablehnen"
  ].join("\n");
}

function buildDraftSummary(draft, data, folderName, updated = false) {
  const publishableImages = (data.images || []).filter((image) => image.publishAllowed !== false).length;
  const contextOnlyImages = (data.images || []).filter((image) => image.publishAllowed === false).length;
  const missing = draft.missingInfo?.length ? draft.missingInfo.map((item) => `- ${item}`).join("\n") : "- keine offensichtlichen";
  const warnings = draft.safetyWarnings?.length ? draft.safetyWarnings.map((item) => `- ${item}`).join("\n") : "- keine";
  const dateLine = [draft.date, draft.time].filter(Boolean).join(" ");
  const status = draft.status === "ready" ? "bereit" : "needs_review";

  return [
    `*Website-Bot - ${updated ? "Entwurf aktualisiert" : "Entwurf erstellt"}*`,
    "",
    `*Titel:* ${draft.title}`,
    `*Kategorie:* ${draft.category}`,
    `*Status:* ${status}`,
    dateLine ? `*Datum/Zeit:* ${dateLine}` : "*Datum/Zeit:* nicht sicher erkannt",
    draft.location ? `*Ort:* ${draft.location}` : "*Ort:* nicht sicher erkannt",
    `*Bilder:* ${publishableImages} fuer Website, ${contextOnlyImages} nur Kontext`,
    "",
    "*Kurztext:*",
    draft.shortText,
    "",
    "*Fehlt noch:*",
    missing,
    "",
    "*Hinweise:*",
    warnings,
    "",
    `*Ordner:* ${folderName}`,
    "",
    "*Antworten:*",
    "`OK` - Entwurf bestaetigen",
    "`AENDERN: ...` - Entwurf verbessern",
    "`ONLINE` - Beitrag uebernehmen",
    "`ONLINE TROTZDEM` - bewusst trotz kleiner Luecken uebernehmen",
    "`STATUS` - Entwurf anzeigen",
    "`ABBRUCH` - verwerfen"
  ].join("\n");
}

function buildDraftDashboard(draft, data, folderName, research = {}, updated = false) {
  const counts = imageCounts(data);
  const missing = draft.missingInfo?.length ? draft.missingInfo.map((item) => `* ${item}`).join("\n") : "* keine offensichtlichen Pflichtinfos fehlen";
  const researchLine = researchStatusLine(draft, research);

  return [
    `🚒 *Website-Bot - ${updated ? "Entwurf aktualisiert" : "Entwurf bereit"}*`,
    "",
    "📝 *Titel*",
    draft.title || "Noch kein Titel",
    "",
    "🏷️ *Kategorie*",
    draft.category || "nicht sicher erkannt",
    "",
    "📅 *Datum / Uhrzeit*",
    formatDateTimeLine(draft),
    "",
    "📍 *Ort*",
    draft.location || "nicht sicher erkannt",
    "",
    "🖼️ *Bilder*",
    `${counts.total} erkannt · ${counts.publishable} Website · ${counts.contextOnly} nur Kontext`,
    "",
    "🔎 *Recherche*",
    researchLine,
    "",
    "⚠️ *Fehlende Infos*",
    missing,
    "",
    "📌 *Status*",
    statusLabel(draft),
    "",
    "*Befehle*",
    "`VORSCHAU` · `BILDER` · `QUELLEN` · `ÄNDERN: ...`",
    "`OK` · `ONLINE` · `ABBRUCH` · `FERTIG`",
    "`MENÜ` für alle Optionen",
    "",
    `KI: ${aiProviderLabel()}`
  ].join("\n");
}

function buildMenuText(review, bundle) {
  const counts = imageCounts(bundle.data);
  const research = bundle.research || {};

  return [
    "🚒 *Website-Bot Menü*",
    "",
    "Aktiver Entwurf:",
    `„${bundle.draft.title || review.folderName}”`,
    "",
    `Status: ${statusLabel(bundle.draft)}`,
    `Kategorie: ${bundle.draft.category || bundle.data.category || "nicht sicher"}`,
    `Bilder: ${counts.total} erkannt, ${counts.publishable} freigegeben`,
    `Recherche: ${research.performed || research.geminiGoogleSearch?.sources?.length ? "aktiv" : "aus"}`,
    "",
    "*Ansichten*",
    "1️⃣ `VORSCHAU` – kompletter Beitrag",
    "2️⃣ `DETAILS` – Daten, Status, fehlende Infos",
    "3️⃣ `BILDER` – Bilder verwalten",
    "4️⃣ `QUELLEN` – Recherchequellen anzeigen",
    "5️⃣ `RECHERCHE` – passende Online-Recherche starten",
    "",
    "*Bearbeiten*",
    "6️⃣ `ÄNDERN: ...` – Text nach Wunsch ändern",
    "7️⃣ `STIL: offizieller` – Stil ändern",
    "8️⃣ `KATEGORIE: ...` – Kategorie setzen",
    "9️⃣ `DATUM: ...` / `UHRZEIT: ...` / `ORT: ...`",
    "",
    "*Freigabe*",
    "✅ `OK` – Entwurf bestätigen",
    "✅ `FERTIG` – Entwurf abschließen und neuen Beitrag erlauben",
    "🌐 `ONLINE` – veröffentlichen",
    "🗑️ `ABBRUCH` – verwerfen",
    "",
    "*Gezielte Suche*",
    "`SUCHE: Ottensteiner Seelauf 2026`",
    "",
    `KI: ${aiProviderLabel()}`
  ].join("\n");
}

function buildStatusText(review, bundle) {
  const missing = bundle.draft.missingInfo?.length ? bundle.draft.missingInfo.join(", ") : "keine offensichtlichen";
  return [
    "📌 *Status Entwurf*",
    "",
    `*Titel:* ${bundle.draft.title || review.folderName}`,
    `*Status:* ${statusLabel(bundle.draft)}`,
    `*Fehlt:* ${missing}`,
    `*Ordner:* ${review.folderName}`,
    "",
    "Nächste Befehle: `VORSCHAU`, `BILDER`, `OK`, `ONLINE`, `MENÜ`",
    `KI: ${aiProviderLabel()}`
  ].join("\n");
}

function buildPreviewText(bundle) {
  const sources = sourceLines(bundle.research);
  const images = imageLines(bundle.data);
  const missing = bundle.draft.missingInfo?.length ? bundle.draft.missingInfo.map((item) => `* ${item}`).join("\n") : "* keine";

  return [
    "📝 *Vorschau Website-Beitrag*",
    "",
    "*Titel*",
    bundle.draft.title || "",
    "",
    "*Kategorie*",
    bundle.draft.category || "",
    "",
    "*Datum / Uhrzeit*",
    formatDateTimeLine(bundle.draft),
    "",
    "*Ort*",
    bundle.draft.location || "",
    "",
    "*Kurztext*",
    bundle.draft.shortText || "",
    "",
    "*Volltext*",
    bundle.draft.fullText || "",
    "",
    "*Bilder*",
    images.length ? images.join("\n") : "* keine Bilder",
    "",
    "*Fehlende Infos*",
    missing,
    "",
    "*Quellen*",
    sources.length ? sources.slice(0, 6).join("\n") : "* keine Online-Quellen verwendet",
    "",
    "*Befehle*",
    "`ÄNDERN: ...` · `BILDER` · `OK` · `ONLINE` · `MENÜ`",
    "",
    `KI: ${aiProviderLabel()}`
  ].join("\n");
}

function buildImagesText(bundle) {
  const images = bundle.data.images || [];
  return [
    "🖼️ *Bilder verwalten*",
    "",
    images.length
      ? images.map((image, index) => [
        `${index + 1}️⃣ ${image.fileName} ${image.publishAllowed === false ? "❌ Nur Kontext" : "✅ Website"}`,
        `Beschreibung: ${image.description || "-"}`,
        image.caption && image.caption !== image.description ? `Caption: ${image.caption}` : "",
        image.role ? `Rolle: ${image.role}` : ""
      ].filter(Boolean).join("\n")).join("\n\n")
      : "Keine Bilder in diesem Entwurf.",
    "",
    "*Befehle*",
    "`BILD 1 JA`",
    "`BILD 2 NEIN`",
    "`BILD 1 TITEL`",
    "`VORSCHAU`",
    "`MENÜ`"
  ].join("\n");
}

function buildSourcesText(research) {
  const sources = sourceObjects(research);
  if (sources.length === 0) {
    return "🔎 *Recherchequellen*\n\nFür diesen Entwurf wurden keine Online-Quellen verwendet.";
  }

  return [
    "🔎 *Recherchequellen*",
    "",
    sources.slice(0, 10).map((source, index) => [
      `${index + 1}. ${source.title || source.host || "Quelle"}`,
      source.url || source.host || "",
      source.note ? `Kurznotiz: ${source.note}` : ""
    ].filter(Boolean).join("\n")).join("\n\n")
  ].join("\n");
}

function buildDetailsText(review, bundle) {
  const counts = imageCounts(bundle.data);
  const sources = sourceObjects(bundle.research);
  return [
    "🧾 *Details Entwurf*",
    "",
    `Ordner: ${review.folderName}`,
    `Status: ${bundle.state.status || bundle.draft.status || "review_pending"}`,
    `Kategorie: ${bundle.draft.category || bundle.data.category || ""}`,
    `Datum: ${bundle.draft.date || ""}`,
    `Uhrzeit: ${bundle.draft.time || ""}`,
    `Ort: ${bundle.draft.location || ""}`,
    "",
    "*MissingInfo*",
    bundle.draft.missingInfo?.length ? bundle.draft.missingInfo.map((item) => `- ${item}`).join("\n") : "- keine",
    "",
    "*SafetyWarnings*",
    bundle.draft.safetyWarnings?.length ? bundle.draft.safetyWarnings.map((item) => `- ${item}`).join("\n") : "- keine",
    "",
    `Quellenanzahl: ${sources.length}`,
    `Bildanzahl: ${counts.total}`,
    `Publishable images: ${counts.publishable}`,
    `Context-only images: ${counts.contextOnly}`,
    "",
    `KI: ${aiProviderLabel()}`
  ].join("\n");
}

function buildHelpText() {
  return [
    "🚒 *Website-Bot Hilfe*",
    "",
    "`MENÜ` oder `M` – alle Optionen",
    "`STATUS` oder `S` – kurzer Status",
    "`VORSCHAU` oder `V` – kompletter Beitrag",
    "`DETAILS` oder `D` – technische Infos",
    "`QUELLEN` oder `Q` – Quellen anzeigen",
    "`RECHERCHE` oder `R` – Recherche starten",
    "`SUCHE: ...` – gezielt suchen",
    "`BILDER` oder `B` – Bilder verwalten",
    "`BILD 1 JA/NEIN/TITEL` – Bildfreigabe ändern",
    "`ÄNDERN: ...` – Entwurf mit KI überarbeiten",
    "`STIL: kurz/offizieller/ausführlich/...` – Stil ändern",
    "`OK`, `ONLINE`, `ONLINE TROTZDEM`, `FERTIG`, `ABBRUCH`"
  ].join("\n");
}

function imageCounts(data) {
  const images = Array.isArray(data?.images) ? data.images : [];
  return {
    total: images.length,
    publishable: images.filter((image) => image.publishAllowed !== false).length,
    contextOnly: images.filter((image) => image.publishAllowed === false).length
  };
}

function imageLines(data) {
  const images = Array.isArray(data?.images) ? data.images : [];
  return images.map((image, index) => {
    const icon = image.publishAllowed === false ? "❌ nur Kontext" : "✅ Website";
    const role = image.role ? ` · ${image.role}` : "";
    return `${index + 1}. ${image.fileName} ${icon}${role}`;
  });
}

function sourceObjects(research = {}) {
  const local = Array.isArray(research.results) ? research.results.map((item) => ({
    title: item.title,
    url: item.url,
    host: item.host,
    note: item.snippet || item.trustHint || ""
  })) : [];

  const gemini = Array.isArray(research.geminiGoogleSearch?.sources)
    ? research.geminiGoogleSearch.sources.map((item) => ({
      title: item.title,
      url: item.url,
      host: hostFromUrl(item.url),
      note: "Gemini Google Search Grounding"
    }))
    : [];

  const seen = new Set();
  return [...local, ...gemini].filter((source) => {
    const key = source.url || `${source.title}:${source.host}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceLines(research = {}) {
  return sourceObjects(research).map((source, index) => `* ${index + 1}. ${source.title || source.host || "Quelle"}${source.url ? `\n  ${source.url}` : ""}`);
}

function researchStatusLine(draft, research = {}) {
  if (isEinsatzDraft(draft)) return "Nicht verwendet, weil Einsatzmodus aktiv.";
  const count = sourceObjects(research).length;
  if (research.performed || count > 0) return `${count} Quelle(n) gefunden.`;
  return research.reason || "Nicht verwendet.";
}

function formatDateTimeLine(draft) {
  const date = draft.date || "nicht sicher erkannt";
  const time = draft.time ? `${draft.time} Uhr` : "";
  return time ? `${date} · ${time}` : date;
}

function statusLabel(draft) {
  if (draft.status === "ready") return "Bereit zur Prüfung";
  return "Prüfung nötig";
}

function aiProviderLabel() {
  return aiProvider === "gemini" ? `${geminiModel} (Gemini)` : `${ollamaModel} (Ollama)`;
}

function isEinsatzDraft(draftOrData) {
  const category = String(draftOrData?.category || draftOrData?.Kategorie || "").toLowerCase();
  return category.includes("eins");
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function sendPreview(sock, chatId, message, review, bundle) {
  await sock.sendMessage(chatId, { text: buildPreviewText(bundle) }, { quoted: message });

  const images = Array.isArray(bundle.data.images) ? bundle.data.images : [];
  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    const filePath = path.join(review.folderPath, image.fileName);
    const caption = image.publishAllowed === false
      ? `Bild ${index + 1}/${images.length} · Nur Kontext - nicht veröffentlichen`
      : `Bild ${index + 1}/${images.length} · Website freigegeben`;

    try {
      await sock.sendMessage(chatId, { image: { url: filePath }, caption }, { quoted: message });
    } catch (error) {
      console.error(`Vorschaubild konnte nicht gesendet werden (${image.fileName}):`, error?.message || error);
    }
  }
}

async function saveDraftBundle(folderPath, draft, data) {
  await fs.writeFile(path.join(folderPath, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(folderPath, "daten.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(folderPath, "entwurf.txt"), buildDraftText(draft), "utf8");
}

async function saveDraftHistory(folderPath, draft, reason) {
  const historyPath = path.join(folderPath, "draft-history.json");
  const history = await readJsonFile(historyPath);
  const entries = Array.isArray(history) ? history : [];
  entries.push({
    savedAt: new Date().toISOString(),
    reason,
    draft
  });
  await fs.writeFile(historyPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function updateImageSetting(review, bundle, command) {
  const index = command.index - 1;
  const images = Array.isArray(bundle.data.images) ? bundle.data.images : [];
  if (index < 0 || index >= images.length) {
    return `Bild ${command.index} wurde nicht gefunden. Mit BILDER siehst du alle Bilder.`;
  }

  await saveDraftHistory(review.folderPath, bundle.draft, command.label);

  if (command.type === "imageTitle") {
    images.forEach((image, imageIndex) => {
      image.role = imageIndex === index ? "Titelbild" : undefined;
    });
  } else {
    images[index].publishAllowed = command.publishAllowed;
    images[index].usage = command.publishAllowed ? "website" : "context_only";
    images[index].publishUsage = command.publishAllowed ? "website" : "context_only";
  }

  const captions = Array.isArray(bundle.draft.imageCaptions) ? bundle.draft.imageCaptions : [];
  const caption = captions.find((item) => item.fileName === images[index].fileName);
  if (caption && command.type === "imageSet") caption.publishAllowed = command.publishAllowed;

  const publishable = images.filter((image) => image.publishAllowed !== false);
  const contextOnly = images.filter((image) => image.publishAllowed === false);
  bundle.data.imagePolicy = {
    ...(bundle.data.imagePolicy || {}),
    total: images.length,
    publishable: publishable.length,
    contextOnly: contextOnly.length
  };

  await saveDraftBundle(review.folderPath, bundle.draft, bundle.data);
  return command.type === "imageTitle"
    ? `Bild ${command.index} ist jetzt als Titelbild markiert.`
    : `Bild ${command.index} ist jetzt ${command.publishAllowed ? "für die Website freigegeben" : "nur Kontext"}.`;
}

async function updateDraftField(review, bundle, command) {
  await saveDraftHistory(review.folderPath, bundle.draft, command.label);
  const value = command.value;
  const fields = bundle.data.fields || {};

  if (command.field === "category") {
    bundle.draft.category = normalizeCategoryForReview(value);
    bundle.data.category = bundle.draft.category;
    fields.kategorie = bundle.draft.category;
  }
  if (command.field === "date") {
    bundle.draft.date = value;
    fields.datum = value;
  }
  if (command.field === "time") {
    bundle.draft.time = value;
    fields.uhrzeit = value;
  }
  if (command.field === "location") {
    bundle.draft.location = value;
    fields.ort = value;
  }

  bundle.data.fields = fields;
  await saveDraftBundle(review.folderPath, bundle.draft, bundle.data);
  return `${command.label}: ${value} gespeichert.`;
}

async function regenerateDraft(review, bundle, instruction, reason, extraConfig = {}) {
  await saveDraftHistory(review.folderPath, bundle.draft, reason);
  const effectiveConfig = {
    ...botConfig,
    ...extraConfig,
    aiEnabled: botConfig.aiEnabled && ["gemini", "ollama"].includes(String(botConfig.aiProvider).toLowerCase())
  };

  const draftResult = await createPostDraft({
    folderPath: review.folderPath,
    originalText: bundle.text,
    data: bundle.data,
    meta: bundle.meta,
    research: bundle.research,
    config: effectiveConfig,
    revisionInstruction: [
      instruction,
      "",
      "Bestehenden Entwurf als Grundlage verwenden und Fakten nicht verändern:",
      JSON.stringify(bundle.draft, null, 2)
    ].join("\n")
  });

  await fs.writeFile(path.join(review.folderPath, "draft.json"), `${JSON.stringify(draftResult.draft, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(review.folderPath, "entwurf.txt"), buildDraftText(draftResult.draft), "utf8");
  await writeRedactionReport(review.folderPath, draftResult, bundle.research);
  if (draftResult.rawText) {
    await fs.writeFile(path.join(review.folderPath, "ki-response.txt"), draftResult.rawText, "utf8");
  }

  return draftResult;
}

async function runResearchAndUpdateDraft(review, bundle, command) {
  if (!command.query && isEinsatzDraft(bundle.draft)) {
    return {
      blocked: true,
      text: [
        "🔎 *Recherche*",
        "",
        "Einsatzmodus aktiv. Online-Recherche ist aus Sicherheitsgründen deaktiviert.",
        "Mit `SUCHE: ...` kannst du bewusst eine harmlose Suche starten, z.B. nach Ort oder Veranstaltung."
      ].join("\n")
    };
  }

  const research = await runWebResearch({
    folderPath: review.folderPath,
    originalText: command.query || [bundle.draft.title, bundle.draft.category, bundle.draft.location, bundle.draft.date, bundle.text].filter(Boolean).join(" "),
    data: bundle.data,
    config: {
      ...botConfig,
      webResearchEnabled: true,
      webResearchProvider: botConfig.webResearchProvider || "bing",
      webResearchQuery: command.query || ""
    }
  });

  bundle.research = research;
  const sourceCount = sourceObjects(research).length;
  const draftResult = await regenerateDraft(
    review,
    bundle,
    command.query
      ? `Nutze die gezielte Suche "${command.query}" nur, wenn Quellen eindeutig passen.`
      : "Aktualisiere den Entwurf mit den sicheren Recherchequellen. Nichts erfinden.",
    command.query ? `SUCHE: ${command.query}` : "RECHERCHE",
    { geminiForceGoogleSearch: Boolean(command.query) }
  );

  return {
    blocked: false,
    draftResult,
    text: [
      "🔎 *Recherche abgeschlossen*",
      "",
      `${sourceCount} Quelle(n) gefunden.`,
      draftResult.aiAvailable ? "Entwurf wurde mit sicheren Quellen aktualisiert." : "Entwurf blieb im Fallback, weil KI nicht verfügbar ist.",
      "",
      buildDraftDashboard(draftResult.draft, bundle.data, review.folderName, research, true)
    ].join("\n")
  };
}

async function finishDraft(review, chatId) {
  const targetRoot = path.join(outputDir, "Entwurf");
  await fs.mkdir(targetRoot, { recursive: true });
  const target = await uniqueMoveTarget(targetRoot, review.folderName);
  await fs.rename(review.folderPath, target);

  openReviews.delete(chatId);
  openFollowups.delete(chatId);
  activeCaptures.delete(chatId);

  return {
    folderName: path.basename(target),
    folderPath: target
  };
}

async function uniqueMoveTarget(root, folderName) {
  for (let index = 0; index < 100; index++) {
    const candidate = path.join(root, index === 0 ? folderName : `${folderName}-${index + 1}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
  return path.join(root, `${folderName}-${Date.now()}`);
}

function normalizeCategoryForReview(value) {
  const normalized = normalizeForAnalysis(value);
  if (normalized.includes("eins")) return CATEGORY_EINSAETZE;
  if (normalized.includes("ausbildung") || normalized.includes("ubung") || normalized.includes("uebung")) return CATEGORY_AUSBILDUNG;
  if (normalized.includes("jugend")) return CATEGORY_JUGEND;
  return CATEGORY_NEWS;
}

function parseSupplementText(text) {
  const value = String(text || "").trim();
  const match = /^(zusatzinfo|z)\s*:\s*([\s\S]+)$/i.exec(value);
  return match ? normalizeWhitespace(match[2]) : "";
}

function isSupplementPrefix(text) {
  return /^(zusatzinfo|z)\s*:/i.test(String(text || "").trim());
}

function rewriteMessageText(messageContent, text) {
  const content = { ...(messageContent || {}) };
  if (content.conversation !== undefined) content.conversation = text;
  if (content.extendedTextMessage) {
    content.extendedTextMessage = { ...content.extendedTextMessage, text };
  }
  if (content.imageMessage) {
    content.imageMessage = { ...content.imageMessage, caption: text };
  }
  if (content.videoMessage) {
    content.videoMessage = { ...content.videoMessage, caption: text };
  }
  if (content.documentMessage) {
    content.documentMessage = { ...content.documentMessage, caption: text };
  }
  return content;
}

async function sendStartHintIfNeeded(sock, chatId, message) {
  if (!replyInWhatsApp) return;

  const last = lastStartHints.get(chatId) || 0;
  if (Date.now() - last < 60_000) return;
  lastStartHints.set(chatId, Date.now());

  await sock.sendMessage(chatId, {
    text: [
      "🚒 *Website-Bot wartet auf START*",
      "",
      "Ich speichere noch nichts.",
      "Schreib `START` oder `NEU`, dann sammle ich die nächsten Nachrichten/Bilder für einen Beitrag.",
      "",
      "Beenden später mit `FERTIG`, `STOP` oder `ABBRUCH`."
    ].join("\n")
  }, { quoted: message });
}

function buildDraftText(draft) {
  return [
    draft.title,
    "=".repeat(Math.max(8, String(draft.title || "Entwurf").length)),
    "",
    `Kategorie: ${draft.category || ""}`,
    `Datum: ${draft.date || ""}`,
    `Uhrzeit: ${draft.time || ""}`,
    `Ort: ${draft.location || ""}`,
    `Status: ${draft.status || "needs_review"}`,
    `KI: ${aiProviderLabel()}`,
    "",
    "Kurztext:",
    draft.shortText || "",
    "",
    "Volltext:",
    draft.fullText || "",
    "",
    "Fehlende Infos:",
    Array.isArray(draft.missingInfo) && draft.missingInfo.length ? draft.missingInfo.map((item) => `- ${item}`).join("\n") : "- keine",
    "",
    "Bildhinweise:",
    Array.isArray(draft.imageCaptions) && draft.imageCaptions.length
      ? draft.imageCaptions.map((image) => `- ${image.fileName}: ${image.publishAllowed === false ? "nur Kontext" : "Website"}${image.caption ? ` - ${image.caption}` : ""}`).join("\n")
      : "- keine",
    "",
    "Quellen/Hinweise:",
    Array.isArray(draft.sourceNotes) && draft.sourceNotes.length ? draft.sourceNotes.map((item) => `- ${item}`).join("\n") : "- keine"
  ].join("\n");
}

async function writeRedactionReport(folderPath, draftResult, research) {
  const report = {
    createdAt: new Date().toISOString(),
    aiAvailable: Boolean(draftResult.aiAvailable),
    aiError: draftResult.error || null,
    redaction: draftResult.redactionReport || { enabled: false, replacements: [] },
    geminiGrounding: draftResult.researchMetadata || null,
    localResearch: research || null
  };

  await fs.writeFile(path.join(folderPath, "redaction-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (draftResult.researchMetadata?.sources?.length || draftResult.researchMetadata?.webSearchQueries?.length) {
    const mergedResearch = {
      ...(research || {}),
      geminiGoogleSearch: {
        enabled: true,
        queries: draftResult.researchMetadata.webSearchQueries || [],
        sources: draftResult.researchMetadata.sources || []
      }
    };
    await fs.writeFile(path.join(folderPath, "research.json"), `${JSON.stringify(mergedResearch, null, 2)}\n`, "utf8");
  }
}

async function handleReviewCommand(sock, chatId, message, command) {
  if (command.type === "gitStatus" || command.type === "gitCommit" || command.type === "gitPush") {
    await handleGitCommand(sock, chatId, message, command);
    return;
  }

  if (command.type === "start") {
    const existing = pendingBatches.get(chatId);
    if (existing?.timer) clearTimeout(existing.timer);
    pendingBatches.delete(chatId);

    activeCaptures.set(chatId, {
      startedAt: Date.now(),
      startedBy: message.key.participant || null,
      folderName: "",
      folderPath: ""
    });
    openFollowups.delete(chatId);
    lastStartHints.delete(chatId);

    await sock.sendMessage(chatId, {
      text: [
        "🚒 *Website-Bot - Aufnahme gestartet*",
        "",
        "Ich sammle ab jetzt Nachrichten und Bilder für *einen* neuen Beitrag.",
        "Schicke Text/Bilder jetzt einfach hintereinander.",
        "",
        "Beenden:",
        "`FERTIG` - Entwurf abschließen",
        "`STOP` - Entwurf abschließen",
        "`ABBRUCH` - Entwurf abbrechen",
        "",
        "Befehle wie `BILD 1 NEIN` werden nicht als Inhalt gespeichert."
      ].join("\n")
    }, { quoted: message });
    return;
  }

  const activeCapture = activeCaptures.get(chatId);
  if (activeCapture && !activeCapture.folderPath) {
    const pending = pendingBatches.get(chatId);

    if (command.type === "reject") {
      if (pending?.timer) clearTimeout(pending.timer);
      pendingBatches.delete(chatId);
      activeCaptures.delete(chatId);
      openFollowups.delete(chatId);
      await sock.sendMessage(chatId, {
        text: buildBotNotice("Aufnahme abgebrochen. Es wurde kein neuer Entwurf gespeichert.")
      }, { quoted: message });
      return;
    }

    if (command.type === "finish") {
      if (pending) {
        if (pending.timer) clearTimeout(pending.timer);
        pendingBatches.delete(chatId);
        const saved = await saveBatch(pending);
        if (saved?.folderPath) {
          const moved = await finishDraft({ folderName: saved.folderName, folderPath: saved.folderPath }, chatId);
          await sock.sendMessage(chatId, {
            text: buildBotNotice(`✅ Entwurf abgeschlossen und nach Bearbeiten/Entwurf verschoben.\nOrdner: ${moved.folderName}`)
          }, { quoted: message });
          return;
        }
      }

      activeCaptures.delete(chatId);
      await sock.sendMessage(chatId, {
        text: buildBotNotice("Aufnahme beendet. Es war noch kein Material gespeichert.")
      }, { quoted: message });
      return;
    }

    if (command.type === "help" || command.type === "menu") {
      await sock.sendMessage(chatId, {
        text: buildBotNotice("Aufnahme läuft, aber es gibt noch keinen gespeicherten Entwurf. Schicke Material oder `FERTIG`, dann zeige ich Menü/Vorschau.")
      }, { quoted: message });
      return;
    }

    if (!["help", "menu"].includes(command.type)) {
      await sock.sendMessage(chatId, {
        text: buildBotNotice("Ich sammle gerade noch den neuen Beitrag. Warte kurz auf den Entwurf oder schicke weitere Bilder/Texte. Mit `FERTIG` speichere ich sofort ab.")
      }, { quoted: message });
      return;
    }
  }

  const review = await findCurrentReview(chatId);
  if (!review) {
    if (command.type === "help" || command.type === "menu") {
      await sock.sendMessage(chatId, { text: buildHelpText() }, { quoted: message });
      return;
    }

    if (command.type === "reject" || command.type === "finish") {
      activeCaptures.delete(chatId);
      openFollowups.delete(chatId);
      await sock.sendMessage(chatId, {
        text: buildBotNotice("Aufnahme beendet. Neue Inhalte werden erst wieder nach `START` gespeichert.")
      }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, {
      text: buildBotNotice("Kein offener Entwurf fuer diese Gruppe gefunden.")
    }, { quoted: message });
    return;
  }

  const bundle = await readDraftBundle(review.folderPath);
  let state = bundle.state;

  if (command.type === "help") {
    await sock.sendMessage(chatId, { text: buildHelpText() }, { quoted: message });
    return;
  }

  if (command.type === "menu") {
    await sock.sendMessage(chatId, { text: buildMenuText(review, bundle) }, { quoted: message });
    return;
  }

  if (command.type === "status") {
    await sock.sendMessage(chatId, {
      text: buildStatusText(review, bundle)
    }, { quoted: message });
    return;
  }

  if (command.type === "preview") {
    await sendPreview(sock, chatId, message, review, bundle);
    return;
  }

  if (command.type === "details") {
    await sock.sendMessage(chatId, { text: buildDetailsText(review, bundle) }, { quoted: message });
    return;
  }

  if (command.type === "sources") {
    await sock.sendMessage(chatId, { text: buildSourcesText(bundle.research) }, { quoted: message });
    return;
  }

  if (command.type === "images") {
    await sock.sendMessage(chatId, { text: buildImagesText(bundle) }, { quoted: message });
    return;
  }

  if (command.type === "imageSet" || command.type === "imageTitle") {
    const reply = await updateImageSetting(review, bundle, command);
    await sock.sendMessage(chatId, { text: buildBotNotice(`${reply}\n\n${buildImagesText(bundle)}`) }, { quoted: message });
    return;
  }

  if (command.type === "fieldSet") {
    const reply = await updateDraftField(review, bundle, command);
    await sock.sendMessage(chatId, { text: buildBotNotice(`${reply}\n\n${buildDraftDashboard(bundle.draft, bundle.data, review.folderName, bundle.research, true)}`) }, { quoted: message });
    return;
  }

  if (command.type === "research" || command.type === "search") {
    const result = await runResearchAndUpdateDraft(review, bundle, command);
    await sock.sendMessage(chatId, { text: result.text }, { quoted: message });
    return;
  }

  if (command.type === "style") {
    const allowed = ["kurz", "ausfuhrlich", "ausfuehrlich", "offizieller", "lockerer", "sachlicher", "bericht", "social-media"];
    if (!allowed.includes(command.style)) {
      await sock.sendMessage(chatId, { text: buildBotNotice("Unbekannter Stil. Erlaubt: kurz, ausführlich, offizieller, lockerer, sachlicher, bericht, social-media.") }, { quoted: message });
      return;
    }

    const draftResult = await regenerateDraft(
      review,
      bundle,
      `Formuliere den bestehenden Entwurf im Stil "${command.rawStyle || command.style}". Fakten unverändert lassen.`,
      `STIL: ${command.rawStyle || command.style}`
    );

    await sock.sendMessage(chatId, {
      text: draftResult.aiAvailable
        ? buildDraftDashboard(draftResult.draft, bundle.data, review.folderName, bundle.research, true)
        : buildBotNotice(`Stilwunsch gespeichert, aber KI ist momentan nicht verfügbar.\nOrdner: ${review.folderName}`)
    }, { quoted: message });
    return;
  }

  if (command.type === "finish") {
    state = {
      ...state,
      status: "finished",
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeReviewState(review.folderPath, state);
    const moved = await finishDraft(review, chatId);
    await sock.sendMessage(chatId, {
      text: buildBotNotice(`✅ Entwurf abgeschlossen und nach Bearbeiten/Entwurf verschoben.\nOrdner: ${moved.folderName}\nNeue WhatsApp-Nachrichten werden ab jetzt als neuer Beitrag erkannt.`)
    }, { quoted: message });
    return;
  }

  if (command.type === "approve") {
    state = {
      ...state,
      status: "approved",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeReviewState(review.folderPath, state);
    openReviews.set(chatId, { ...review, status: "approved", updatedAt: Date.now() });

    await sock.sendMessage(chatId, {
      text: "✅ *Entwurf bestätigt.*\n\nMit `ONLINE` veröffentlichen oder mit `VORSCHAU` nochmal prüfen."
    }, { quoted: message });
    return;
  }

  if (command.type === "reject") {
    state = {
      ...state,
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeReviewState(review.folderPath, state);
    openReviews.delete(chatId);
    openFollowups.delete(chatId);
    activeCaptures.delete(chatId);

    await sock.sendMessage(chatId, {
      text: buildBotNotice(`Entwurf abgebrochen/abgelehnt.\nOrdner bleibt lokal erhalten: ${review.folderName}`)
    }, { quoted: message });
    return;
  }

  if (command.type === "change") {
    const draftResult = await regenerateDraft(review, bundle, command.instruction, `AENDERN: ${command.instruction}`);

    state = {
      ...state,
      status: "review_pending",
      draftStatus: draftResult.draft.status,
      aiAvailable: draftResult.aiAvailable,
      aiError: draftResult.error || null,
      lastChangeInstruction: command.instruction,
      updatedAt: new Date().toISOString()
    };
    await writeReviewState(review.folderPath, state);
    openReviews.set(chatId, { ...review, status: "review_pending", updatedAt: Date.now() });

    const reply = draftResult.aiAvailable
      ? buildDraftDashboard(draftResult.draft, bundle.data, review.folderName, bundle.research, true)
      : buildBotNotice(`Aenderung gespeichert, aber KI ist momentan nicht verfuegbar.\nOrdner: ${review.folderName}`);

    await sock.sendMessage(chatId, { text: reply }, { quoted: message });
    return;
  }

  if (command.type === "publish") {
    try {
      const publishResult = await publishDraft({
        folderPath: review.folderPath,
        draft: bundle.draft,
        data: bundle.data,
        meta: bundle.meta,
        config: botConfig,
        force: command.force
      });

      if (!publishResult.ok) {
        const forceHint = publishResult.allowForce
          ? "\nBitte ergaenzen oder mit ONLINE TROTZDEM bewusst bestaetigen."
          : "\nBitte zuerst klaeren; bewusstes Uebergehen ist hier nicht erlaubt.";

        await sock.sendMessage(chatId, {
          text: buildBotNotice(`${publishResult.reason}${forceHint}`)
        }, { quoted: message });
        return;
      }

      state = {
        ...state,
        status: "published",
        publishedAt: publishResult.published.publishedAt,
        postId: publishResult.post.Id,
        slug: publishResult.post.Slug,
        updatedAt: new Date().toISOString()
      };
      await writeReviewState(review.folderPath, state);
      openReviews.delete(chatId);
      openFollowups.delete(chatId);
      activeCaptures.delete(chatId);

      await sock.sendMessage(chatId, {
        text: buildBotNotice([
          "Beitrag wurde in die Website-Daten uebernommen.",
          `Titel: ${publishResult.post.Titel}`,
          `ID: ${publishResult.post.Id}`,
          `Slug: ${publishResult.post.Slug}`,
          `Bilder: ${publishResult.post.Bilder.length}`,
          "Die Website baut den Beitrag aus wwwroot/data/posts.json."
        ].join("\n"))
      }, { quoted: message });
    } catch (error) {
      await sock.sendMessage(chatId, {
        text: buildBotNotice(`ONLINE fehlgeschlagen. posts.json wurde nicht bewusst ueberschrieben.\nFehler: ${error?.message || error}`)
      }, { quoted: message });
    }
  }
}

async function handleGitCommand(sock, chatId, message, command) {
  try {
    if (command.type === "gitStatus") {
      const status = await getGitStatus({ cwd: projectRoot });
      await sock.sendMessage(chatId, { text: buildGitStatusText(status) }, { quoted: message });
      return;
    }

    if (command.type === "gitCommit") {
      const result = await createCommit({ cwd: projectRoot, message: command.message });
      if (!result.ok) {
        await sock.sendMessage(chatId, { text: buildBotNotice(result.reason) }, { quoted: message });
        return;
      }

      pendingPushes.set(chatId, {
        commit: result.commit,
        message: result.message,
        createdAt: Date.now()
      });

      await sock.sendMessage(chatId, { text: buildCommitResultText(result) }, { quoted: message });
      return;
    }

    if (command.type === "gitPush") {
      const pending = pendingPushes.get(chatId);
      await sock.sendMessage(chatId, {
        text: [
          "🌐 *Push wird gestartet*",
          "",
          pending ? `Commit: ${pending.commit}` : "Commit: letzte lokale Commits auf diesem Branch",
          "Remote: GitHub LukeX2010/FFRastenfeld2",
          "",
          "Falls GitHub ein Anmelde-/Benutzerfenster öffnet, musst du es am Laptop bestätigen.",
          "Danach deployed Netlify automatisch, wenn dein Netlify-Setup mit diesem Repo verbunden ist."
        ].filter((line) => !line.includes("Anmelde-/Benutzerfenster")).join("\n")
      }, { quoted: message });

      const result = await pushToOrigin({ cwd: projectRoot });
      if (!result.ok) {
        await sock.sendMessage(chatId, { text: buildBotNotice(result.reason) }, { quoted: message });
        return;
      }

      pendingPushes.delete(chatId);
      await sock.sendMessage(chatId, { text: buildPushResultText(result) }, { quoted: message });
    }
  } catch (error) {
    await sock.sendMessage(chatId, {
      text: buildBotNotice(`Git-Aktion fehlgeschlagen:\n${error?.message || error}`)
    }, { quoted: message });
  }
}

function buildGitStatusText(status) {
  const allowed = status.allowed.map((file) => `- ${file.path}`).slice(0, 20);
  const blocked = status.blocked.map((file) => `- ${file.path}`).slice(0, 12);

  return [
    "🧾 *Git Status*",
    "",
    `Remote: ${status.remote || "nicht erkannt"}`,
    `Branch: ${status.branch || "nicht erkannt"}`,
    "",
    "*Würde committen:*",
    allowed.length ? allowed.join("\n") : "- keine erlaubten Änderungen",
    "",
    "*Wird ignoriert:*",
    blocked.length ? blocked.join("\n") : "- nichts",
    "",
    "Nächster Schritt:",
    "`COMMIT: deine Nachricht`"
  ].join("\n");
}

function buildCommitResultText(result) {
  return [
    "✅ *Commit erstellt*",
    "",
    `Commit: ${result.commit}`,
    `Nachricht: ${result.message}`,
    "",
    "*Dateien:*",
    result.staged.slice(0, 20).map((line) => `- ${line}`).join("\n"),
    result.blocked.length
      ? `\n*Nicht mitgenommen:*\n${result.blocked.slice(0, 10).map((file) => `- ${file.path}`).join("\n")}`
      : "",
    "",
    "Zum Hochladen:",
    "`PUSH`",
    "",
    "Hinweis: Wenn GitHub nach Benutzer fragt, am Laptop das Fenster bestätigen."
  ].filter((line) => Boolean(line) && !line.includes("GitHub nach Benutzer")).join("\n");
}

function buildPushResultText(result) {
  return [
    "🌐 *Push erfolgreich*",
    "",
    `Branch: ${result.branch}`,
    "Repo: LukeX2010/FFRastenfeld2",
    "",
    "Netlify sollte jetzt automatisch deployen, wenn es mit diesem Branch verbunden ist.",
    result.output ? `\nGit:\n${result.output.slice(0, 1000)}` : ""
  ].join("\n");
}

async function findCurrentReview(chatId) {
  const memory = openReviews.get(chatId);
  if (memory && await fileExists(path.join(memory.folderPath, "review-state.json"))) {
    return memory;
  }

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
    const state = await readJsonFile(path.join(folderPath, "review-state.json"));
    if (state.chatId !== chatId) continue;
    if (["rejected", "published", "finished"].includes(state.status)) continue;

    const timestamp = Date.parse(state.updatedAt || state.createdAt || "");
    candidates.push({
      folderName: entry.name,
      folderPath,
      status: state.status || "review_pending",
      updatedAt: Number.isFinite(timestamp) ? timestamp : 0
    });
  }

  candidates.sort((a, b) => b.updatedAt - a.updatedAt);
  const current = candidates[0] || null;
  if (current) openReviews.set(chatId, current);
  return current;
}

async function readDraftBundle(folderPath) {
  return {
    draft: await readJsonFile(path.join(folderPath, "draft.json")),
    data: await readJsonFile(path.join(folderPath, "daten.json")),
    meta: await readJsonFile(path.join(folderPath, "meta.json")),
    research: await readJsonFile(path.join(folderPath, "research.json")),
    state: await readJsonFile(path.join(folderPath, "review-state.json")),
    text: await readTextFile(path.join(folderPath, "nachricht.txt"))
  };
}

async function writeReviewState(folderPath, state) {
  await fs.writeFile(path.join(folderPath, "review-state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
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
    const caption = normalizeWhitespace(content.imageMessage.caption || "");
    const { description, policyText } = parseImageCaption(caption);
    parts.push({
      kind: "image",
      contentType,
      mimetype: content.imageMessage.mimetype,
      caption,
      description,
      policyText,
      publishAllowed: isImagePublishAllowed(policyText),
      publishUsage: isImagePublishAllowed(policyText) ? "website" : "context_only"
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
  return normalizeForAnalysis(value)
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

function normalizeForAnalysis(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
          description: media.description || null,
          messageId: mediaMessage.message.key.id || null,
          publishAllowed: media.publishAllowed !== false,
          publishUsage: media.publishUsage || "website"
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

function extractDateValue(text) {
  const match = /(\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b|\b\d{1,2}\.\s?(januar|februar|maerz|märz|marz|april|mai|juni|juli|august|september|oktober|november|dezember)\b|\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|\bheute\b|\bgestern\b|\bmorgen\b)/i.exec(text);
  return match ? normalizeWhitespace(match[1]) : "";
}

function extractTimeValue(text) {
  const match = /(\b\d{1,2}:\d{2}\b|\b\d{1,2}\.\d{2}\s?uhr\b|\b\d{1,2}\s?uhr\b)/i.exec(text);
  return match ? normalizeWhitespace(match[1]) : "";
}

function buildDataJson(fields, analysis, images) {
  const publishableImages = images.filter((image) => image.publishAllowed !== false);
  const contextOnlyImages = images.filter((image) => image.publishAllowed === false);

  return {
    status: analysis.missingInfo.length > 0 ? "needs_review" : "ready",
    category: analysis.category,
    fields,
    missingInfo: analysis.missingInfo,
    imagePolicy: {
      total: images.length,
      publishable: publishableImages.length,
      contextOnly: contextOnlyImages.length,
      rule: "Bilder mit Caption 'nein', 'nicht posten', 'intern' oder ähnlichem nicht veröffentlichen; nur als Kontext verwenden."
    },
    images: images.map((image) => ({
      fileName: image.fileName,
      caption: image.caption || "",
      description: image.description || "",
      publishAllowed: image.publishAllowed !== false,
      usage: image.publishAllowed === false ? "context_only" : "website",
      note: image.publishAllowed === false
        ? "Nicht auf der Website verwenden. Nur als Infodetail/Kontext fuer den Beitrag."
        : "Darf fuer die Website verwendet werden, sofern bei manueller Pruefung keine Datenschutzprobleme auffallen."
    })),
    aiInstructions: [
      "Keine Fakten erfinden.",
      "Fehlende Informationen neutral formulieren oder als fehlend markieren.",
      "Bilder mit publishAllowed=false nie veroeffentlichen, nur als Kontext/Infodetail nutzen.",
      "Bei Einsatzbildern, Personen, Kennzeichen oder sensiblen Infos besonders vorsichtig sein.",
      "Online-Informationen duerfen nur zur vorsichtigen Pruefung oder Ergaenzung genutzt werden, wenn sie eindeutig aktuell und zum Thema passend sind.",
      "Wenn online nichts Sicheres gefunden wird, nichts dazuerfinden."
    ]
  };
}

function buildCodexPrompt(data, text) {
  const publishable = data.images.filter((image) => image.publishAllowed).map((image) => image.fileName);
  const contextOnly = data.images.filter((image) => !image.publishAllowed).map((image) => image.fileName);

  return [
    "Aufgabe fuer Codex/KI:",
    "Erstelle aus diesem Ordner einen Website-Beitrag fuer die FF Rastenfeld.",
    "",
    "Wichtige Regeln:",
    "- Keine Fakten erfinden.",
    "- Wenn Informationen fehlen, neutral formulieren oder fehlende Informationen nennen.",
    "- Online-Informationen duerfen nur zur Pruefung/Ergaenzung genutzt werden, wenn sie eindeutig aktuell, verlaesslich und direkt zum Thema passend sind.",
    "- Wenn online keine sicheren Informationen gefunden werden, nichts ergaenzen und nichts dazuerfinden, aber so Googlen über die einzelnen dinge um Infos zu bekommen wie wo und bei welcher verantstaltung zum Beispiel schon.",
    "- Stil, Aufbau und Formulierung an bestehenden Website-Beitraegen orientieren.",
    "- Umlaute verwenden wie ä,ö,ü und keien ae ue oe ",
    "- beachte: Formulierung ist jetzt für die FF-Website passend, also nicht mehr „wir gratulieren“, sondern ein Bericht über Anlass, Ort und Bedeutung der Ehrung. beispiel ehrung halt",
    "",
    "Bildregeln:",
    `- Fuer Website erlaubt: ${publishable.length > 0 ? publishable.join(", ") : "keine"}`,
    `- Nur Kontext/Infodetail, NICHT veroeffentlichen: ${contextOnly.length > 0 ? contextOnly.join(", ") : "keine"}`,
    "- context_only-Bilder duerfen inhaltlich ausgewertet werden, aber nicht als Website-Bild eingebunden werden.",
    "- analysiere die bilder und nehme wenn sichtbar davon auch Infos auch wenn nötig aus dem internet",
    "Strukturierte Daten:",
    JSON.stringify(data, null, 2),
    "",
    "Originalnachricht:",
    text || "(kein Text)"
  ].join("\n");
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
    updated ? "Zusatzinfos wurden im bestehenden Ordner ergaenzt." : "Gespeichert fuer die Website-Bearbeitung.",
    `Kategorie: ${analysis.category}`,
    imageLine,
    `Ordner: ${folderName}`
  ];

  if (analysis.missingInfo.length > 0) {
    lines.push("");
    lines.push(`Bitte noch als Zusatzinfo schicken: ${analysis.missingInfo.join(", ")}`);
  } else {
    lines.push("");
    lines.push("Alle wichtigen Basisinfos sind vorhanden.");
  }

  return lines.join("\n");
}

function buildBotNotice(message) {
  return ["*----- Website Bot :) -----*", message].join("\n");
}

async function sendStartupOnlineMessage(sock) {
  if (!replyInWhatsApp || !startupOnlineMessage) return;

  for (const chatId of allowedChatIds) {
    if (startupMessagesSent.has(chatId)) continue;
    startupMessagesSent.add(chatId);

    await sock.sendMessage(chatId, {
      text: buildBotNotice("Bot ist online und hört wieder auf neue Nachrichten.")
    });
  }
}

function isBotReply(text) {
  if (/^Bild\s+\d+\/\d+\s+(·|Â·)/i.test(text)) return true;

  return [
    "*----- Website Bot",
    "*Website-Bot",
    "🚒 *Website-Bot",
    "📌 *Status Entwurf",
    "📝 *Vorschau Website-Beitrag",
    "🖼️ *Bilder verwalten",
    "🔎 *Recherche",
    "🧾 *Details Entwurf",
    "✅ *Entwurf",
    "Gespeichert fuer die Website-Bearbeitung."
  ].some((prefix) => text.startsWith(prefix));
}

function parseImageCaption(caption) {
  const raw = normalizeWhitespace(caption);
  if (!raw) return { description: null, policyText: "" };

  const match = /\bD\s*:\s*(.+)/i.exec(raw);
  if (!match) return { description: null, policyText: raw };

  const description = normalizeWhitespace(match[1]) || null;
  const policyText = normalizeWhitespace(raw.slice(0, match.index));
  return { description, policyText };
}

function isImagePublishAllowed(caption) {
  const normalized = normalizeForAnalysis(caption);
  if (!normalized) return true;

  return !/(^|\s)(nein|no|nicht posten|nicht veroeffentlichen|nicht veroffentlichen|nicht verwenden|intern|privat|keine freigabe|nur info|nur kontext)(\s|$)/i.test(normalized);
}

function isImagePolicyOnly(text, mediaParts) {
  if (!text || mediaParts.length === 0) return false;
  const normalized = normalizeForAnalysis(text);

  return /^(nein|no|nicht posten|nicht veroeffentlichen|nicht veroffentlichen|nicht verwenden|intern|privat|keine freigabe|nur info|nur kontext)$/.test(normalized);
}

function shouldAddBatchText(text, mediaParts) {
  if (!text) return false;
  if (isImagePolicyOnly(text, mediaParts)) return false;
  if (isImageCaptionText(text, mediaParts)) return false;
  return true;
}

function isImageCaptionText(text, mediaParts) {
  const normalized = normalizeWhitespace(text);
  return mediaParts.some((part) => {
    if (part.caption && normalizeWhitespace(part.caption) === normalized) return true;
    if (part.description && normalizeWhitespace(part.description) === normalized) return true;
    if (part.description && normalizeWhitespace(`D: ${part.description}`) === normalized) return true;
    return false;
  });
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "ja"].includes(String(value).toLowerCase());
}

function parseVersion(value) {
  const parts = String(value || "")
    .split(".")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= 0);

  return parts.length === 3 ? parts : [2, 3000, 1035194821];
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

async function ensureSingleBotInstance() {
  let existingPid = null;

  try {
    const content = await fs.readFile(pidFilePath, "utf8");
    existingPid = Number(content.trim());
  } catch {
    existingPid = null;
  }

  if (existingPid && existingPid !== process.pid && isProcessRunning(existingPid)) {
    console.error(`Bot laeuft bereits mit PID ${existingPid}.`);
    console.error("Bitte zuerst das alte Bot-Terminal schliessen oder den Node-Prozess beenden.");
    process.exit(1);
  }

  await fs.writeFile(pidFilePath, String(process.pid), "utf8");

  const cleanup = async () => {
    try {
      const content = await fs.readFile(pidFilePath, "utf8");
      if (Number(content.trim()) === process.pid) {
        await fs.rm(pidFilePath, { force: true });
      }
    } catch {
      // PID-Datei ist nur eine Startsperre. Fehler beim Aufraeumen sind unkritisch.
    }
  };

  process.once("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.once("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  process.once("exit", () => {
    fs.rm(pidFilePath, { force: true }).catch(() => undefined);
  });
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
