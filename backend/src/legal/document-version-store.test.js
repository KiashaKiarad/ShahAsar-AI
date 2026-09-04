const test = require("node:test");
const assert = require("node:assert/strict");
const { createDocumentVersionStore } = require("./document-version-store");

function input(id, userId, hash = "a") {
  return { id, userId, originalFilename: "contract.txt", type: "txt", size: 10, sha256: hash.repeat(64), textLength: 10, createdAt: "2026-09-04T07:00:00.000Z" };
}

test("version store returns only the user's documents", () => {
  const store = createDocumentVersionStore();
  store.createVersion(input("d1", "u1"));
  store.createVersion(input("d2", "u2"));
  assert.deepEqual(store.listByUser("u1").map((x) => x.id), ["d1"]);
});

test("document id cannot be reused with different content", () => {
  const store = createDocumentVersionStore();
  store.createVersion(input("d1", "u1", "a"));
  assert.throws(() => store.put({ ...store.get("d1"), sha256: "b".repeat(64) }), /DOCUMENT_ID_REUSE_DETECTED|DOCUMENT_RECORD_INTEGRITY_FAILED/);
});