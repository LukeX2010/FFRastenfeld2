export function redactForExternalAi(value, enabled = true) {
  const text = String(value || "");
  if (!enabled) {
    return {
      text,
      report: {
        enabled: false,
        replacements: []
      }
    };
  }

  const replacements = [];
  let redacted = text;

  redacted = replacePattern(redacted, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[E-MAIL MASKIERT]", "email", replacements);
  redacted = replacePattern(redacted, /(?<!\d)(?:\+43|0043|0)\s?(?:\d[\s/-]?){6,13}\d(?!\d)/g, "[TELEFON MASKIERT]", "telefon", replacements);
  redacted = replacePattern(redacted, /\b[A-Z]{1,2}[-\s]?\d{1,5}[A-Z]{0,2}\b/g, "[KENNZEICHEN/ID GEPRUEFT]", "moegliches_kennzeichen", replacements);
  redacted = replacePattern(redacted, /\b(?:geb\.?|geboren am|svnr|sozialversicherungsnummer|adresse|wohnhaft)\s*[:\-\s]+[^\n,;]+/gi, "[PRIVATE ANGABE MASKIERT]", "private_angabe", replacements);

  return {
    text: redacted,
    report: {
      enabled: true,
      replacements
    }
  };
}

export function redactObjectForExternalAi(value, enabled = true) {
  const report = {
    enabled: Boolean(enabled),
    replacements: []
  };

  if (!enabled) {
    return { value, report };
  }

  const redacted = visit(value, report);
  return { value: redacted, report };
}

function visit(value, report) {
  if (typeof value === "string") {
    const redacted = redactForExternalAi(value, true);
    report.replacements.push(...redacted.report.replacements);
    return redacted.text;
  }

  if (Array.isArray(value)) return value.map((item) => visit(item, report));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, visit(item, report)])
    );
  }

  return value;
}

function replacePattern(text, pattern, replacement, type, replacements) {
  return text.replace(pattern, (match) => {
    replacements.push({
      type,
      length: match.length
    });
    return replacement;
  });
}
