"use strict";

// Security boundary: Shah Asar intentionally supports ONLY these jurisdictions.
// This is a code-level allowlist, not user/admin configuration.
const SUPPORTED_JURISDICTIONS = Object.freeze([
  "IR", "DE", "US", "AE", "SA", "KW", "OM", "TR", "IT"
]);

const SUPPORTED_SET = new Set(SUPPORTED_JURISDICTIONS);
Object.freeze(SUPPORTED_JURISDICTIONS);

function normalizeJurisdiction(value) {
  return String(value || "").trim().toUpperCase();
}

function isSupportedJurisdiction(value) {
  return SUPPORTED_SET.has(normalizeJurisdiction(value));
}

function assertSupportedJurisdiction(value) {
  const code = normalizeJurisdiction(value);
  if (!SUPPORTED_SET.has(code)) {
    const error = new Error("COUNTRY_NOT_SUPPORTED");
    error.code = "COUNTRY_NOT_SUPPORTED";
    throw error;
  }
  return code;
}

function filterSupportedJurisdictions(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeJurisdiction))]
    .filter((code) => SUPPORTED_SET.has(code));
}

module.exports = {
  SUPPORTED_JURISDICTIONS,
  normalizeJurisdiction,
  isSupportedJurisdiction,
  assertSupportedJurisdiction,
  filterSupportedJurisdictions
};
