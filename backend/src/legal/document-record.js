const crypto = require("crypto");

const MAX_TITLE = 240;
const MAX_ORIGINAL_FILENAME = 180;
const ALLOWED_TYPES = new Set(["pdf", "docx", "txt"]);

function cleanText(value, max) {
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

function createDocumentRecord({ id, userId, originalFilename, type, size, sha256, extractedSha256, textLength, parserVersion = "1", pipelineVersion = "1", source = "user-upload", createdAt = new Date().toISOString() } = {}) {
  if (!id || !userId) throw new Error("DOCUMENT_ID_AND_USER_REQUIRED");
  if (!ALLOWED_TYPES.has(type)) throw new Error("DOCUMENT_TYPE_UNSUPPORTED");
  if (!Number.isSafeInteger(size) || size < 0) throw new Error("DOCUMENT_SIZE_INVALID");
  if (!/^[a-f0-9]{64}$/i.test(String(sha256 || ""))) throw new Error("DOCUMENT_SHA256_INVALID");
  if (extractedSha256 != null && !/^[a-f0-9]{64}$/i.test(String(extractedSha256))) throw new Error("EXTRACTED_SHA256_INVALID");
  if (!Number.isSafeInteger(textLength) || textLength < 0) throw new Error("TEXT_LENGTH_INVALID");
  const filename = cleanText(originalFilename, MAX_ORIGINAL_FILENAME);
  if (!filename) throw new Error("DOCUMENT_FILENAME_REQUIRED");
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) throw new Error("DOCUMENT_CREATED_AT_INVALID");
  const record = Object.freeze({
    id: cleanText(id, 120),
    userId: cleanText(userId, 160),
    originalFilename: filename,
    type,
    size,
    sha256: String(sha256).toLowerCase(),
    extractedSha256: extractedSha256 ? String(extractedSha256).toLowerCase() : null,
    textLength,
    parserVersion: cleanText(parserVersion, 40) || "1",
    pipelineVersion: cleanText(pipelineVersion, 40) || "1",
    source: cleanText(source, 80) || "user-upload",
    createdAt: created.toISOString(),
    recordHash: crypto.createHash("sha256").update(JSON.stringify({ id, userId, originalFilename: filename, type, size, sha256, extractedSha256: extractedSha256 || null, textLength, parserVersion, pipelineVersion, source, createdAt: created.toISOString() })).digest("hex")
  });
  return record;
}

function verifyDocumentRecord(record) {
  if (!record || typeof record !== "object" || !/^[a-f0-9]{64}$/i.test(String(record.recordHash || ""))) return false;
  const copy = { ...record };
  delete copy.recordHash;
  const expected = crypto.createHash("sha256").update(JSON.stringify({ id: copy.id, userId: copy.userId, originalFilename: copy.originalFilename, type: copy.type, size: copy.size, sha256: copy.sha256, extractedSha256: copy.extractedSha256 || null, textLength: copy.textLength, parserVersion: copy.parserVersion, pipelineVersion: copy.pipelineVersion, source: copy.source, createdAt: copy.createdAt })).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(record.recordHash));
}

module.exports = { createDocumentRecord, verifyDocumentRecord, ALLOWED_TYPES };