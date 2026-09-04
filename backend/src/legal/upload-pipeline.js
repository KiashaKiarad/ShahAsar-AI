const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { validateUploadMetadata, quarantineBuffer, requireVirusScanResult } = require("./document-intake");
const { validateCleanDocument } = require("./document-parser-guard");
const { extractDocumentText } = require("./document-extraction");
const { createDocumentRecord } = require("./document-record");
const { chunkEvidence } = require("./chunker");

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

function createUploadPipeline({ quarantineDir, cleanDir, maxBytes = DEFAULT_MAX_BYTES, virusScanner, documentValidator = validateCleanDocument, extractor = extractDocumentText, chunkOptions = {}, privateDocumentIndex = null } = {}) {
  if (typeof quarantineDir !== "string" || !quarantineDir.trim()) throw new Error("QUARANTINE_DIR_REQUIRED");
  if (typeof cleanDir !== "string" || !cleanDir.trim()) throw new Error("CLEAN_DIR_REQUIRED");
  if (typeof virusScanner !== "function") throw new Error("VIRUS_SCANNER_REQUIRED");
  if (typeof documentValidator !== "function") throw new Error("DOCUMENT_VALIDATOR_REQUIRED");
  if (typeof extractor !== "function") throw new Error("DOCUMENT_EXTRACTOR_REQUIRED");
  if (privateDocumentIndex !== null && typeof privateDocumentIndex.put !== "function") throw new Error("PRIVATE_DOCUMENT_INDEX_INVALID");
  const quarantineRoot = path.resolve(quarantineDir);
  const cleanRoot = path.resolve(cleanDir);
  if (quarantineRoot === cleanRoot) throw new Error("QUARANTINE_AND_CLEAN_MUST_DIFFER");

  return {
    async accept({ filename, mimeType, size, buffer, userId } = {}) {
      if (typeof userId !== "string" || !userId.trim()) throw new Error("AUTHENTICATED_USER_REQUIRED");
      const validation = validateUploadMetadata({ filename, mimeType, size, buffer, maxBytes });
      if (!validation.valid) {
        const error = new Error("UPLOAD_VALIDATION_FAILED");
        error.code = "UPLOAD_VALIDATION_FAILED";
        error.details = validation.errors;
        throw error;
      }
      const quarantined = await quarantineBuffer(buffer, { quarantineDir: quarantineRoot });
      let cleanPath = null;
      try {
        const scan = await virusScanner({ path: quarantined.path, type: validation.type, sha256: quarantined.sha256 });
        requireVirusScanResult(scan);
        const parserResult = documentValidator({ type: validation.type, buffer, maxDocumentBytes: maxBytes });
        if (!parserResult || parserResult.type !== validation.type) throw new Error("DOCUMENT_VALIDATION_RESULT_INVALID");
        const extraction = await extractor({ type: validation.type, buffer });
        if (!extraction || extraction.type !== validation.type || typeof extraction.text !== "string" || !extraction.text.trim()) throw new Error("DOCUMENT_EXTRACTION_RESULT_INVALID");
        const extractedSha256 = crypto.createHash("sha256").update(extraction.text, "utf8").digest("hex");
        const cleanId = crypto.randomUUID();
        const extension = validation.type === "pdf" ? ".pdf" : validation.type === "docx" ? ".docx" : ".txt";
        cleanPath = path.resolve(cleanRoot, `${cleanId}${extension}`);
        if (path.dirname(cleanPath) !== cleanRoot) throw new Error("INVALID_CLEAN_PATH");
        await fs.promises.mkdir(cleanRoot, { recursive: true, mode: 0o700 });
        await fs.promises.rename(quarantined.path, cleanPath);
        const record = createDocumentRecord({ id: cleanId, userId, originalFilename: validation.safeFilename, type: validation.type, size: quarantined.size, sha256: quarantined.sha256, extractedSha256, textLength: extraction.text.length, parserVersion: String(parserResult.version || "1"), pipelineVersion: "4", source: "user-upload" });
        const chunks = chunkEvidence({ ...record, text: extraction.text }, chunkOptions).map((chunk) => ({ ...chunk, userId: record.userId, documentId: record.id, extractedSha256: record.extractedSha256, sha256: record.sha256 }));
        if (privateDocumentIndex) privateDocumentIndex.put(record.userId, chunks);
        return { ...record, parser: parserResult, extraction: { type: extraction.type, textLength: extraction.text.length, sha256: extractedSha256 }, chunks, path: cleanPath, scanStatus: "clean", status: "accepted", index: privateDocumentIndex ? "private-user-document" : "not-indexed" };
      } catch (error) {
        if (cleanPath) await fs.promises.rm(cleanPath, { force: true }).catch(() => undefined);
        await fs.promises.rm(quarantined.path, { force: true }).catch(() => undefined);
        throw error;
      }
    }
  };
}

module.exports = { createUploadPipeline };