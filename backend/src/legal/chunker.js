const { normalizeForSearch } = require("./retriever");

const DEFAULT_CHUNK_SIZE = 1400;
const DEFAULT_OVERLAP = 180;

function splitText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const size = Math.max(200, Number(chunkSize) || DEFAULT_CHUNK_SIZE);
  const safeOverlap = Math.max(0, Math.min(size - 1, Number(overlap) || DEFAULT_OVERLAP));
  if (!source) return [];
  if (source.length <= size) return [source];

  const chunks = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(source.length, start + size);
    if (end < source.length) {
      const boundary = source.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(size * 0.6)) end = boundary;
    }
    chunks.push(source.slice(start, end).trim());
    if (end >= source.length) break;
    start = Math.max(0, end - safeOverlap);
  }
  return chunks.filter(Boolean);
}

function chunkEvidence(evidence, options = {}) {
  const chunks = splitText(evidence?.text, options.chunkSize, options.overlap);
  return chunks.map((text, index) => ({
    ...evidence,
    id: `${evidence.id}:chunk:${index + 1}`,
    parentId: evidence.id,
    chunkIndex: index,
    chunkCount: chunks.length,
    text,
    normalizedText: normalizeForSearch(text)
  }));
}

function chunkEvidenceCollection(records, options = {}) {
  const result = [];
  for (const record of Array.isArray(records) ? records : []) {
    result.push(...chunkEvidence(record, options));
  }
  return result;
}

module.exports = {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
  splitText,
  chunkEvidence,
  chunkEvidenceCollection
};
