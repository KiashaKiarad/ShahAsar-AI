const { ingestIranDocument } = require("./iran-adapters");
const { localRag } = require("./local-rag");

function mergeById(existing, incoming) {
  const map = new Map();
  for (const record of Array.isArray(existing) ? existing : []) map.set(record.id, record);
  for (const record of Array.isArray(incoming) ? incoming : []) map.set(record.id, record);
  return [...map.values()];
}

async function syncIranDocuments(documents = [], options = {}) {
  const results = [];
  const failures = [];
  const incoming = [];

  for (const document of Array.isArray(documents) ? documents : []) {
    try {
      const result = await ingestIranDocument(document);
      incoming.push(result.evidence);
      results.push({
        sourceId: result.sourceId,
        documentId: result.evidence.id,
        contentHash: result.fetched.contentHash,
        status: "updated"
      });
    } catch (error) {
      failures.push({
        sourceId: document?.sourceId || null,
        url: document?.url || null,
        error: error.message
      });
    }
  }

  const existing = localRag.list({});
  const merged = mergeById(existing, incoming);

  if (incoming.length) {
    localRag.replaceAll(merged, { persist: options.persist !== false });
  }

  return {
    attempted: Array.isArray(documents) ? documents.length : 0,
    updated: incoming.length,
    failed: failures.length,
    failures,
    corpusRecordCount: localRag.health().recordCount,
    results,
    degraded: failures.length > 0
  };
}

module.exports = {
  mergeById,
  syncIranDocuments
};
