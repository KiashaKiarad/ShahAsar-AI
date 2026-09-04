const assert = require("assert");
const { createPrivateDocumentIndex, hashChunkText } = require("./private-document-index");

function makeChunks(userId, documentId, text, count = 1) {
  const extractedSha256 = hashChunkText(text);
  const sha256 = hashChunkText(`${documentId}:file`);
  return Array.from({ length: count }, (_, index) => ({
    id: `${documentId}:chunk:${index + 1}`,
    parentId: documentId,
    documentId,
    userId,
    chunkIndex: index,
    chunkCount: count,
    text: index === 0 ? text : `${text} ${index}`,
    sha256,
    extractedSha256,
    title: `Private document ${documentId}`,
    citation: documentId,
    source: "user-upload"
  }));
}

async function run() {
  const index = createPrivateDocumentIndex();
  const a = makeChunks("user-a", "doc-a", "اجاره قرارداد و تعهدات مستاجر");
  const b = makeChunks("user-b", "doc-b", "مالکیت و انتقال سند در قرارداد");

  assert.strictEqual(index.put("user-a", a), 1);
  assert.strictEqual(index.put("user-b", b), 1);
  assert.strictEqual(index.stats("user-a").chunks, 1);
  assert.strictEqual(index.stats("user-b").chunks, 1);

  const aResults = index.search("user-a", "تعهدات مستاجر", { topK: 5 });
  assert.strictEqual(aResults.length, 1);
  assert.strictEqual(aResults[0].evidence.parentId, "doc-a");
  assert.strictEqual(index.search("user-a", "مالکیت انتقال سند", { topK: 5 }).length, 0);

  const filtered = index.search("user-b", "مالکیت انتقال سند", { documentIds: ["doc-b"], topK: 5 });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(index.search("user-b", "مالکیت انتقال سند", { documentIds: ["doc-a"], topK: 5 }).length, 0);

  assert.throws(() => index.put("user-a", makeChunks("user-b", "doc-x", "متن")), /DOCUMENT_CHUNK_OWNER_MISMATCH/);
  assert.throws(() => index.put("user-a", [{ ...a[0], id: "doc-a:chunk:2" }]), /DOCUMENT_CHUNK_ID_PROVENANCE_MISMATCH/);

  const changed = makeChunks("user-a", "doc-a", "متن جدید و متفاوت");
  assert.throws(() => index.put("user-a", changed), /DOCUMENT_VERSION_CONTENT_CONFLICT/);

  index.remove("user-a", "doc-a");
  assert.strictEqual(index.stats("user-a").chunks, 0);
  assert.strictEqual(index.search("user-a", "تعهدات مستاجر", { topK: 5 }).length, 0);

  console.log("private-document-index tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
