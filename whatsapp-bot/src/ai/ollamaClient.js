export async function generateJsonWithOllama({
  baseUrl = "http://127.0.0.1:11434",
  model = "llama3.1:8b",
  numCtx = 4096,
  prompt,
  timeoutMs = 60000
}) {
  const url = `${String(baseUrl).replace(/\/+$/, "")}/api/generate`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: {
          num_ctx: Number(numCtx) || 4096
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Ollama HTTP ${response.status}: ${await safeResponseText(response)}`
      };
    }

    const payload = await response.json();
    const text = String(payload.response || "").trim();
    const parsed = parseLooseJson(text);

    if (!parsed.ok) {
      return {
        ok: false,
        text,
        error: parsed.error || "Ollama hat kein gueltiges JSON geliefert."
      };
    }

    return { ok: true, text, data: parsed.data };
  } catch (error) {
    return { ok: false, error: formatOllamaError(error, baseUrl, timeoutMs) };
  } finally {
    clearTimeout(timeout);
  }
}

function formatOllamaError(error, baseUrl, timeoutMs) {
  if (error?.name === "AbortError") {
    return `Ollama Timeout nach ${timeoutMs} ms. Pruefe, ob Ollama laeuft und das Modell geladen werden kann.`;
  }

  const code = error?.cause?.code || error?.code || "";
  const message = error?.message || String(error);

  if (code === "ECONNREFUSED") {
    return `Ollama ist unter ${baseUrl} nicht erreichbar. Starte Ollama und pruefe OLLAMA_BASE_URL.`;
  }

  if (message.includes("fetch failed")) {
    return `Ollama-Anfrage fehlgeschlagen (${baseUrl}). Starte Ollama neu oder pruefe OLLAMA_MODEL in .env.`;
  }

  return message;
}

export function parseLooseJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { ok: false, error: "Leere Antwort." };

  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch {
    // Modelle schreiben manchmal erklaerenden Text um das JSON herum.
  }

  const objectText = extractFirstJsonObject(trimmed);
  if (!objectText) return { ok: false, error: "Kein JSON-Objekt gefunden." };

  try {
    return { ok: true, data: JSON.parse(objectText) };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];
    const prev = text[index - 1];

    if (char === "\"" && prev !== "\\") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

async function safeResponseText(response) {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "";
  }
}
