const assert = require("assert");
const { createLegalRequest, buildLegalSystemPrompt } = require("./core");

async function run() {
  const calls = [];
  const privateIndex = {
    search(userId, query, options) {
      calls.push({ userId, query, options });
      return [{
        evidence: {
          id: "doc-1:chunk:1",
          documentId: "doc-1",
          userId,
          chunkIndex: 0,
          chunkCount: 1,
          text: "این متن خصوصی قرارداد است.",
          sha256: "a".repeat(64),
          extractedSha256: "b".repeat(64),
          source: "private-document"
        },
        score: 4.2
      }];
    }
  };

  const request = createLegalRequest({
    message: "شرایط قرارداد اجاره چیست؟",
    jurisdiction: "IR",
    userId: "user-1",
    documentIds: ["doc-1"],
    privateDocumentIndex: privateIndex,
    topK: 3
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].userId, "user-1");
  assert.deepStrictEqual(calls[0].options.documentIds, ["doc-1"]);
  assert.strictEqual(request.privateEvidenceCount, 1);
  assert.strictEqual(request.privateEvidence[0].userId, "user-1");
  assert.strictEqual(request.privateEvidence[0].documentId, "doc-1");
  assert.strictEqual(request.privateRetrieval[0].source, "private-document");
  assert.match(request.systemPrompt, /Private user-document context count: 1/);
  assert.match(request.systemPrompt, /never legal authority/i);

  const noUser = createLegalRequest({ message: "شرایط قرارداد اجاره چیست؟", jurisdiction: "IR", topK: 3, privateDocumentIndex });
  assert.strictEqual(noUser.privateEvidenceCount, 0);

  const prompt = buildLegalSystemPrompt(null, [], { legalLanguage: "en", responseLanguage: "fa", draftingLanguage: "en" }, []);
  assert.match(prompt, /Never silently mix laws from different jurisdictions/);

  console.log("core-private-context tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
