const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.resolve(
  process.env.LEGAL_COUNTRY_READINESS || path.join(__dirname, "../../data/legal-country-readiness.json")
);

const SUPPORTED_STATUSES = new Set(["planned", "bootstrapping", "ready", "degraded", "disabled"]);

function readReadiness(filePath = DEFAULT_PATH) {
  try {
    if (!fs.existsSync(filePath)) return { version: 1, countries: {} };
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.countries !== "object") {
      return { version: 1, countries: {} };
    }
    return parsed;
  } catch {
    return { version: 1, countries: {} };
  }
}

function writeReadiness(state, filePath = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(temp, filePath);
}

function createCountryReadiness(options = {}) {
  const filePath = options.filePath || DEFAULT_PATH;
  const state = readReadiness(filePath);

  function ensure(jurisdiction) {
    const code = String(jurisdiction || "").trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code)) throw new Error("COUNTRY_CODE_INVALID");
    if (!state.countries[code]) {
      state.countries[code] = {
        status: "planned",
        bootstrapComplete: false,
        coverageVerified: false,
        validatedAt: null,
        recordCount: 0,
        lastSyncAt: null,
        lastError: null
      };
    }
    return state.countries[code];
  }

  function set(jurisdiction, patch = {}) {
    const code = String(jurisdiction || "").trim().toUpperCase();
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
    return Object.entries(state.countries).map(([jurisdiction, value]) => ({ jurisdiction, ...value }));
  }

  function active() {
    return list().filter((item) => item.status === "ready");
  }

  function isActive(jurisdiction) {
    return get(jurisdiction).status === "ready";
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
