const { detectJurisdiction } = require("./jurisdiction");
const { localRag } = require("./local-rag");
const { retrieveEvidence } = require("./retriever");
const { filterEvidence } = require("./evidence");
const { resolveLanguagePlan } = require("./language-policy");
const { isSupportedJurisdiction } = require("./country-policy");

function buildLegalSystemPrompt(jurisdiction, evidence = [], languagePlan = {}) {
  const jurisdictionText = jurisdiction ? `${jurisdiction.name_fa} (${jurisdiction.code})` : "نامشخص";
  const legalLanguage = languagePlan.legalLanguage || "en";
  const responseLanguage = languagePlan.responseLanguage || "en";
  const draftingLanguage = languagePlan.draftingLanguage || legalLanguage;
  const evidenceText = evidence.length
    ? `Verified local evidence count: ${evidence.length}. Use the supplied local ShahAsar RAG evidence as the primary source for jurisdiction-specific legal claims.`
    : "Verified local evidence count: 0. Do not present uncited legal propositions as retrieved law; clearly distinguish model knowledge, reasoning, and missing evidence.";
  const citations = evidence.length
    ? evidence.map((item, index) => `${index + 1}. ${item.citation || item.title} | ${item.sourceUrl || "source-url-unavailable"}`).join("\n")
    : "None";
  return [
    "You are ShahAsar Legal AI Core.",
    "Use model reasoning together with supplied local ShahAsar RAG evidence.",
    `Target jurisdiction: ${jurisdictionText}.`,
    `Legal/source language: ${legalLanguage}.`,
    `User-facing response language: ${responseLanguage}.`,
    `Formal legal drafting language: ${draftingLanguage}.`,
    evidenceText,
    "For jurisdiction-specific legal propositions, verified local evidence has priority over model memory.",
    "Never silently turn unsupported model memory into a citation or claim it was retrieved.",
    `Evidence citations:\n${citations}`,
    "Legal retrieval is local-server only. Never browse or request an external legal source during a user query.",
    "Never silently mix laws from different jurisdictions.",
    "If jurisdiction is unknown, unsupported, not ready, or evidence is insufficient, say so clearly.",
    "Do not invent statutes, article numbers, cases, citations, dates, or legal authorities.",
    "If the user requests a formal pleading, draft it in the target jurisdiction's legal language while explaining it in the requested response language.",
    "This response is informational and is not a substitute for advice from a qualified lawyer."
  ].join("\n");
}

function getDefaultKnowledgeBase(jurisdictionCode) {
  return localRag.list({ jurisdiction: jurisdictionCode ? String(jurisdictionCode).toUpperCase() : undefined });
}

function createLegalRequest({ message, jurisdiction, evidence, asOfDate, topK = 5, originCountry, inputLanguage, responseLanguage } = {}) {
  const detection = detectJurisdiction({ query: message, requestedJurisdiction: jurisdiction });
  const resolvedJurisdiction = detection.jurisdiction?.code;
  const languagePlan = resolveLanguagePlan({ originCountry, inputLanguage, responseLanguage, jurisdiction: resolvedJurisdiction });
  let retrieved;
  if (Array.isArray(evidence)) {
    const verifiedEvidence = filterEvidence(evidence, { jurisdiction: resolvedJurisdiction, asOfDate });
    retrieved = retrieveEvidence(message, verifiedEvidence, { jurisdiction: resolvedJurisdiction, asOfDate, topK, minScore: 0 });
  } else {
    retrieved = localRag.search(message, { jurisdiction: resolvedJurisdiction, asOfDate, topK, minScore: 0 });
  }
  const retrievedEvidence = retrieved.map((item) => item.evidence);
  return {
    query: String(message || "").trim(),
    jurisdiction: detection.jurisdiction,
    jurisdictionConfidence: detection.confidence,
    jurisdictionSource: detection.source,
    needsJurisdictionClarification: !detection.jurisdiction,
    legalJurisdictionSupported: Boolean(resolvedJurisdiction && isSupportedJurisdiction(resolvedJurisdiction)),
    evidence: retrievedEvidence,
    evidenceCount: retrievedEvidence.length,
    knowledgeBase: "local-server",
    languagePlan,
    retrieval: retrieved.map((item) => ({ evidenceId: item.evidence.id, score: item.score, citation: item.evidence.citation, article: item.evidence.article, parentId: item.evidence.parentId || null, chunkIndex: Number.isInteger(item.evidence.chunkIndex) ? item.evidence.chunkIndex : null })),
    systemPrompt: buildLegalSystemPrompt(detection.jurisdiction, retrievedEvidence, languagePlan)
  };
}

module.exports = { buildLegalSystemPrompt, createLegalRequest, getDefaultKnowledgeBase };
