const test = require("node:test");
const assert = require("node:assert/strict");
const { createDocumentRecord, verifyDocumentRecord } = require("./document-record");

test("document record is immutable and provenance-verifiable", () => {
  const record = createDocumentRecord({ id: "doc-1", userId: "user-1", originalFilename: "contract.pdf", type: "pdf", size: 100, sha256: "a".repeat(64), extractedSha256: "b".repeat(64), textLength: 500, parserVersion: "2", pipelineVersion: "3", source: "user-upload", createdAt: "2026-09-04T07:00:00.000Z" });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(verifyDocumentRecord(record), true);
  const tampered = { ...record, textLength: 501 };
  assert.equal(verifyDocumentRecord(tampered), false);
});

test("document record rejects unsupported types and invalid hashes", () => {
  assert.throws(() => createDocumentRecord({ id: "1", userId: "u", originalFilename: "x.exe", type: "exe", size: 1, sha256: "a".repeat(64), textLength: 1 }), /DOCUMENT_TYPE_UNSUPPORTED/);
  assert.throws(() => createDocumentRecord({ id: "1", userId: "u", originalFilename: "x.pdf", type: "pdf", size: 1, sha256: "bad", textLength: 1 }), /DOCUMENT_SHA256_INVALID/);
});