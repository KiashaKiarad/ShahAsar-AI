const crypto = require("crypto");
const { normalizeEvidence, validateEvidence } = require("./evidence");
const { isKnownIranDocumentType } = require("./iran-corpus");

function normalizeSourceUrl(value) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) throw new Error("INVALID_SOURCE_URL");
  return url;
}

function ingestIranDocument(input = {}) {
  const documentType = typeof input.documentType === "string" ? input.documentType.trim() : "";

  if (!isKnownIranDocumentType(documentType)) {
    const error = new Error("UNKNOWN_IRAN_DOCUMENT_TYPE");
    error.code = "UNKNOWN_IRAN_DOCUMENT_TYPE";
    throw error;
  }

  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const evidence = normalizeEvidence({
    ...input,
    jurisdiction: "IR",
    sourceType: documentType,
    sourceUrl
  });

  const validation = validateEvidence(evidence);
  if (!validation.valid) {
    const error = new Error("INVALID_LEGAL_EVIDENCE");
    error.code = "INVALID_LEGAL_EVIDENCE";
    error.details = validation.errors;
    throw error;
  }

  return Object.freeze({
    ...evidence,
    documentType,
    ingestionId: crypto.createHash("sha256")
      .update(`${evidence.id}:${evidence.contentHash}:${documentType}`, "utf8")
      .digest("hex")
  });
}

function ingestIranDocuments(items = []) {
  if (!Array.isArray(items)) throw new TypeError("DOCUMENTS_MUST_BE_ARRAY");
  return items.map(ingestIranDocument);
}

module.exports = { ingestIranDocument, ingestIranDocuments };
