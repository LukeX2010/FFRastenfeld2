import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createPostDraft } from "./ai/postGenerator.js";
import { parseLooseJson } from "./ai/ollamaClient.js";
import { parseReviewCommand, parseReviewCommands } from "./review/commands.js";
import { readPosts, validatePosts } from "./website/postStore.js";
import { publishDraft } from "./website/publisher.js";
import { runWebResearch } from "./search/webSearch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const botRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(botRoot, "..");
const postsJsonPath = path.join(projectRoot, "wwwroot", "data", "posts.json");

let failed = false;

await checkPostsJson();
await checkCoreImports();
await checkOfflineAiFallback();

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Check OK: JSON und Kernmodule sind ladbar.");
}

async function checkPostsJson() {
  try {
    const posts = await readPosts(postsJsonPath);
    const validation = validatePosts(posts);
    const ids = posts.map((post) => post.Id);

    if (validation.duplicateIds.length > 0) {
      failed = true;
      console.error(`Doppelte IDs in posts.json: ${validation.duplicateIds.join(", ")}`);
    }

    if (validation.duplicateSlugs.length > 0) {
      console.warn(`Hinweis: bestehende doppelte Slugs gefunden: ${validation.duplicateSlugs.join(", ")}`);
    }

    console.log(`posts.json: ${posts.length} Posts, IDs ${Math.min(...ids)}-${Math.max(...ids)}`);
  } catch (error) {
    failed = true;
    console.error(`posts.json ungueltig: ${error?.message || error}`);
  }
}

async function checkCoreImports() {
  const parsed = parseLooseJson('Antwort davor {"status":"ready"} Antwort danach');
  if (!parsed.ok || parsed.data.status !== "ready") {
    failed = true;
    console.error("Loose-JSON-Parser funktioniert nicht.");
  }

  if (parseReviewCommand("ONLINE TROTZDEM")?.type !== "publish") {
    failed = true;
    console.error("Review-Command-Parser funktioniert nicht.");
  }

  const commandChecks = {
    "M": "menu",
    "VORSCHAU": "preview",
    "BILD 1 NEIN": "imageSet",
    "SUCHE: Ottensteiner Seelauf 2026": "search",
    "FERTIG": "finish"
  };

  for (const [command, type] of Object.entries(commandChecks)) {
    if (parseReviewCommand(command)?.type !== type) {
      failed = true;
      console.error(`Review-Command '${command}' wurde nicht als ${type} erkannt.`);
    }
  }

  const multi = parseReviewCommands("BILD 1 NEIN\nBILD 2 NEIN");
  if (multi.length !== 2 || multi.some((command) => command.type !== "imageSet")) {
    failed = true;
    console.error("Mehrzeilige Review-Befehle funktionieren nicht.");
  }

  if (typeof publishDraft !== "function" || typeof runWebResearch !== "function") {
    failed = true;
    console.error("Kernmodule konnten nicht korrekt importiert werden.");
  }

  await fs.access(path.join(botRoot, "src", "index.js"));
}

async function checkOfflineAiFallback() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffr-bot-check-"));
  const result = await createPostDraft({
    folderPath: tempDir,
    originalText: "Kategorie: FF-News\nDatum: 07.06.2026\nOrt: Rastenfeld\nTestnachricht",
    data: {
      category: "FF-News",
      fields: {
        kategorie: "FF-News",
        datum: "07.06.2026",
        ort: "Rastenfeld",
        beschreibung: "Testnachricht"
      },
      missingInfo: [],
      images: []
    },
    meta: { messageDate: "2026-06-07T12:00:00" },
    research: { enabled: false, results: [] },
    config: {
      aiEnabled: true,
      ollamaBaseUrl: "http://127.0.0.1:1",
      ollamaModel: "llama3.1:8b",
      aiTimeoutMs: 300,
      postsJsonPath
    }
  });

  if (result.aiAvailable !== false || !result.draft?.title) {
    failed = true;
    console.error("Offline-KI-Fallback funktioniert nicht.");
  }
}
