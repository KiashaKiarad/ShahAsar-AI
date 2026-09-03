const axios = require("axios");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
const https = require("https");
const {
  MAX_RESPONSE_BYTES,
  MAX_TEXT_LENGTH,
  REQUEST_TIMEOUT_MS,
  MAX_REDIRECTS,
  validateSourceUrl
} = require("./ingestion-policy");
const { normalizeEvidence, validateEvidence } = require("./evidence");

function isPrivateOrReservedIp(address) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0)
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      if (net.isIPv4(mapped)) return isPrivateOrReservedIp(mapped);
    }
    return (
      normalized === "::1" || normalized === "::" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("2001:db8:")
    );
  }

  return true;
}

async function assertSafeResolvedHost(hostname) {
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some((answer) => isPrivateOrReservedIp(answer.address))) {
    throw new Error("SOURCE_HOST_RESOLUTION_REJECTED");
  }
  return answers;
}

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
  if (!checked.valid) throw new Error(`SOURCE_URL_REJECTED:${checked.reason}`);

  const answers = await assertSafeResolvedHost(checked.url.hostname);
  const selected = answers.find((answer) => !isPrivateOrReservedIp(answer.address));
  if (!selected) throw new Error("SOURCE_HOST_RESOLUTION_REJECTED");

  const lookup = (hostname, options, callback) => {
    if (String(hostname).toLowerCase().replace(/\.$/, "") !== checked.url.hostname.toLowerCase().replace(/\.$/, "")) {
      callback(new Error("SOURCE_DNS_TARGET_CHANGED"));
      return;
    }
    callback(null, selected.address, selected.family);
  };
  const agent = new https.Agent({ keepAlive: false, maxSockets: 1, lookup });

  const response = await axios.get(checked.url.toString(), {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: Math.min(Math.max(Number(MAX_REDIRECTS) || 0, 0), 0),
    maxContentLength: MAX_RESPONSE_BYTES,
    maxBodyLength: MAX_RESPONSE_BYTES,
    responseType: "arraybuffer",
    validateStatus: (status) => status >= 200 && status < 300,
    httpsAgent: agent,
    headers: { Accept: "text/html,text/plain;q=0.9,application/xhtml+xml;q=0.8" }
  });

  if (response.headers.location) throw new Error("SOURCE_REDIRECT_NOT_FOLLOWED");
  const buffer = Buffer.from(response.data);
  if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new Error("SOURCE_RESPONSE_TOO_LARGE");

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
  ingestEvidence,
  isPrivateOrReservedIp,
  assertSafeResolvedHost
};
