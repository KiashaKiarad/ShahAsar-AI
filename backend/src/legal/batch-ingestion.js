const { ingestOfficialUrl } = require("./ingestion-service");

function dedupeByContentHash(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const hash = item?.fetch?.contentHash;
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    unique.push(item);
  }

  return unique;
}

async function ingestBatch(entries = [], options = {}) {
  if (!Array.isArray(entries)) throw new TypeError("entries must be an array");

  const results = [];
  const failures = [];
  const concurrency = Math.max(1, Math.min(3, Number(options.concurrency) || 2));

  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const current = entries[cursor++];
      try {
        const result = await ingestOfficialUrl({
          url: current.url,
          metadata: current.metadata,
          chunkOptions: options.chunkOptions
        });
        results.push(result);
      } catch (error) {
        failures.push({
          id: current?.metadata?.id || null,
          url: current?.url || null,
          error: error.message
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const uniqueResults = dedupeByContentHash(results);
  const chunks = uniqueResults.flatMap((item) => item.chunks);

  return {
    requested: entries.length,
    ingested: results.length,
    uniqueDocuments: uniqueResults.length,
    duplicateDocuments: results.length - uniqueResults.length,
    failed: failures.length,
    failures,
    documents: uniqueResults,
    chunks
  };
}

module.exports = {
  dedupeByContentHash,
  ingestBatch
};
