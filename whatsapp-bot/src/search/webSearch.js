import fs from "node:fs/promises";
import path from "node:path";

const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "threads.net", "x.com", "twitter.com"];
const OFFICIAL_HINTS = ["feuerwehr", "ff-", "rastenfeld", "noe122", "bfk", "afk", "gemeinde"];

export async function runWebResearch({ folderPath, originalText, data, config }) {
  const result = {
    enabled: Boolean(config.webResearchEnabled),
    performed: false,
    provider: config.webResearchProvider || "none",
    reason: "",
    query: "",
    queries: [],
    results: [],
    createdAt: new Date().toISOString(),
    rules: [
      "Nur fuer News, Ausbildung, Feuerwehrjugend, Veranstaltungen, Ehrungen, Bewerbe oder oeffentliche Termine nutzen.",
      "Bei Einsaetzen nur mit offizieller oder sehr vertrauenswuerdiger Quelle und ohne sensible Details verwenden.",
      "Unsichere Quellen nicht verwenden und nichts erfinden.",
      "Social-Media-Treffer wie Instagram/Facebook nur als Hinweis verwenden, wenn Titel/Snippet eindeutig passen."
    ]
  };

  try {
    if (!config.webResearchEnabled) {
      result.reason = "WEB_RESEARCH_ENABLED ist false.";
      return await finish(folderPath, result);
    }

    const customQuery = compactText(config.webResearchQuery || "");
    if (!customQuery && !shouldResearch(data, originalText)) {
      result.reason = "Kategorie/Inhalt ist nicht fuer automatische Online-Recherche geeignet.";
      return await finish(folderPath, result);
    }

    result.queries = customQuery ? [customQuery] : buildQueries(originalText, data);
    result.query = result.queries[0] || "";

    if (!config.webResearchProvider || config.webResearchProvider === "none") {
      result.reason = "Kein Web-Recherche-Provider konfiguriert; Schnittstelle ist vorbereitet.";
      return await finish(folderPath, result);
    }

    if (config.webResearchProvider !== "bing") {
      result.reason = `Provider '${config.webResearchProvider}' ist nicht implementiert. Verwende WEB_RESEARCH_PROVIDER=bing.`;
      return await finish(folderPath, result);
    }

    const search = await searchWithBing({
      queries: result.queries,
      timeoutMs: Number(config.webResearchTimeoutMs || 10000),
      maxResults: Number(config.webResearchMaxResults || 5),
      fetchPages: Boolean(config.webResearchFetchPages)
    });

    result.performed = search.results.length > 0;
    result.results = search.results;
    result.reason = search.reason || (result.performed ? "Recherche ausgefuehrt." : "Keine passenden Suchtreffer gefunden.");
    return await finish(folderPath, result);
  } catch (error) {
    result.reason = `Recherche fehlgeschlagen: ${error?.message || error}`;
    return await finish(folderPath, result);
  }
}

function shouldResearch(data, text) {
  const category = String(data?.category || data?.fields?.kategorie || "");
  const normalized = normalize(`${category} ${text}`);

  if (normalized.includes("einsatz") || normalized.includes("alarm") || /\b[bst]\d\b/.test(normalized)) {
    return false;
  }

  return [
    "ff-news",
    "ausbildung",
    "feuerwehrjugend",
    "veranstaltung",
    "ehrung",
    "bewerb",
    "wettkampf",
    "termin",
    "fest",
    "messe",
    "wandertag",
    "jugend"
  ].some((keyword) => normalized.includes(keyword));
}

function buildQueries(text, data) {
  const fields = data?.fields || {};
  const base = [
    "FF Rastenfeld",
    fields.ort,
    fields.datum,
    fields.beschreibung || compactText(text)
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 220);

  const topic = [fields.ort, fields.beschreibung || compactText(text)]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 180);

  return unique([
    fields.beschreibung || compactText(text),
    topic,
    base,
    topic ? `"${topic}" "Rastenfeld"` : "",
    topic ? `site:instagram.com ${topic} Rastenfeld` : "",
    topic ? `site:facebook.com ${topic} Rastenfeld` : ""
  ].filter(Boolean)).slice(0, 4);
}

