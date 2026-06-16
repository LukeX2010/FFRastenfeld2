import fs from "node:fs/promises";
import path from "node:path";
import { makeUniqueSlug, nextPostId, readPosts, validatePosts, writePostsWithBackup } from "./postStore.js";

export async function publishDraft({ folderPath, draft, data, meta, config, force = false }) {
  const missingInfo = asArray(draft?.missingInfo);
  const safetyWarnings = asArray(draft?.safetyWarnings);
  const hardWarnings = safetyWarnings.filter(isHardSafetyWarning);

  if (missingInfo.length > 0 && !force) {
    return {
      ok: false,
      blocked: true,
      reason: `Es fehlen noch Infos: ${missingInfo.join(", ")}`,
      allowForce: hardWarnings.length === 0
    };
  }

  if (hardWarnings.length > 0) {
    return {
      ok: false,
      blocked: true,
      reason: `Harte Datenschutz-/Sicherheitswarnung: ${hardWarnings.join(", ")}`,
      allowForce: false
    };
  }

  const posts = await readPosts(config.postsJsonPath);
  const validation = validatePosts(posts);
  if (validation.duplicateIds.length > 0) {
    throw new Error(`posts.json enthaelt doppelte IDs: ${validation.duplicateIds.join(", ")}`);
  }

  const slug = makeUniqueSlug(draft.slug || draft.title, posts);
  const copiedImages = await copyPublishableImages({ folderPath, slug, data, config });
  const post = buildPost({ posts, slug, draft, copiedImages, meta });
  const nextPosts = [post, ...posts];
  const backupPath = await writePostsWithBackup(config.postsJsonPath, nextPosts);

  const published = {
    status: "published",
    publishedAt: new Date().toISOString(),
    postId: post.Id,
    slug,
    copiedImages,
    backupPath,
    postsJsonPath: config.postsJsonPath
  };

  await fs.writeFile(path.join(folderPath, "published.json"), `${JSON.stringify(published, null, 2)}\n`, "utf8");
  return { ok: true, post, published };
}

function buildPost({ posts, slug, draft, copiedImages, meta }) {
  const category = normalizeCategory(draft.category);
  const datum = buildDateTime(draft.date, draft.time, meta?.messageDate);

  return {
    Id: nextPostId(posts),
    Slug: slug,
    Emoji: "",
    Titel: draft.title || "Beitrag der FF Rastenfeld",
    Kategorie: category,
    Datum: datum,
    Kurztext: draft.shortText || "",
    Volltext: draft.fullText || "",
    Bilder: copiedImages.map((image) => image.relativePath),
    BildPlaceholder: "🔥",
    EinsatzTyp: category === "Einsätze" ? cleanNullable(draft.einsatzType) : null,
    EinsatzOrt: category === "Einsätze" ? cleanNullable(draft.location) : null,
    EinsatzZeit: category === "Einsätze" ? cleanNullable(draft.time) : null,
    EinsatzKraefte: null
  };
}

async function copyPublishableImages({ folderPath, slug, data, config }) {
  const images = Array.isArray(data?.images) ? data.images : [];
  const publishable = images.filter((image) => image.publishAllowed !== false);
  if (publishable.length === 0) return [];

  const publicDir = path.resolve(config.publicImageDir, slug);
  const imgRoot = path.resolve(config.publicImageDir, "..");
  await fs.mkdir(publicDir, { recursive: true });

  const copied = [];
  for (const image of publishable) {
    const source = path.join(folderPath, image.fileName);
    const safeName = safeFileName(image.fileName);
    const target = path.join(publicDir, safeName);

    try {
      await fs.copyFile(source, target);
      copied.push({
        fileName: safeName,
        source,
        target,
        relativePath: path.relative(imgRoot, target).replace(/\\/g, "/")
      });
    } catch (error) {
      copied.push({
        fileName: safeName,
        source,
        target,
        error: error?.message || String(error)
      });
    }
  }

  return copied.filter((image) => !image.error);
}

function buildDateTime(dateValue, timeValue, fallbackValue) {
  const date = normalizeDate(dateValue) || normalizeDate(fallbackValue) || new Date().toISOString().slice(0, 10);
  const time = normalizeTime(timeValue) || "00:00";
  return `${date}T${time}:00`;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
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
  const text = String(value || "").trim().replace(".", ":");
  const match = /(\d{1,2}):(\d{2})/.exec(text);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;

  const hour = /(\d{1,2})\s*uhr/i.exec(text);
  if (hour) return `${hour[1].padStart(2, "0")}:00`;

  return "";
}

function normalizeCategory(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("eins")) return "Einsätze";
  if (normalized.includes("ausbildung") || normalized.includes("uebung") || normalized.includes("übung")) return "Ausbildung";
  if (normalized.includes("jugend")) return "Feuerwehrjugend";
  return "FF-News";
}

function isHardSafetyWarning(value) {
  return /(datenschutz|kennzeichen|person|gesicht|verletz|unfallopfer|sensibel)/i.test(String(value || ""));
}

function safeFileName(fileName) {
  const parsed = path.parse(String(fileName || "bild.jpeg"));
  const name = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "bild";
  const ext = parsed.ext || ".jpeg";
  return `${name}${ext}`;
}

function cleanNullable(value) {
  const text = String(value || "").trim();
  return text || null;
}

function asArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}
