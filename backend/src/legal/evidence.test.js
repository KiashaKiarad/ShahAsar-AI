const assert = require("assert");
const {
  normalizeEvidence,
  validateEvidence,
  isEvidenceTemporallyValid,
  filterEvidence
} = require("./evidence");

const activeIranLaw = normalizeEvidence({
  id: "test-ir-1",
  jurisdiction: "IR",
  sourceType: "statute",
  authority: "official-test-authority",
  title: "Test Iranian Statute",
  citation: "TEST-IR-1",
  article: "1",
  text: "متن آزمایشی منبع حقوقی",
  effectiveFrom: "2020-01-01",
  status: "active",
  sourceUrl: "https://example.org/source"
});

const valid = validateEvidence(activeIranLaw);
assert.strictEqual(valid.valid, true, JSON.stringify(valid.errors));
assert.strictEqual(activeIranLaw.contentHash.length, 64);
assert.strictEqual(isEvidenceTemporallyValid(activeIranLaw, "2026-09-04"), true);
assert.strictEqual(isEvidenceTemporallyValid(activeIranLaw, "2019-12-31"), false);

const otherJurisdiction = normalizeEvidence({
  id: "test-de-1",
  jurisdiction: "DE",
  sourceType: "statute",
  authority: "official-test-authority",
  title: "Test German Statute",
  text: "Test text",
  effectiveFrom: "2020-01-01",
  status: "active"
});

const filtered = filterEvidence([activeIranLaw, otherJurisdiction], {
  jurisdiction: "IR",
  asOfDate: "2026-09-04"
});
assert.strictEqual(filtered.length, 1);
assert.strictEqual(filtered[0].id, "test-ir-1");

const repealed = normalizeEvidence({
  jurisdiction: "IR",
  sourceType: "statute",
  authority: "official-test-authority",
  title: "Repealed Test Law",
  text: "Test text",
  status: "repealed"
});
assert.strictEqual(isEvidenceTemporallyValid(repealed, "2026-09-04"), false);

console.log("Evidence layer tests: PASS");
