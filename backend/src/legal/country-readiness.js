"use strict";

const fs = require("fs");
const path = require("path");
const {
  SUPPORTED_JURISDICTIONS,
  assertSupportedJurisdiction,
  isSupportedJurisdiction,
  normalizeJurisdiction
} = require("./country-policy");

const DEFAULT_PATH = path.resolve(
  process.env.LEGAL_COUNTRY_READINESS || path.join(__dirname, "../../data/legal-country-readiness.json")
);

const SUPPORTED_STATUSES = new Set(["planned", "bootstrapping", "ready", "degraded", "disabled"]);

function emptyState() {
  return {
    version: 3,
    countries: Object.fromEntries(SUPPORTED_JURISDICTIONS.map((code) => [code, {
      status: "planned",
      bootstrapComplete: false,
      coverageVerified: false,
      validatedAt: null,
      recordCount: 0,
      lastSyncAt: null,
      lastError: null
    }]))
  };
}

function readReadiness(filePath = DEFAULT_PATH) {
  try {
    if (!fs.existsSync(filePath)) return emptyState();
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.countries !== "object") return emptyState();
    const safe = emptyState();
    for (const code of SUPPORTED_JURISDICTIONS) {
      if (parsed.countries[code] && typeof parsed.countries[code] === "object") {
        safe.countries[code] = { ...safe.countries[code], ...parsed.countries[code] };
      }
    }
    return { version: 3, countries: safe.countries };
  } catch {
    return emptyState();
  }
}

function writeReadiness(state, filePath = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const safe = emptyState();
  for (const code of SUPPORTED_JURISDICTIONS) {
    if (state?.countries?.[code]) safe.countries[code] = { ...safe.countries[code], ...state.countries[code] };
  }
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(safe, null, 2), "utf8");
  fs.renameSync(temp, filePath);
}

function createCountryReadiness(options = {}) {
  const filePath = options.filePath || DEFAULT_PATH;
  const state = readReadiness(filePath);

  function ensure(jurisdiction) {
    const code = assertSupportedJurisdiction(jurisdiction);
    return state.countries[code];
  }

  function set(jurisdiction, patch = {}) {
    const code = assertSupportedJurisdiction(jurisdiction);
    const current = ensure(code);
    const next = { ...current, ...patch };
    if (!SUPPORTED_STATUSES.has(next.status)) throw new Error("COUNTRY_STATUS_INVALID");
    if (next.status === "ready" && (!next.bootstrapComplete || !next.coverageVerified || !next.validatedAt)) {
      throw new Error("COUNTRY_CANNOT_BE_READY_WITHOUT_VERIFIED_BOOTSTRAP");
    }
    state.countries[code] = next;
    writeReadiness(state, filePath);
    return { ...next };
  }

  function get(jurisdiction) {
    return { ...ensure(jurisdiction) };
  }

  function list() {
    return SUPPORTED_JURISDICTIONS.map((code) => ({ jurisdiction: code, ...state.countries[code] }));
  }

  function active() {
    return list().filter((item) => item.status === "ready");
  }

  function isActive(jurisdiction) {
    const code = normalizeJurisdiction(jurisdiction);
    return isSupportedJurisdiction(code) && get(code).status === "ready";
  }

  return { get, set, list, active, isActive };
}

const countryReadiness = createCountryReadiness();

module.exports = {
  DEFAULT_PATH,
  readReadiness,
  writeReadiness,
  createCountryReadiness,
  countryReadiness
};
