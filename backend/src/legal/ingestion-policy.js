"use strict";

const { URL } = require("url");
const { SUPPORTED_JURISDICTIONS, isSupportedJurisdiction } = require("./country-policy");

const REQUEST_TIMEOUT_MS = Number(process.env.LEGAL_INGEST_TIMEOUT_MS || 8000);
const MAX_REDIRECTS = Number(process.env.LEGAL_INGEST_MAX_REDIRECTS || 3);
const MAX_RESPONSE_BYTES = Number(process.env.LEGAL_INGEST_MAX_RESPONSE_BYTES || 8 * 1024 * 1024);
const MAX_TEXT_LENGTH = Number(process.env.LEGAL_INGEST_MAX_TEXT_LENGTH || 2 * 1024 * 1024);

// Network allowlist. A source must be both an approved jurisdiction AND an approved host.
const ALLOWED_HOSTS = Object.freeze([
  "qavanin.ir", "www.qavanin.ir", "eadil.com", "www.eadil.com", "nezamat.ir", "www.nezamat.ir",
  "gesetze-im-internet.de", "www.gesetze-im-internet.de",
  "congress.gov", "www.congress.gov", "govinfo.gov", "www.govinfo.gov",
  "uaelegislation.gov.ae", "www.uaelegislation.gov.ae",
  "laws.boe.gov.sa", "www.laws.boe.gov.sa", "uqn.gov.sa", "www.uqn.gov.sa",
  "moj.gov.kw", "www.moj.gov.kw",
  "mjla.gov.om", "www.mjla.gov.om", "omanportal.gov.om", "www.omanportal.gov.om",
  "resmigazete.gov.tr", "www.resmigazete.gov.tr", "mevzuat.gov.tr", "www.mevzuat.gov.tr",
  "normattiva.it", "www.normattiva.it", "gazzettaufficiale.it", "www.gazzettaufficiale.it"
]);

function isAllowedHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.includes(host);
}

function validateSourceUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    return { valid: false, reason: "INVALID_URL" };
  }

  if (url.protocol !== "https:") return { valid: false, reason: "HTTPS_REQUIRED" };
  if (!isAllowedHost(url.hostname)) return { valid: false, reason: "HOST_NOT_ALLOWLISTED" };
  if (url.username || url.password) return { valid: false, reason: "CREDENTIALS_IN_URL_REJECTED" };
  return { valid: true, url };
}

function validateCountryCode(code) {
  return isSupportedJurisdiction(code) ? String(code).trim().toUpperCase() : null;
}

module.exports = {
  REQUEST_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  MAX_TEXT_LENGTH,
  ALLOWED_HOSTS,
  SUPPORTED_JURISDICTIONS,
  isAllowedHost,
  validateSourceUrl,
  validateCountryCode
};
