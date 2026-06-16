import fs from "node:fs/promises";
import path from "node:path";
import { parseLooseJson } from "./ollamaClient.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export async function generateJsonWithGemini({
  apiKey,
  model = "gemini-2.5-flash",
  prompt,
  folderPath,
  data,
  useGoogleSearch = true,
  sendImages = true,
  timeoutMs = 60000
}) {
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY fehlt." };
  }

  const url = `${DEFAULT_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const parts = [{ text: prompt }];
    if (sendImages) {
      parts.push(...await buildImageParts(folderPath, data));
    }

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.25,
        maxOutputTokens: 8192
      }
    };

    if (useGoogleSearch) {
      body.tools = [{ google_search: {} }];
    }

    let response = await postGemini(url, apiKey, body, controller.signal);
    let retriedWithoutSearch = false;

    if (!response.ok && useGoogleSearch) {
      const retryBody = { ...body };
      delete retryBody.tools;
      response = await postGemini(url, apiKey, retryBody, controller.signal);
      retriedWithoutSearch = true;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Gemini HTTP ${response.status}: ${await safeResponseText(response)}`
      };
    }

    const payload = await response.json();
    const candidate = payload.candidates?.[0];
    const text = extractText(candidate).trim();
    const parsed = parseLooseJson(text);

    if (!parsed.ok) {
      return {
        ok: false,
        text,
        metadata: extractGrounding(candidate),
        error: parsed.error || "Gemini hat kein gueltiges JSON geliefert."
      };
    }

    return {
      ok: true,
      text,
      data: parsed.data,
      metadata: {
        ...extractGrounding(candidate),
        retriedWithoutSearch
      }
    };
  } catch (error) {
    const reason = error?.name === "AbortError"
      ? `Gemini Timeout nach ${timeoutMs} ms.`
      : error?.message || String(error);
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timeout);
  }
}

function postGemini(url, apiKey, body, signal) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body),
    signal
  });
}

async function buildImageParts(folderPath, data) {
  const images = Array.isArray(data?.images) ? data.images : [];
  const parts = [];

  for (const image of images.slice(0, 6)) {
    if (image.publishAllowed === false) continue;

    try {
      const filePath = path.join(folderPath, image.fileName);
      const buffer = await fs.readFile(filePath);
      parts.push({
        text: `Bild fuer Analyse: ${image.fileName}. Caption: ${image.caption || "(keine)"}. Nur verwenden, wenn keine Datenschutzprobleme sichtbar sind.`
      });
      parts.push({
        inlineData: {
          mimeType: image.mimetype || mimeTypeFromName(image.fileName),
          data: buffer.toString("base64")
        }
      });
    } catch {
      // Bild ist optional; Entwurf darf daran nicht scheitern.
    }
  }

  return parts;
}

function extractText(candidate) {
  const parts = candidate?.content?.parts || [];
  return parts.map((part) => part.text || "").filter(Boolean).join("\n");
}

function extractGrounding(candidate) {
  const grounding = candidate?.groundingMetadata || {};
  const chunks = grounding.groundingChunks || [];

  return {
    webSearchQueries: grounding.webSearchQueries || [],
    sources: chunks
      .map((chunk) => chunk.web)
      .filter(Boolean)
      .map((web) => ({
        title: web.title || "",
        url: web.uri || ""
      }))
      .filter((item) => item.url || item.title),
    groundingSupports: grounding.groundingSupports || []
  };
}

function mimeTypeFromName(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function safeResponseText(response) {
  try {
    return (await response.text()).slice(0, 600);
  } catch {
    return "";
  }
}
