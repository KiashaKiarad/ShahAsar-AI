const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRecords } = require("./local-rag");

test("RAG accepts only supported jurisdictions", () => {
  assert.throws(() => validateRecords([{ jurisdiction: "CN", sourceType: "statute", authority: "x", title: "x", text: "x", sourceUrl: "https://example.com" }]), /UNSUPPORTED_JURISDICTION/);
});

test("Iran RAG requires an allowlisted HTTPS source", () => {
  const base = { jurisdiction: "IR", sourceType: "statute", authority: "x", title: "x", text: "متن قانون معتبر", status: "active" };
  assert.throws(() => validateRecords([{ ...base, id: "bad-http", sourceUrl: "http://nezamat.ir/x" }]), /SOURCE_URL_REJECTED/);
  assert.doesNotThrow(() => validateRecords([{ ...base, id: "good", sourceUrl: "https://nezamat.ir/x" }]));
});

test("duplicate evidence IDs are rejected instead of silently overwritten", () => {
  const base = { jurisdiction: "IR", sourceType: "statute", authority: "x", title: "x", text: "متن قانون معتبر", sourceUrl: "https://nezamat.ir/x", status: "active" };
  assert.throws(() => validateRecords([{ ...base, id: "same" }, { ...base, id: "same" }]), /DUPLICATE_ID/);
});
