const axios = require("axios");
const crypto = require("crypto");
const {
  MAX_RESPONSE_BYTES,
  MAX_TEXT_LENGTH,
  REQUEST_TIMEOUT_MS,
  MAX_REDIRECTS,
  validateSourceUrl
} = require("./ingestion-policy");
const { normalizeEvidence, validateEvidence } = require("./evidence");

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfficialSource(rawUrl) {
  const checked = validateSourceUrl(rawUrl);
  if (!checked.valid) {
    throw new Error(`SOURCE_URL_REJECTED:${checked.reason}`);
  }

  const response = await axios.get(checked.url.toString(), {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    responseType: "arraybuffer",
    validateStatus: (status) => status >= 200 && status < 300,
    headers: {
      Accept: "text/html,text/plain;q=0.9,application/xhtml+xml;q=0.8"
    }
  });

  const buffer = Buffer.from(response.data);
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("SOURCE_RESPONSE_TOO_LARGE");
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const rawText = buffer.toString("utf8");
  const text = contentType.includes("html") ? htmlToText(rawText) : rawText.trim();

  if (!text) throw new Error("SOURCE_TEXT_EMPTY");
  if (text.length > MAX_TEXT_LENGTH) throw new Error("SOURCE_TEXT_TOO_LARGE");

  return {
    url: checked.url.toString(),
    contentType,
    status: response.status,
    text,
    contentHash: crypto.createHash("sha256").update(buffer).digest("hex")
  };
}

function ingestEvidence(input) {
  const evidence = normalizeEvidence(input);
  const validation = validateEvidence(evidence);
  if (!validation.valid) {
    const error = new Error("EVIDENCE_INVALID");
    error.details = validation.errors;
    throw error;
  }
  return evidence;
}

module.exports = {
  htmlToText,
  fetchOfficialSource,
  ingestEvidence
};
