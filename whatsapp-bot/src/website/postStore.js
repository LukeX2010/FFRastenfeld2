import fs from "node:fs/promises";
import path from "node:path";

export async function readPosts(postsJsonPath) {
  const content = await fs.readFile(postsJsonPath, "utf8");
  const posts = JSON.parse(content);
  if (!Array.isArray(posts)) throw new Error("posts.json muss ein JSON-Array sein.");
  return posts;
}

export async function writePostsWithBackup(postsJsonPath, posts) {
  await fs.mkdir(path.dirname(postsJsonPath), { recursive: true });
  const backupPath = await backupPosts(postsJsonPath);
  const tempPath = `${postsJsonPath}.${process.pid}.tmp`;

  await fs.writeFile(tempPath, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, postsJsonPath);

  return backupPath;
}

export async function backupPosts(postsJsonPath) {
  try {
    await fs.access(postsJsonPath);
  } catch {
    return null;
  }

  const backupDir = path.join(path.dirname(postsJsonPath), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `posts-${formatStamp(new Date())}.json`);
  await fs.copyFile(postsJsonPath, backupPath);
  return backupPath;
}

export function validatePosts(posts) {
  const ids = new Set();
  const slugs = new Set();
  const duplicateIds = [];
  const duplicateSlugs = [];

  for (const post of posts) {
    if (ids.has(post.Id)) duplicateIds.push(post.Id);
    ids.add(post.Id);

    if (post.Slug && slugs.has(post.Slug)) duplicateSlugs.push(post.Slug);
    if (post.Slug) slugs.add(post.Slug);
  }

  return {
    ok: duplicateIds.length === 0,
    duplicateIds: [...new Set(duplicateIds)],
    duplicateSlugs: [...new Set(duplicateSlugs)]
  };
}

export function nextPostId(posts) {
  return posts.reduce((max, post) => Math.max(max, Number(post.Id || 0)), 0) + 1;
}

export function makeUniqueSlug(baseSlug, posts) {
  const existing = new Set(posts.map((post) => post.Slug).filter(Boolean));
  const base = slugify(baseSlug || "beitrag") || "beitrag";

  if (!existing.has(base)) return base;

  for (let index = 2; index < 1000; index++) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function formatStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}
