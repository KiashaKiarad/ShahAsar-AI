const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MIN_BYTES = 1;

const ALLOWED_TYPES = Object.freeze({
  pdf: Object.freeze({
    extension: ".pdf",
    mimeTypes: new Set(["application/pdf"]),
    signatures: [Buffer.from("%PDF-")]
  }),
  docx: Object.freeze({
    extension: ".docx",
    mimeTypes: new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]),
    signatures: [Buffer.from("PK\\x03\\x04", "binary")]
  }),
  txt: Object.freeze({
    extension: ".txt",
    mimeTypes: new Set(["text/plain"]),
    signatures: []
  })
});

function normalizeFilename(filename) {
  if (typeof filename !== "string") return "";
  return filename.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/g, "").trim();
}

function detectType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) return "pdf";
  if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "docx";
  return "txt";
}

function hasExpectedSignature(buffer, type) {
  if (!Buffer.isBuffer(buffer)) return false;
  const definition = ALLOWED_TYPES[type];
  if (!definition) return false;
  if (type === "txt") return true;
  return definition.signatures.some((signature) => buffer.subarray(0, signature.length).equals(signature));
}

function validateUploadMetadata({ filename, mimeType, size, buffer, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const errors = [];
  const safeFilename = normalizeFilename(filename);
  const lower = safeFilename.toLowerCase();
  const detectedType = detectType(buffer);
  const declaredMime = typeof mimeType === "string" ? mimeType.split(";", 1)[0].trim().toLowerCase() : "";

  if (!safeFilename || safeFilename.length > 180) errors.push({ code: "invalid_filename" });
  if (!Number.isInteger(size) || size < DEFAULT_MIN_BYTES) errors.push({ code: "invalid_size" });
  if (Number.isInteger(size) && size > maxBytes) errors.push({ code: "file_too_large", maxBytes });

  const extension = path.extname(lower);
  const matchingType = Object.entries(ALLOWED_TYPES).find(([, item]) => item.extension === extension)?.[0] || null;
  if (!matchingType) errors.push({ code: "extension_not_allowed" });
  if (matchingType && !ALLOWED_TYPES[matchingType].mimeTypes.has(declaredMime)) errors.push({ code: "mime_not_allowed" });
  if (matchingType && detectedType !== matchingType) errors.push({ code: "signature_mismatch" });
  if (matchingType && !hasExpectedSignature(buffer, matchingType)) errors.push({ code: "content_signature_invalid" });

  return {
    valid: errors.length === 0,
    errors,
    safeFilename,
    detectedType,
    type: matchingType
  };
}

function createQuarantineId() {
  return crypto.randomUUID();
}

async function quarantineBuffer(buffer, { quarantineDir, id = createQuarantineId() } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("INVALID_UPLOAD_BUFFER");
  if (typeof quarantineDir !== "string" || !quarantineDir.trim()) throw new Error("QUARANTINE_DIR_REQUIRED");

  const root = path.resolve(quarantineDir);
  await fs.promises.mkdir(root, { recursive: true, mode: 0o700 });

  const filename = `${id}.upload`;
  const target = path.resolve(root, filename);
  if (path.dirname(target) !== root) throw new Error("INVALID_QUARANTINE_PATH");

  const handle = await fs.promises.open(target, "wx", 0o600);
  try {
    await handle.writeFile(buffer);
    await handle.sync();
  } finally {
    await handle.close();
  }

  return {
    id,
    path: target,
    size: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    status: "quarantined"
  };
}

function requireVirusScanResult(scanResult) {
  if (!scanResult || scanResult.clean !== true) {
    const error = new Error("UPLOAD_SCAN_REQUIRED");
    error.code = "UPLOAD_SCAN_REQUIRED";
    throw error;
  }
  return true;
}

module.exports = {
  ALLOWED_TYPES,
  DEFAULT_MAX_BYTES,
  normalizeFilename,
  detectType,
  validateUploadMetadata,
  createQuarantineId,
  quarantineBuffer,
  requireVirusScanResult
};
