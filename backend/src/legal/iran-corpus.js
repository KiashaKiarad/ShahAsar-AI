const IRAN_DOCUMENT_TYPES = Object.freeze({
  CONSTITUTION: "constitution",
  STATUTE: "statute",
  PARLIAMENTARY_INTERPRETATION: "parliamentary_interpretation",
  REGULATION: "regulation",
  EXECUTIVE_RESOLUTION: "executive_resolution",
  EXECUTIVE_CIRCULAR: "executive_circular",
  BYLAW: "bylaw",
  OFFICIAL_INSTRUCTION: "official_instruction",
  UNIFIED_SUPREME_COURT: "unified_supreme_court",
  ADMINISTRATIVE_GENERAL_BOARD: "administrative_general_board",
  ADMINISTRATIVE_SPECIALIZED_BOARD: "administrative_specialized_board",
  JUDICIAL_DECISION: "judicial_decision",
  LEGAL_ADVISORY_OPINION: "legal_advisory_opinion",
  GUARDIAN_COUNCIL_OPINION: "guardian_council_opinion",
  EXPEDIENCY_COUNCIL_DECISION: "expediency_council_decision",
  SUPREME_NATIONAL_SECURITY_COUNCIL: "supreme_national_security_council",
  SUPREME_CULTURAL_REVOLUTION_COUNCIL: "supreme_cultural_revolution_council",
  SUPREME_CYBERSPACE_COUNCIL: "supreme_cyberspace_council",
  OFFICIAL_NOTICE: "official_notice",
  HISTORICAL_VERSION: "historical_version"
});

const IRAN_SOURCE_PRIORITIES = Object.freeze({
  primary_binding: 100,
  primary_official: 90,
  official_interpretive: 80,
  judicial_authoritative: 80,
  official_guidance: 60,
  curated_secondary: 40,
  historical_reference: 20
});

const IRAN_CORPUS_PLAN = Object.freeze([
  { type: IRAN_DOCUMENT_TYPES.CONSTITUTION, priority: "primary_binding" },
  { type: IRAN_DOCUMENT_TYPES.STATUTE, priority: "primary_binding" },
  { type: IRAN_DOCUMENT_TYPES.PARLIAMENTARY_INTERPRETATION, priority: "official_interpretive" },
  { type: IRAN_DOCUMENT_TYPES.REGULATION, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.EXECUTIVE_RESOLUTION, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.EXECUTIVE_CIRCULAR, priority: "official_guidance" },
  { type: IRAN_DOCUMENT_TYPES.BYLAW, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.OFFICIAL_INSTRUCTION, priority: "official_guidance" },
  { type: IRAN_DOCUMENT_TYPES.UNIFIED_SUPREME_COURT, priority: "judicial_authoritative" },
  { type: IRAN_DOCUMENT_TYPES.ADMINISTRATIVE_GENERAL_BOARD, priority: "judicial_authoritative" },
  { type: IRAN_DOCUMENT_TYPES.ADMINISTRATIVE_SPECIALIZED_BOARD, priority: "judicial_authoritative" },
  { type: IRAN_DOCUMENT_TYPES.JUDICIAL_DECISION, priority: "judicial_authoritative" },
  { type: IRAN_DOCUMENT_TYPES.LEGAL_ADVISORY_OPINION, priority: "official_interpretive" },
  { type: IRAN_DOCUMENT_TYPES.GUARDIAN_COUNCIL_OPINION, priority: "official_interpretive" },
  { type: IRAN_DOCUMENT_TYPES.EXPEDIENCY_COUNCIL_DECISION, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.SUPREME_NATIONAL_SECURITY_COUNCIL, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.SUPREME_CULTURAL_REVOLUTION_COUNCIL, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.SUPREME_CYBERSPACE_COUNCIL, priority: "primary_official" },
  { type: IRAN_DOCUMENT_TYPES.OFFICIAL_NOTICE, priority: "official_guidance" },
  { type: IRAN_DOCUMENT_TYPES.HISTORICAL_VERSION, priority: "historical_reference" }
]);

function isKnownIranDocumentType(type) {
  return Object.values(IRAN_DOCUMENT_TYPES).includes(type);
}

function getIranCorpusPlan() {
  return IRAN_CORPUS_PLAN.map((item) => ({ ...item }));
}

module.exports = {
  IRAN_DOCUMENT_TYPES,
  IRAN_SOURCE_PRIORITIES,
  IRAN_CORPUS_PLAN,
  isKnownIranDocumentType,
  getIranCorpusPlan
};
