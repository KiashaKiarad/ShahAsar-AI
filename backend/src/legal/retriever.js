const { normalizeEvidence, validateEvidence, isEvidenceTemporallyValid } = require("./evidence");

function normalizeForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeForSearch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function buildDocumentText(evidence) {
  return [
    evidence.title,
    evidence.citation,
    evidence.article,
    evidence.paragraph,
    evidence.text
  ].filter(Boolean).join(" ");
}

function scoreEvidence(query, evidence) {
  const queryTokens = new Set(tokenize(query));
  if (!queryTokens.size) return 0;

  const documentTokens = tokenize(buildDocumentText(evidence));
  const frequencies = new Map();

  for (const token of documentTokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  let score = 0;
  for (const token of queryTokens) {
    if (frequencies.has(token)) {
      score += 1 + Math.min(2, frequencies.get(token) / 5);
    }
  }

  const exactPhrase = normalizeForSearch(query);
  if (exactPhrase && normalizeForSearch(buildDocumentText(evidence)).includes(exactPhrase)) {
    score += 3;
  }

  if (evidence.article && exactPhrase.includes(normalizeForSearch(evidence.article))) {
    score += 2;
  }

  return score;
}

function retrieveEvidence(query, evidenceList, options = {}) {
  const {
    jurisdiction,
    asOfDate,
    topK = 5,
    minScore = 0
  } = options;

  const safeTopK = Math.max(1, Math.min(20, Number(topK) || 5));
  const safeMinScore = Math.max(0, Number(minScore) || 0);

  return (Array.isArray(evidenceList) ? evidenceList : [])
    .map((item) => normalizeEvidence(item))
    .filter((item) => validateEvidence(item).valid)
    .filter((item) => !jurisdiction || item.jurisdiction === String(jurisdiction).toUpperCase())
    .filter((item) => isEvidenceTemporallyValid(item, asOfDate))
    .map((item) => ({
      evidence: item,
      score: scoreEvidence(query, item)
    }))
    .filter((item) => item.score > safeMinScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeTopK);
}

module.exports = {
  normalizeForSearch,
  tokenize,
  scoreEvidence,
  retrieveEvidence
};
