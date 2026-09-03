const { normalizeEvidence, filterEvidence } = require("./evidence");

function createEvidenceRepository(initialEvidence = []) {
  const records = new Map();

  addMany(initialEvidence);

  function add(record) {
    const normalized = normalizeEvidence(record);
    records.set(normalized.id, normalized);
    return normalized;
  }

  function addMany(items) {
    for (const item of Array.isArray(items) ? items : []) add(item);
    return records.size;
  }

  function list(filters = {}) {
    return filterEvidence([...records.values()], filters);
  }

  function all() {
    return [...records.values()].map((record) => ({ ...record }));
  }

  function clear() {
    records.clear();
  }

  function size() {
    return records.size;
  }

  return { add, addMany, list, all, clear, size };
}

module.exports = { createEvidenceRepository };
