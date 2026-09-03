const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  validateUploadMetadata,
  quarantineBuffer,
  requireVirusScanResult,
  detectType
} = require("./document-intake");

test("accepts a real PDF signature only when extension and MIME agree", () => {
  const result = validateUploadMetadata({
    filename: "contract.pdf",
    mimeType: "application/pdf",
    size: 5,
    buffer: Buffer.from("%PDF-")
  });
  assert.equal(result.valid, true);
  assert.equal(result.type, "pdf");
});

test("rejects spoofed MIME or extension", () => {
  const result = validateUploadMetadata({
    filename: "contract.exe",
    mimeType: "application/pdf",
    size: 5,
    buffer: Buffer.from("%PDF-")
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "extension_not_allowed"));
});

test("rejects a PDF renamed as DOCX", () => {
  const result = validateUploadMetadata({
    filename: "contract.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 5,
    buffer: Buffer.from("%PDF-")
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "signature_mismatch"));
});

test("rejects oversized uploads before processing", () => {
  const result = validateUploadMetadata({
    filename: "contract.pdf",
    mimeType: "application/pdf",
    size: 26 * 1024 * 1024,
    buffer: Buffer.from("%PDF-")
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "file_too_large"));
});

test("does not accept a path traversal filename", () => {
  const result = validateUploadMetadata({
    filename: "../../contract.pdf",
    mimeType: "application/pdf",
    size: 5,
    buffer: Buffer.from("%PDF-")
  });
  assert.equal(result.safeFilename, "contract.pdf");
  assert.equal(result.valid, true);
});

test("quarantines content under an application-generated id", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-quarantine-"));
  try {
    const stored = await quarantineBuffer(Buffer.from("%PDF-"), { quarantineDir: root, id: "safe-test-id" });
    assert.equal(stored.status, "quarantined");
    assert.equal(path.basename(stored.path), "safe-test-id.upload");
    assert.equal((await fs.promises.readFile(stored.path)).toString(), "%PDF-");
    const mode = (await fs.promises.stat(stored.path)).mode & 0o777;
    assert.equal(mode, 0o600);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("fails closed unless an antivirus/sandbox result explicitly says clean", () => {
  assert.throws(() => requireVirusScanResult(null), /UPLOAD_SCAN_REQUIRED/);
  assert.throws(() => requireVirusScanResult({ clean: false }), /UPLOAD_SCAN_REQUIRED/);
  assert.equal(requireVirusScanResult({ clean: true }), true);
});

test("unknown binary content is not misclassified as a text legal document", () => {
  assert.equal(detectType(Buffer.from([0x00, 0xff, 0x01, 0x02])), null);
});
