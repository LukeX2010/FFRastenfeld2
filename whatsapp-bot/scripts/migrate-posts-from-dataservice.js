import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const botRoot = path.resolve(scriptDir, "..");
const projectRoot = path.resolve(botRoot, "..");
const dataServicePath = path.join(projectRoot, "Services", "DataService.cs");
const postsJsonPath = path.join(projectRoot, "wwwroot", "data", "posts.json");
const backupsDir = path.join(projectRoot, "wwwroot", "data", "backups");

const force = process.argv.includes("--force");

await main();

async function main() {
  await fs.mkdir(path.dirname(postsJsonPath), { recursive: true });
  await fs.mkdir(backupsDir, { recursive: true });

  const existing = await readText(postsJsonPath);
  if (existing.trim()) {
    await backupFile(postsJsonPath);

    if (!force) {
      const count = countJsonPosts(existing);
      console.log(
        `posts.json existiert bereits (${count} Posts). Kein Ueberschreiben ohne --force. Backup wurde erstellt.`
      );
      return;
    }
  }

  const source = await fs.readFile(dataServicePath, "utf8");
  const posts = parsePostsFromDataService(source);
  if (posts.length === 0) {
    throw new Error("Keine Posts in Services/DataService.cs gefunden.");
  }

  await writeJsonAtomic(postsJsonPath, posts);
  console.log(`${posts.length} Posts nach ${path.relative(projectRoot, postsJsonPath)} migriert.`);
}

function parsePostsFromDataService(source) {
  const startMarker = "public List<Post> GetPosts()";
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error("GetPosts() wurde nicht gefunden.");

  const firstBrace = source.indexOf("{", start);
  if (firstBrace === -1) throw new Error("Start der Post-Liste wurde nicht gefunden.");

  const endBrace = findMatching(source, firstBrace, "{", "}");
  const listBody = source.slice(firstBrace + 1, endBrace);
  const blocks = extractPostBlocks(listBody);

  return blocks.map(parsePostBlock);
}

function extractPostBlocks(source) {
  const blocks = [];
  let index = 0;

  while (index < source.length) {
    const match = /new\s+Post\s*\{/g.exec(source.slice(index));
    if (!match) break;

    const newIndex = index + match.index;
    const braceIndex = source.indexOf("{", newIndex);
    const endBrace = findMatching(source, braceIndex, "{", "}");
    blocks.push(source.slice(braceIndex + 1, endBrace));
    index = endBrace + 1;
  }

  return blocks;
}

function parsePostBlock(block) {
  const raw = Object.create(null);
  for (const part of splitTopLevel(block, ",")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*?)\s*$/.exec(part);
    if (!match) continue;

    raw[match[1]] = parseValue(match[2]);
  }

  return {
    Id: Number(raw.Id || 0),
    Slug: String(raw.Slug || ""),
    Emoji: String(raw.Emoji || ""),
    Titel: String(raw.Titel || ""),
    Kategorie: String(raw.Kategorie || ""),
    Datum: String(raw.Datum || ""),
    Kurztext: String(raw.Kurztext || ""),
    Volltext: String(raw.Volltext || ""),
    Bilder: Array.isArray(raw.Bilder) ? raw.Bilder : [],
    BildPlaceholder: String(raw.BildPlaceholder || "🔥"),
    EinsatzTyp: raw.EinsatzTyp ?? null,
    EinsatzOrt: raw.EinsatzOrt ?? null,
    EinsatzZeit: raw.EinsatzZeit ?? null,
    EinsatzKraefte: raw.EinsatzKraefte ?? null
  };
}

function parseValue(expression) {
  const value = expression.trim().replace(/,\s*$/, "");

  if (/^new\s+DateTime\s*\(/.test(value)) return parseDateTime(value);
  if (/^\[/.test(value)) return parseStringArray(value);
  if (/^\d+$/.test(value)) return Number(value);
  if (/^null$/i.test(value)) return null;
  if (value.includes("\"")) return parseStringExpression(value);

  return value;
}

function parseDateTime(value) {
  const argsMatch = /new\s+DateTime\s*\(([\s\S]*?)\)/.exec(value);
  if (!argsMatch) return "";

  const parts = splitTopLevel(argsMatch[1], ",").map((part) => Number(part.trim()));
  const [year, month, day, hour = 0, minute = 0, second = 0] = parts;

  return [
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    `T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
  ].join("");
}

function parseStringArray(value) {
  const start = value.indexOf("[");
  const end = findMatching(value, start, "[", "]");
  const body = value.slice(start + 1, end);

  return splitTopLevel(body, ",")
    .map((part) => parseStringExpression(part))
    .filter((item) => item.length > 0);
}

function parseStringExpression(value) {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const quote = value.indexOf("\"", index);
    if (quote === -1) break;

    let cursor = quote + 1;
    let literal = "";

    while (cursor < value.length) {
      const char = value[cursor];
      if (char === "\\") {
        const next = value[cursor + 1];
        literal += decodeEscape(next);
        cursor += 2;
        continue;
      }

      if (char === "\"") break;
      literal += char;
      cursor++;
    }

    result += literal;
    index = cursor + 1;
  }

  return result;
}

function decodeEscape(char) {
  switch (char) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "\\":
      return "\\";
    case "\"":
      return "\"";
    default:
      return char || "";
  }
}

function splitTopLevel(source, separator) {
  const parts = [];
  let start = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let inString = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const prev = source[index - 1];

    if (char === "\"" && prev !== "\\") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "(") paren++;
    else if (char === ")") paren--;
    else if (char === "{") brace++;
    else if (char === "}") brace--;
    else if (char === "[") bracket++;
    else if (char === "]") bracket--;
    else if (char === separator && paren === 0 && brace === 0 && bracket === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function findMatching(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let inString = false;

  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];
    const prev = source[index - 1];

    if (char === "\"" && prev !== "\\") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === openChar) depth++;
    if (char === closeChar) depth--;
    if (depth === 0) return index;
  }

  throw new Error(`Kein passendes '${closeChar}' gefunden.`);
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function backupFile(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const stamp = formatStamp(new Date());
  const backupPath = path.join(backupsDir, `posts-${stamp}.json`);
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

async function writeJsonAtomic(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function countJsonPosts(content) {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function formatStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}
