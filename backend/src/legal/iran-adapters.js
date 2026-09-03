const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");
const { IRAN_LEGAL_SOURCES } = require("./iran-sources");
const { fetchOfficialSource, ingestEvidence } = require("./ingestor");

const ADAPTERS = Object.freeze({
  "ir-qavanin": {
    sourceId: "ir-qavanin",
    baseUrl: "https://qavanin.ir/",
    supportedTypes: [
      IRAN_SOURCE_TYPES.CONSTITUTION.code,
      IRAN_SOURCE_TYPES.STATUTE.code,
      IRAN_SOURCE_TYPES.PARLIAMENTARY_INTERPRETATION.code,
      IRAN_SOURCE_TYPES.REGULATION.code,
      IRAN_SOURCE_TYPES.EXECUTIVE_RESOLUTION.code,
      IRAN_SOURCE_TYPES.EXECUTIVE_CIRCULAR.code,
      IRAN_SOURCE_TYPES.BYLAW.code,
      IRAN_SOURCE_TYPES.OFFICIAL_INSTRUCTION.code,
      IRAN_SOURCE_TYPES.EXPEDIENCY_COUNCIL_DECISION.code,
      IRAN_SOURCE_TYPES.SUPREME_NATIONAL_SECURITY_COUNCIL.code,
      IRAN_SOURCE_TYPES.SUPREME_CULTURAL_REVOLUTION_COUNCIL.code,
      IRAN_SOURCE_TYPES.SUPREME_CYBERSPACE_COUNCIL.code,
      IRAN_SOURCE_TYPES.OFFICIAL_NOTICE.code,
      IRAN_SOURCE_TYPES.HISTORICAL_VERSION.code
    ],
    buildEvidence: ({ url, metadata, text }) => ingestEvidence({
      ...metadata,
      jurisdiction: "IR",
      sourceUrl: url,
      text
    })
  },
  "ir-judiciary": {
    sourceId: "ir-judiciary",
    baseUrl: "https://eadil.com/",
    supportedTypes: [
      IRAN_SOURCE_TYPES.EXECUTIVE_CIRCULAR.code,
      IRAN_SOURCE_TYPES.OFFICIAL_INSTRUCTION.code,
      IRAN_SOURCE_TYPES.UNIFIED_SUPREME_COURT.code,
      IRAN_SOURCE_TYPES.ADMINISTRATIVE_GENERAL_BOARD.code,
      IRAN_SOURCE_TYPES.ADMINISTRATIVE_SPECIALIZED_BOARD.code,
      IRAN_SOURCE_TYPES.JUDICIAL_DECISION.code,
      IRAN_SOURCE_TYPES.LEGAL_ADVISORY_OPINION.code,
      IRAN_SOURCE_TYPES.GUARDIAN_COUNCIL_OPINION.code,
      IRAN_SOURCE_TYPES.OFFICIAL_NOTICE.code
    ],
    buildEvidence: ({ url, metadata, text }) => ingestEvidence({
      ...metadata,
      jurisdiction: "IR",
      sourceUrl: url,
      text
    })
  },
  "ir-nezamat": {
    sourceId: "ir-nezamat",
    baseUrl: "https://nezamat.ir/",
    supportedTypes: Object.values(IRAN_SOURCE_TYPES).map((item) => item.code),
    buildEvidence: ({ url, metadata, text }) => ingestEvidence({
      ...metadata,
      jurisdiction: "IR",
      sourceUrl: url,
      text
    })
  }
});

function getIranAdapters() {
  return Object.values(ADAPTERS).map(({ buildEvidence, ...adapter }) => ({
    ...adapter,
    supportedTypes: [...adapter.supportedTypes]
  }));
}

function getAdapter(sourceId) {
  return ADAPTERS[sourceId] || null;
}

async function ingestIranDocument({ sourceId, url, metadata = {} }) {
  const adapter = getAdapter(sourceId);
  if (!adapter) throw new Error("IRAN_SOURCE_ADAPTER_NOT_FOUND");
  const fetched = await fetchOfficialSource(url);

  const sourceUrl = fetched.url;
  if (!sourceUrl.startsWith(adapter.baseUrl)) {
    throw new Error("IRAN_SOURCE_URL_OUTSIDE_ADAPTER_SCOPE");
  }

  const evidence = adapter.buildEvidence({
    url: sourceUrl,
    metadata,
    text: fetched.text
  });

  return {
    sourceId,
    evidence,
    fetched: {
      contentType: fetched.contentType,
      status: fetched.status,
      contentHash: fetched.contentHash
    }
  };
}

function validateAdapterCoverage() {
  const registered = new Set(Object.keys(ADAPTERS));
  const missing = IRAN_LEGAL_SOURCES
    .filter((source) => source.enabled)
    .map((source) => source.id)
    .filter((id) => !registered.has(id));

  return { valid: missing.length === 0, missing };
}

module.exports = {
  ADAPTERS,
  getIranAdapters,
  getAdapter,
  ingestIranDocument,
  validateAdapterCoverage
};
