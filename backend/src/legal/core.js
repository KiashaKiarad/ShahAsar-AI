const { detectJurisdiction } = require("./jurisdiction");
const { localRag } = require("./local-rag");
const { retrieveEvidence } = require("./retriever");
const { filterEvidence } = require("./evidence");

function buildLegalSystemPrompt(jurisdiction, evidence = []) {
  const jurisdictionText = jurisdiction
    ? `${jurisdiction.name_fa} (${jurisdiction.code})`
    : "نامشخص";

  const evidenceText = evidence.length
    ? `Verified evidence count: ${evidence.length}. Use only the supplied local evidence for source-based legal claims.`
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
    "Legal retrieval is local-server only. Never browse or request an external legal source during a user query.",
    "Never silently mix laws from different jurisdictions.",
    "If jurisdiction is unknown or the available evidence is insufficient, say so clearly.",
    "Do not invent statutes, article numbers, cases, citations, dates, or legal authorities.",
    "When evidence is supplied, base legal claims on that evidence and preserve its source metadata.",
    "This response is informational and is not a substitute for advice from a qualified lawyer."
  ].join("\n");
}

function getDefaultKnowledgeBase(jurisdictionCode) {
  return localRag.list({
    jurisdiction: jurisdictionCode ? String(jurisdictionCode).toUpperCase() : undefined
  });
}

function createLegalRequest({ message, jurisdiction, evidence, asOfDate, topK = 5 } = {}) {
  const detection = detectJurisdiction({
    query: message,
    requestedJurisdiction: jurisdiction
  });

  let retrieved;
  if (Array.isArray(evidence)) {
    const verifiedEvidence = filterEvidence(evidence, {
      jurisdiction: detection.jurisdiction?.code,
      asOfDate
    });
    retrieved = retrieveEvidence(message, verifiedEvidence, {
      jurisdiction: detection.jurisdiction?.code,
      asOfDate,
      topK,
      minScore: 0
    });
  } else {
    retrieved = localRag.search(message, {
      jurisdiction: detection.jurisdiction?.code,
      asOfDate,
      topK,
      minScore: 0
    });
  }

  const retrievedEvidence = retrieved.map((item) => item.evidence);

  return {
    query: String(message || "").trim(),
    jurisdiction: detection.jurisdiction,
    jurisdictionConfidence: detection.confidence,
    jurisdictionSource: detection.source,
    needsJurisdictionClarification: !detection.jurisdiction,
    evidence: retrievedEvidence,
    evidenceCount: retrievedEvidence.length,
    knowledgeBase: "local-server",
    retrieval: retrieved.map((item) => ({
      evidenceId: item.evidence.id,
      score: item.score,
      citation: item.evidence.citation,
      article: item.evidence.article,
      parentId: item.evidence.parentId || null,
      chunkIndex: Number.isInteger(item.evidence.chunkIndex) ? item.evidence.chunkIndex : null
    })),
    systemPrompt: buildLegalSystemPrompt(detection.jurisdiction, retrievedEvidence)
  };
}

module.exports = {
  buildLegalSystemPrompt,
  createLegalRequest,
  getDefaultKnowledgeBase
};
