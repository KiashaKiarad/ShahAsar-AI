const { detectJurisdiction } = require("./jurisdiction");

function buildLegalSystemPrompt(jurisdiction) {
  const jurisdictionText = jurisdiction
    ? `${jurisdiction.name_fa} (${jurisdiction.code})`
    : "نامشخص";

  return [
    "You are ShahAsar Legal AI Core.",
    "Answer legal questions cautiously and distinguish retrieved law from general reasoning.",
    `Target jurisdiction: ${jurisdictionText}.`,
    "Never silently mix laws from different jurisdictions.",
    "If jurisdiction is unknown or the available evidence is insufficient, say so clearly.",
    "Do not invent statutes, article numbers, cases, citations, dates, or legal authorities.",
    "When evidence is supplied, base legal claims on that evidence and preserve its source metadata.",
    "This response is informational and is not a substitute for advice from a qualified lawyer."
  ].join("\n");
}

function createLegalRequest({ message, jurisdiction } = {}) {
  const detection = detectJurisdiction({
    query: message,
    requestedJurisdiction: jurisdiction
  });

  return {
    query: String(message || "").trim(),
    jurisdiction: detection.jurisdiction,
    jurisdictionConfidence: detection.confidence,
    jurisdictionSource: detection.source,
    needsJurisdictionClarification: !detection.jurisdiction,
    systemPrompt: buildLegalSystemPrompt(detection.jurisdiction),
    evidence: []
  };
}

module.exports = {
  buildLegalSystemPrompt,
  createLegalRequest
};
