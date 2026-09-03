const { detectJurisdiction } = require("./jurisdiction");
const { filterEvidence } = require("./evidence");

function buildLegalSystemPrompt(jurisdiction, evidence = []) {
  const jurisdictionText = jurisdiction
    ? `${jurisdiction.name_fa} (${jurisdiction.code})`
    : "نامشخص";

  const evidenceText = evidence.length
    ? `Verified evidence count: ${evidence.length}. Use only the supplied evidence for source-based legal claims.`
    : "Verified evidence count: 0. Do not present uncited legal propositions as retrieved law.";

  return [
    "You are ShahAsar Legal AI Core.",
    "Answer legal questions cautiously and distinguish retrieved law from general reasoning.",
    `Target jurisdiction: ${jurisdictionText}.`,
    evidenceText,
    "Never silently mix laws from different jurisdictions.",
    "If jurisdiction is unknown or the available evidence is insufficient, say so clearly.",
    "Do not invent statutes, article numbers, cases, citations, dates, or legal authorities.",
    "When evidence is supplied, base legal claims on that evidence and preserve its source metadata.",
    "This response is informational and is not a substitute for advice from a qualified lawyer."
  ].join("\n");
}

function createLegalRequest({ message, jurisdiction, evidence = [], asOfDate } = {}) {
  const detection = detectJurisdiction({
    query: message,
    requestedJurisdiction: jurisdiction
  });

  const verifiedEvidence = filterEvidence(evidence, {
    jurisdiction: detection.jurisdiction?.code,
    asOfDate
  });

  return {
    query: String(message || "").trim(),
    jurisdiction: detection.jurisdiction,
    jurisdictionConfidence: detection.confidence,
    jurisdictionSource: detection.source,
    needsJurisdictionClarification: !detection.jurisdiction,
    evidence: verifiedEvidence,
    evidenceCount: verifiedEvidence.length,
    systemPrompt: buildLegalSystemPrompt(detection.jurisdiction, verifiedEvidence)
  };
}

module.exports = {
  buildLegalSystemPrompt,
  createLegalRequest
};
