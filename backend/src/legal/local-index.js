const { normalizeForSearch, tokenize } = require("./retriever");
const { isEvidenceTemporallyValid } = require("./evidence");

const FIELD_WEIGHTS = Object.freeze({
  title: 3,
  citation: 4,
  article: 5,
  paragraph: 3,
  authority: 1,
  text: 1
});

function weightedTokens(evidence) {
  const tokens = [];
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const value = evidence?.[field];
    if (!value) continue;
    const fieldTokens = tokenize(value);
    for (const token of fieldTokens) {
      for (let i = 0; i < weight; i += 1) tokens.push(token);
    }
  }
  return tokens;
}

function buildBm25Index(records = []) {
  const docs = [];
  const documentFrequency = new Map();
  let totalLength = 0;

  for (const record of Array.isArray(records) ? records : []) {
    const tokens = weightedTokens(record);
    const termFrequency = new Map();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    totalLength += tokens.length;
    docs.push({ record, termFrequency, length: tokens.length });
  }

  const averageLength = docs.length ? totalLength / docs.length : 0;
  return { docs, documentFrequency, averageLength, documentCount: docs.length };
}

function bm25Score(query, doc, index, options = {}) {
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length || !doc?.length) return 0;

  const k1 = Number(options.k1) > 0 ? Number(options.k1) : 1.2;
  const b = Number.isFinite(Number(options.b)) ? Math.max(0, Math.min(1, Number(options.b))) : 0.75;
  const avgdl = index.averageLength || 1;
  let score = 0;

  for (const term of queryTokens) {
    const tf = doc.termFrequency.get(term) || 0;
    if (!tf) continue;
    const df = index.documentFrequency.get(term) || 0;
    const idf = Math.log(1 + (index.documentCount - df + 0.5) / (df + 0.5));
    const denominator = tf + k1 * (1 - b + b * (doc.length / avgdl));
    score += idf * ((tf * (k1 + 1)) / denominator);
  }

  const phrase = normalizeForSearch(query);
  const documentText = normalizeForSearch([
    doc.record?.title,
    doc.record?.citation,
    doc.record?.article,
    doc.record?.paragraph,
    doc.record?.text
  ].filter(Boolean).join(" "));

  if (phrase && documentText.includes(phrase)) score += 2.5;
  return score;
}

function createLocalIndex(records = []) {
  let index = buildBm25Index(records);

  function rebuild(nextRecords = []) {
    index = buildBm25Index(nextRecords);
    return index.documentCount;
  }

  function search(query, filters = {}) {
    const jurisdiction = typeof filters.jurisdiction === "string"
      ? filters.jurisdiction.trim().toUpperCase()
      : "";
    const asOfDate = filters.asOfDate;
    const topK = Math.max(1, Math.min(50, Number(filters.topK) || 5));
    const minScore = Math.max(0, Number(filters.minScore) || 0);

    return index.docs
      .filter(({ record }) => !jurisdiction || record.jurisdiction === jurisdiction)
      .filter(({ record }) => isEvidenceTemporallyValid(record, asOfDate))
      .map((doc) => ({ evidence: doc.record, score: bm25Score(query, doc, index, filters) }))
      .filter((item) => item.score > minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  return {
    rebuild,
    search,
    stats: () => ({ documents: index.documentCount, averageLength: index.averageLength })
  };
}

module.exports = {
  FIELD_WEIGHTS,
  weightedTokens,
  buildBm25Index,
  bm25Score,
  createLocalIndex
};
