const { detectJurisdiction } = require("./jurisdiction");
const { filterEvidence } = require("./evidence");
const { retrieveEvidence } = require("./retriever");
const { IRAN_LEGAL_SEED } = require("./iran-seed");

function buildLegalSystemPrompt(jurisdiction, evidence = []) {
  const jurisdictionText = jurisdiction
    ? `${jurisdiction.name_fa} (${jurisdiction.code})`
    : "نامشخص";

  const evidenceText = evidence.length
    ? `Verified evidence count: ${evidence.length}. Use only the supplied evidence for source-based legal claims.`
    : "Verified evidence count: 0. Do not present uncited legal propositions as retrieved law.";

  const citations = evidence.length
    ? evidence
        .map((item, index) => `${index + 1}. ${item.citation || item.title} | ${item.sourceUrl || "source-url-unavailable"}`)
        .join("\n")
    : "None";

  return [
    "You are ShahAsar Legal AI Core.",
    "Answer legal questions cautiously and distinguish retrieved law from general reasoning.",
    `Target jurisdiction: ${jurisdictionText}.`,
    evidenceText,
    `Evidence citations:\n${citations}`,
    "Never silently mix laws from different jurisdictions.",
    "If jurisdiction is unknown or the available evidence is insufficient, say so clearly.",
    "Do not invent statutes, article numbers, cases, citations, dates, or legal authorities.",
    "When evidence is supplied, base legal claims on that evidence and preserve its source metadata.",
    "This response is informational and is not a substitute for advice from a qualified lawyer."
  ].join("\n");
}

function getDefaultKnowledgeBase(jurisdictionCode) {
  if (String(jurisdictionCode || "").toUpperCase() === "IR") return IRAN_LEGAL_SEED;
  return [];
}

function createLegalRequest({ message, jurisdiction, evidence, asOfDate, topK = 5 } = {}) {
  const detection = detectJurisdiction({
    query: message,
    requestedJurisdiction: jurisdiction
  });

  const suppliedEvidence = Array.isArray(evidence) ? evidence : getDefaultKnowledgeBase(detection.jurisdiction?.code);
  const verifiedEvidence = filterEvidence(suppliedEvidence, {
    jurisdiction: detection.jurisdiction?.code,
    asOfDate
  });
  const retrieved = retrieveEvidence(message, verifiedEvidence, {
    jurisdiction: detection.jurisdiction?.code,
    asOfDate,
    topK,
    minScore: 0
  });
  const retrievedEvidence = retrieved.map((item) => item.evidence);

  return {
    query: String(message || "").trim(),
    jurisdiction: detection.jurisdiction,
    jurisdictionConfidence: detection.confidence,
    jurisdictionSource: detection.source,
    needsJurisdictionClarification: !detection.jurisdiction,
    evidence: retrievedEvidence,
    evidenceCount: retrievedEvidence.length,
    retrieval: retrieved.map((item) => ({
      evidenceId: item.evidence.id,
      score: item.score,
      citation: item.evidence.citation,
      article: item.evidence.article
    })),
    systemPrompt: buildLegalSystemPrompt(detection.jurisdiction, retrievedEvidence)
  };
}

module.exports = {
  buildLegalSystemPrompt,
  createLegalRequest,
  getDefaultKnowledgeBase
};
