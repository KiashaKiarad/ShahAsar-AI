const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { IRAN_LEGAL_SEED } = require("./iran-seed");
const { createEvidenceRepository } = require("./evidence-repository");
const { retrieveEvidence } = require("./retriever");
const { normalizeEvidence, validateEvidence } = require("./evidence");

const DEFAULT_SNAPSHOT_PATH = path.resolve(
  process.env.LEGAL_RAG_SNAPSHOT || path.join(__dirname, "../../data/legal-rag.json")
);

function cloneRecords(records) {
  return (Array.isArray(records) ? records : []).map((record) => ({ ...record }));
}

function readSnapshot(snapshotPath = DEFAULT_SNAPSHOT_PATH) {
  try {
    if (!fs.existsSync(snapshotPath)) return null;
    const raw = fs.readFileSync(snapshotPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.records)) throw new Error("RAG_SNAPSHOT_RECORDS_INVALID");
    return parsed;
  } catch (error) {
    console.error("Local RAG snapshot unavailable; using built-in fallback:", error.message);
    return null;
  }
}

function writeSnapshot(records, snapshotPath = DEFAULT_SNAPSHOT_PATH) {
  const directory = path.dirname(snapshotPath);
  fs.mkdirSync(directory, { recursive: true });

  const normalizedRecords = cloneRecords(records).map((record) => normalizeEvidence(record));
  const invalid = normalizedRecords.filter((record) => !validateEvidence(record).valid);
  if (invalid.length) throw new Error("RAG_SNAPSHOT_CONTAINS_INVALID_RECORDS");

  const payload = JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      recordCount: normalizedRecords.length,
      records: normalizedRecords
    },
    null,
    2
  );

  const tempPath = `${snapshotPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, payload, "utf8");
  fs.renameSync(tempPath, snapshotPath);

  return {
    path: snapshotPath,
    sha256: crypto.createHash("sha256").update(payload).digest("hex"),
    recordCount: normalizedRecords.length
  };
}

function createLocalRag(options = {}) {
  const snapshotPath = options.snapshotPath || DEFAULT_SNAPSHOT_PATH;
  const snapshot = readSnapshot(snapshotPath);
  const initialRecords = snapshot?.records?.length ? snapshot.records : IRAN_LEGAL_SEED;
  const repository = createEvidenceRepository(initialRecords);

  function list(filters = {}) {
    return repository.list(filters);
  }

  function search(query, options = {}) {
    const evidenceList = list({
      jurisdiction: options.jurisdiction,
      asOfDate: options.asOfDate
    });

    return retrieveEvidence(query, evidenceList, {
      jurisdiction: options.jurisdiction,
      asOfDate: options.asOfDate,
      topK: options.topK,
      minScore: options.minScore
    });
  }

  function replaceAll(records, { persist = true } = {}) {
    if (!Array.isArray(records)) throw new Error("RAG_RECORDS_MUST_BE_ARRAY");

    const normalized = records.map((record) => normalizeEvidence(record));
    const invalid = normalized.filter((record) => !validateEvidence(record).valid);
    if (invalid.length) throw new Error("RAG_REPLACE_CONTAINS_INVALID_RECORDS");

    repository.clear();
    repository.addMany(normalized);

    if (persist) writeSnapshot(normalized, snapshotPath);
    return normalized.length;
  }

  function addMany(records, { persist = true } = {}) {
    if (!Array.isArray(records) || !records.length) return repository.size();
    const normalized = records.map((record) => normalizeEvidence(record));
    const invalid = normalized.filter((record) => !validateEvidence(record).valid);
    if (invalid.length) throw new Error("RAG_ADD_CONTAINS_INVALID_RECORDS");

    repository.addMany(normalized);
    if (persist) writeSnapshot(repository.list(), snapshotPath);
    return repository.size();
  }

  function health() {
    return {
      mode: "local",
      snapshotPath,
      recordCount: repository.size()
    };
  }

  return {
    list,
    search,
    replaceAll,
    addMany,
    health
  };
}

const localRag = createLocalRag();

module.exports = {
  DEFAULT_SNAPSHOT_PATH,
  readSnapshot,
  writeSnapshot,
  createLocalRag,
  localRag
};
