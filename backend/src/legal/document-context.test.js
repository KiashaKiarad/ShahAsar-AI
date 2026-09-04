const assert = require("assert");
const { createDocumentContext } = require("./document-context");
const { createPrivateDocumentIndex, hashChunkText } = require("./private-document-index");

function chunk(userId, documentId, text) {
  return {
    id: `${documentId}:chunk:1`,
    parentId: documentId,
    documentId,
    userId,
    chunkIndex: 0,
    chunkCount: 1,
    text,
    sha256: hashChunkText(`${documentId}:file`),
    extractedSha256: hashChunkText(text),
    title: documentId,
    citation: documentId,
    source: "user-upload"
  };
}

async function run() {
  const privateIndex = createPrivateDocumentIndex();
  privateIndex.put("user-a", [chunk("user-a", "doc-a", "شرایط قرارداد خصوصی کاربر الف")]);

  const legalRag = {
    search(query, options) {
      assert.strictEqual(query, "شرایط قرارداد");
      assert.strictEqual(options.jurisdiction, "IR");
      return [{ evidence: { id: "law-1", jurisdiction: "IR", sourceType: "statute", title: "قانون" }, score: 4 }];
    }
  };

  const context = createDocumentContext({ localRag: legalRag, privateDocumentIndex: privateIndex });
  const result = context.search({ userId: "user-a", query: "شرایط قرارداد", jurisdiction: "IR" });

  assert.strictEqual(result.legalEvidence[0].kind, "legal-evidence");
  assert.strictEqual(result.legalEvidence[0].evidence.id, "law-1");
  assert.strictEqual(result.privateDocuments[0].kind, "private-document");
  assert.strictEqual(result.privateDocuments[0].evidence.parentId, "doc-a");
  assert.strictEqual(result.privateDocuments[0].evidence.source, "user-upload");

  const empty = context.search({ userId: "user-b", query: "شرایط قرارداد", jurisdiction: "IR" });
  assert.strictEqual(empty.privateDocuments.length, 0);
  assert.strictEqual(empty.legalEvidence.length, 1);
  assert.strictEqual(result.legalEvidence[0].kind === result.privateDocuments[0].kind, false);

  console.log("document-context tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
