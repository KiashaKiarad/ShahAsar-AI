const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { IRAN_LEGAL_SEED } = require("./iran-seed");
const { createEvidenceRepository } = require("./evidence-repository");
const { createLocalIndex } = require("./local-index");
const { normalizeEvidence, validateEvidence } = require("./evidence");

const DEFAULT_SNAPSHOT_PATH = path.resolve(
  process.env.LEGAL_RAG_SNAPSHOT || path.join(__dirname, "../../data/legal-rag.json")
);

const DEFAULT_BACKUP_PATH = path.resolve(
  process.env.LEGAL_RAG_BACKUP || `${DEFAULT_SNAPSHOT_PATH}.last-good.json`
);

function cloneRecords(records) {
  return (Array.isArray(records) ? records : []).map((record) => ({ ...record }));
}

function validateRecords(records) {
  const normalized = cloneRecords(records).map((record) => normalizeEvidence(record));
  const invalid = normalized.filter((record) => !validateEvidence(record).valid);
  if (invalid.length) throw new Error("RAG_SNAPSHOT_CONTAINS_INVALID_RECORDS");
  return normalized;
}

function parseSnapshotFile(snapshotPath) {
  const raw = fs.readFileSync(snapshotPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.records)) throw new Error("RAG_SNAPSHOT_RECORDS_INVALID");
  return parsed;
}

function readSnapshot(snapshotPath = DEFAULT_SNAPSHOT_PATH, backupPath = DEFAULT_BACKUP_PATH) {
  try {
    if (fs.existsSync(snapshotPath)) {
      return parseSnapshotFile(snapshotPath);
    }
  } catch (error) {
    console.error("Primary Local RAG snapshot invalid; trying last-good backup:", error.message);
  }

  try {
    if (fs.existsSync(backupPath)) {
      return parseSnapshotFile(backupPath);
    }
  } catch (error) {
    console.error("Last-good Local RAG snapshot invalid:", error.message);
  }

  return null;
}

function writeSnapshot(records, snapshotPath = DEFAULT_SNAPSHOT_PATH, backupPath = DEFAULT_BACKUP_PATH) {
  const directory = path.dirname(snapshotPath);
  fs.mkdirSync(directory, { recursive: true });

  const normalizedRecords = validateRecords(records);
  const payload = JSON.stringify(
    {
      version: 2,
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

  const backupDirectory = path.dirname(backupPath);
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupTemp = `${backupPath}.${process.pid}.tmp`;
  fs.writeFileSync(backupTemp, payload, "utf8");
  fs.renameSync(backupTemp, backupPath);

  return {
    path: snapshotPath,
    backupPath,
    sha256: crypto.createHash("sha256").update(payload).digest("hex"),
    recordCount: normalizedRecords.length
  };
}

function createLocalRag(options = {}) {
  const snapshotPath = options.snapshotPath || DEFAULT_SNAPSHOT_PATH;
  const backupPath = options.backupPath || DEFAULT_BACKUP_PATH;
  const snapshot = readSnapshot(snapshotPath, backupPath);
  const initialRecords = snapshot?.records?.length ? snapshot.records : IRAN_LEGAL_SEED;
  const repository = createEvidenceRepository(initialRecords);
  const index = createLocalIndex(repository.all());

  function list(filters = {}) {
    return repository.list(filters);
  }

  function search(query, searchOptions = {}) {
    return index.search(query, searchOptions);
  }

  function rebuildIndex() {
    return index.rebuild(repository.all());
  }

  function replaceAll(records, { persist = true } = {}) {
    const normalized = validateRecords(records);
    repository.clear();
    repository.addMany(normalized);
    rebuildIndex();
    if (persist) writeSnapshot(repository.all(), snapshotPath, backupPath);
    return normalized.length;
  }

  function addMany(records, { persist = true } = {}) {
    if (!Array.isArray(records) || !records.length) return repository.size();
    const normalized = validateRecords(records);
    repository.addMany(normalized);
    rebuildIndex();
    if (persist) writeSnapshot(repository.all(), snapshotPath, backupPath);
    return repository.size();
  }

  function health() {
    const stats = index.stats();
    return {
      mode: "local",
      snapshotPath,
      backupPath,
      recordCount: repository.size(),
      index: {
        type: "bm25-local",
        documents: stats.documents,
        averageLength: stats.averageLength
      }
    };
  }

  return {
    list,
    search,
    replaceAll,
    addMany,
    rebuildIndex,
    health
  };
}

const localRag = createLocalRag();

module.exports = {
  DEFAULT_SNAPSHOT_PATH,
  DEFAULT_BACKUP_PATH,
  readSnapshot,
  writeSnapshot,
  createLocalRag,
  localRag
};
