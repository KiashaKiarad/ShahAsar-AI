const { createDocumentRecord, verifyDocumentRecord } = require("./document-record");

function createDocumentVersionStore() {
  const documents = new Map();

  function put(record) {
    if (!verifyDocumentRecord(record)) throw new Error("DOCUMENT_RECORD_INTEGRITY_FAILED");
    const existing = documents.get(record.id);
    if (existing && existing.sha256 !== record.sha256) throw new Error("DOCUMENT_ID_REUSE_DETECTED");
    documents.set(record.id, Object.freeze({ ...record }));
    return documents.get(record.id);
  }

  function createVersion(input) {
    const record = createDocumentRecord(input);
    return put(record);
  }

  function get(id) {
    const record = documents.get(id);
    return record ? { ...record } : null;
  }

  function listByUser(userId) {
    return [...documents.values()].filter((record) => record.userId === userId).map((record) => ({ ...record }));
  }

  function size() { return documents.size; }
  function clear() { documents.clear(); }

  return { put, createVersion, get, listByUser, size, clear };
}

module.exports = { createDocumentVersionStore };