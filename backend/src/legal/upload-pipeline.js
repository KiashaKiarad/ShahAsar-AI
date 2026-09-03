const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  validateUploadMetadata,
  quarantineBuffer,
  requireVirusScanResult
} = require("./document-intake");
const { validateCleanDocument } = require("./document-parser-guard");

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

function createUploadPipeline({ quarantineDir, cleanDir, maxBytes = DEFAULT_MAX_BYTES, virusScanner, documentValidator = validateCleanDocument } = {}) {
  if (typeof quarantineDir !== "string" || !quarantineDir.trim()) throw new Error("QUARANTINE_DIR_REQUIRED");
  if (typeof cleanDir !== "string" || !cleanDir.trim()) throw new Error("CLEAN_DIR_REQUIRED");
  if (typeof virusScanner !== "function") throw new Error("VIRUS_SCANNER_REQUIRED");
  if (typeof documentValidator !== "function") throw new Error("DOCUMENT_VALIDATOR_REQUIRED");

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
      try {
        const scan = await virusScanner({ path: quarantined.path, type: validation.type, sha256: quarantined.sha256 });
        requireVirusScanResult(scan);

        const parserResult = documentValidator({ type: validation.type, buffer, maxDocumentBytes: maxBytes });
        if (!parserResult || parserResult.type !== validation.type) throw new Error("DOCUMENT_VALIDATION_RESULT_INVALID");

        const cleanId = crypto.randomUUID();
        const extension = validation.type === "pdf" ? ".pdf" : validation.type === "docx" ? ".docx" : ".txt";
        const target = path.resolve(cleanRoot, `${cleanId}${extension}`);
        if (path.dirname(target) !== cleanRoot) throw new Error("INVALID_CLEAN_PATH");
        await fs.promises.mkdir(cleanRoot, { recursive: true, mode: 0o700 });
        await fs.promises.rename(quarantined.path, target);

        return {
          id: cleanId,
          userId,
          originalFilename: validation.safeFilename,
          type: validation.type,
          size: quarantined.size,
          sha256: quarantined.sha256,
          parser: parserResult,
          path: target,
          scanStatus: "clean",
          status: "accepted"
        };
      } catch (error) {
        await fs.promises.rm(quarantined.path, { force: true }).catch(() => undefined);
        throw error;
      }
    }
  };
}

module.exports = { createUploadPipeline };
