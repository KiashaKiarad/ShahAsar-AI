const { normalizeEvidence, filterEvidence } = require("./evidence");

function createEvidenceRepository(initialEvidence = []) {
  let records = [];

  addMany(initialEvidence);

  function add(record) {
    const normalized = normalizeEvidence(record);
    records.push(normalized);
    return normalized;
  }

  function addMany(items) {
    for (const item of Array.isArray(items) ? items : []) add(item);
    return records.length;
  }

  function list(filters = {}) {
    return filterEvidence(records, filters);
  }

  function all() {
    return records.map((record) => ({ ...record }));
  }

  function clear() {
    records = [];
  }

  return {
    add,
    addMany,
    list,
    all,
    clear,
    size: () => records.length
  };
}

module.exports = { createEvidenceRepository };
