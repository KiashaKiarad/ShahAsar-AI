function createDocumentContext({ localRag, privateDocumentIndex } = {}) {
  if (!localRag || typeof localRag.search !== "function") throw new Error("LOCAL_RAG_REQUIRED");
  if (!privateDocumentIndex || typeof privateDocumentIndex.search !== "function") throw new Error("PRIVATE_DOCUMENT_INDEX_REQUIRED");

  return {
    search({ userId, query, jurisdiction, asOfDate, documentIds, legalTopK = 5, documentTopK = 5 } = {}) {
      if (typeof userId !== "string" || !userId.trim()) throw new Error("AUTHENTICATED_USER_REQUIRED");
      if (typeof query !== "string" || !query.trim()) return { legalEvidence: [], privateDocuments: [] };

      const legalEvidence = localRag.search(query, {
        jurisdiction,
        asOfDate,
        topK: Math.max(1, Math.min(10, Number(legalTopK) || 5)),
        minScore: 0
      }).map((item) => ({
        kind: "legal-evidence",
        evidence: item.evidence,
        score: item.score
      }));

      const privateDocuments = privateDocumentIndex.search(userId, query, {
        documentIds,
        topK: Math.max(1, Math.min(10, Number(documentTopK) || 5)),
        minScore: 0
      }).map((item) => ({
        kind: "private-document",
        evidence: item.evidence,
        score: item.score
      }));

      return { legalEvidence, privateDocuments };
    }
  };
}

module.exports = { createDocumentContext };