async function searchWithBing({ queries, timeoutMs, maxResults, fetchPages }) {
  const collected = [];
  const notes = [];

  for (const query of queries) {
    const html = await fetchText(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=AT&setlang=de`,
      timeoutMs
    );

    const parsed = parseBingResults(html, query);
    if (parsed.reason) notes.push(parsed.reason);
    collected.push(...parsed.results);

    if (uniqueByUrl(collected).length >= maxResults) break;
  }

  const results = filterRelevantResults(uniqueByUrl(collected), queries).slice(0, maxResults);

  if (fetchPages) {
    await enrichWithPages(results, timeoutMs);
  }

  return {
    results,
    reason: results.length > 0
      ? `Bing-Recherche mit ${queries.length} Suchanfrage(n), ${results.length} verwertbare Treffer.`
      : notes[0] || "Bing lieferte keine verwertbaren Treffer."
  };
}

function parseBingResults(html, query) {
  if (!html.includes("b_algo")) {
    return {
      reason: "Bing lieferte keine normale Ergebnisliste; moeglicherweise blockiert oder keine Treffer.",
      results: []
    };
  }

  const matches = [...html.matchAll(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi)];
  const results = [];

  for (let index = 0; index < matches.length; index++) {
    const linkMatch = matches[index];
    const nextIndex = matches[index + 1]?.index ?? html.length;
    const segment = html.slice(linkMatch.index, nextIndex);

    const url = cleanBingUrl(decodeHtml(linkMatch[1]));
    if (!url || !/^https?:\/\//i.test(url)) continue;

    const title = stripHtml(linkMatch[2]);
    const snippetMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(segment);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
    const host = safeHost(url);

    results.push({
      title,
      url,
      host,
      snippet,
      query,
      sourceType: classifySource(host),
      trustHint: trustHint(host),
      fetched: false,
      pageText: ""
    });
  }

  return { reason: "", results };
}

function filterRelevantResults(results, queries) {
  const queryText = normalize(queries.join(" "));
  const tokens = relevantTokens(queryText);

  return results
    .map((result) => ({ ...result, relevanceScore: scoreResult(result, tokens) }))
    .filter((result) => result.relevanceScore >= 4)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function scoreResult(result, tokens) {
  const haystack = normalize([
    result.title,
    result.snippet,
    result.host,
    result.url
  ].filter(Boolean).join(" "));

  let score = 0;
  if (haystack.includes("rastenfeld")) score += 5;
  if (haystack.includes("feuerwehr")) score += 3;
  if (haystack.includes("ff ")) score += 2;
  if (result.sourceType === "official_or_local") score += 3;
  if (result.sourceType === "social") score += 1;

  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }

  return score;
}

function relevantTokens(queryText) {
  const stop = new Set([
    "site",
    "https",
    "http",
    "www",
    "com",
    "und",
    "oder",
    "mit",
    "der",
    "die",
    "das",
    "eine",
    "einer",
    "juni",
    "mai",
    "juli"
  ]);

  return normalize(queryText)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !stop.has(token))
    .slice(0, 20);
}

async function enrichWithPages(results, timeoutMs) {
  const pageLimit = 3;
  let fetchedCount = 0;

  for (const result of results) {
    if (fetchedCount >= pageLimit) return;
    if (SOCIAL_HOSTS.some((host) => result.host.endsWith(host))) continue;

    try {
      const html = await fetchText(result.url, Math.min(timeoutMs, 8000));
      const page = extractPageSummary(html);
      if (!page.text && !page.description) continue;

      result.fetched = true;
      result.pageTitle = page.title || result.title;
      result.pageDescription = page.description;
      result.pageText = page.text.slice(0, 1200);
      fetchedCount++;
    } catch (error) {
      result.fetchError = error?.message || String(error);
    }
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FF-Rastenfeld-Redaktionsbot/1.0",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "de-AT,de;q=0.9,en;q=0.8"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/") && !contentType.includes("html") && !contentType.includes("xml")) {
      throw new Error(`Nicht-Text-Inhalt: ${contentType}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractPageSummary(html) {
  const title = firstMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    firstMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    firstMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);

  const text = stripHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
  );

  return {
    title,
    description,
    text: compactText(text).slice(0, 1600)
  };
}

function firstMeta(html, regex) {
  const match = regex.exec(html);
  return match ? stripHtml(match[1]) : "";
}

function cleanBingUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("bing.com") && url.pathname === "/ck/a") {
      const target = url.searchParams.get("u");
      if (target) return Buffer.from(target.replace(/^a1/, ""), "base64url").toString("utf8");
    }
    return url.toString();
  } catch {
    return value;
  }
}

function classifySource(host) {
  if (SOCIAL_HOSTS.some((item) => host.endsWith(item))) return "social";
  if (OFFICIAL_HINTS.some((item) => host.includes(item))) return "official_or_local";
  return "website";
}

function trustHint(host) {
  if (OFFICIAL_HINTS.some((item) => host.includes(item))) return "hoeher, lokale/offizielle Quelle moeglich";
  if (SOCIAL_HOSTS.some((item) => host.endsWith(item))) return "nur Hinweis/Social-Media-Snippet";
  return "pruefen";
}

function uniqueByUrl(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = result.url.replace(/[#?].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values) {
  return [...new Set(values)];
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function finish(folderPath, result) {
  await fs.writeFile(path.join(folderPath, "research.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ã¤/g, "ae")
    .replace(/Ã¶/g, "oe")
    .replace(/Ã¼/g, "ue")
    .replace(/ÃŸ/g, "ss");
}
