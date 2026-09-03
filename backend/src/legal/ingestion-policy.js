const ALLOWED_SOURCE_HOSTS = new Set([
  "qavanin.ir",
  "www.qavanin.ir",
  "eadil.com",
  "www.eadil.com",
  "nezamat.ir",
  "www.nezamat.ir"
]);

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 2_000_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 0;

function validateSourceUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    return { valid: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:") {
    return { valid: false, reason: "https_required" };
  }

  if (!ALLOWED_SOURCE_HOSTS.has(url.hostname.toLowerCase())) {
    return { valid: false, reason: "host_not_allowlisted" };
  }

  if (url.username || url.password) {
    return { valid: false, reason: "credentials_not_allowed" };
  }

  return { valid: true, url };
}

module.exports = {
  ALLOWED_SOURCE_HOSTS,
  MAX_RESPONSE_BYTES,
  MAX_TEXT_LENGTH,
  REQUEST_TIMEOUT_MS,
  MAX_REDIRECTS,
  validateSourceUrl
};
