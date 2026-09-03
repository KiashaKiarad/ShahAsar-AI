const crypto = require("crypto");

const DEFAULT_CHUNK_SIZE = 1800;
const DEFAULT_OVERLAP = 250;

function splitIntoChunks(text, options = {}) {
  const chunkSize = Math.max(200, Math.min(8000, Number(options.chunkSize) || DEFAULT_CHUNK_SIZE));
  const overlap = Math.max(0, Math.min(Math.floor(chunkSize / 2), Number(options.overlap) || DEFAULT_OVERLAP));
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const sentenceBoundary = Math.max(
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf("؟ ", end),
        normalized.lastIndexOf("؛ ", end)
      );
      if (sentenceBoundary > start + Math.floor(chunkSize * 0.6)) {
        end = sentenceBoundary + 1;
      }
    }

    const chunkText = normalized.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        index,
        text: chunkText,
        hash: crypto.createHash("sha256").update(chunkText, "utf8").digest("hex"),
        start,
        end
      });
      index += 1;
    }

    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

function attachChunks(evidence, options = {}) {
  const chunks = splitIntoChunks(evidence?.text, options);
  return chunks.map((chunk) => ({
    ...chunk,
    evidenceId: evidence.id,
    jurisdiction: evidence.jurisdiction,
    sourceType: evidence.sourceType,
    title: evidence.title,
    citation: evidence.citation,
    article: evidence.article,
    sourceUrl: evidence.sourceUrl
  }));
}

module.exports = {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
  splitIntoChunks,
  attachChunks
};
