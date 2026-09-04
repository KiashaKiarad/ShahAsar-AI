const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createUploadPipeline } = require("./upload-pipeline");

test("upload pipeline requires an authenticated user and scanner", () => {
  assert.throws(() => createUploadPipeline({ quarantineDir: "/tmp/q", cleanDir: "/tmp/c" }), /VIRUS_SCANNER_REQUIRED/);
});

test("clean file moves atomically out of quarantine only after scanner, parser and extraction approval", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-upload-"));
  const quarantineDir = path.join(root, "quarantine");
  const cleanDir = path.join(root, "clean");
  try {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32), Buffer.from("\n%%EOF\n")]);
    const pipeline = createUploadPipeline({
      quarantineDir,
      cleanDir,
      virusScanner: async ({ path: scanPath, sha256 }) => {
        assert.deepEqual(await fs.promises.readFile(scanPath), pdf);
        assert.equal(sha256.length, 64);
        return { clean: true };
      },
      extractor: async () => ({ type: "pdf", text: "متن قرارداد" })
    });
    const result = await pipeline.accept({ userId: "user-1", filename: "contract.pdf", mimeType: "application/pdf", size: pdf.length, buffer: pdf });
    assert.equal(result.status, "accepted");
    assert.equal(result.scanStatus, "clean");
    assert.equal(result.parser.type, "pdf");
    assert.equal(result.extractedSha256.length, 64);
    assert.equal(result.textLength, "متن قرارداد".length);
    assert.equal((await fs.promises.readdir(quarantineDir)).length, 0);
    assert.equal((await fs.promises.readdir(cleanDir)).length, 1);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("malware or unavailable scan never reaches clean storage", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-upload-"));
  const quarantineDir = path.join(root, "quarantine");
  const cleanDir = path.join(root, "clean");
  try {
    const pipeline = createUploadPipeline({ quarantineDir, cleanDir, virusScanner: async () => ({ clean: false }) });
    await assert.rejects(pipeline.accept({ userId: "user-1", filename: "contract.txt", mimeType: "text/plain", size: 9, buffer: Buffer.from("legal text") }), /UPLOAD_SCAN_REQUIRED/);
    assert.equal((await fs.promises.readdir(cleanDir).catch(() => [])).length, 0);
    assert.equal((await fs.promises.readdir(quarantineDir).catch(() => [])).length, 0);
  } finally { await fs.promises.rm(root, { recursive: true, force: true }); }
});

test("parser rejection also removes the quarantined file", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-upload-"));
  const quarantineDir = path.join(root, "quarantine");
  const cleanDir = path.join(root, "clean");
  try {
    const pipeline = createUploadPipeline({ quarantineDir, cleanDir, virusScanner: async () => ({ clean: true }), documentValidator: () => { throw new Error("PARSER_REJECTED_DOCUMENT"); } });
    await assert.rejects(pipeline.accept({ userId: "user-1", filename: "contract.txt", mimeType: "text/plain", size: 9, buffer: Buffer.from("legal text") }), /PARSER_REJECTED_DOCUMENT/);
    assert.equal((await fs.promises.readdir(cleanDir).catch(() => [])).length, 0);
    assert.equal((await fs.promises.readdir(quarantineDir).catch(() => [])).length, 0);
  } finally { await fs.promises.rm(root, { recursive: true, force: true }); }
});

test("extraction rejection also removes the quarantined file", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-upload-"));
  const quarantineDir = path.join(root, "quarantine");
  const cleanDir = path.join(root, "clean");
  try {
    const pipeline = createUploadPipeline({ quarantineDir, cleanDir, virusScanner: async () => ({ clean: true }), extractor: async () => { throw new Error("EXTRACTION_REJECTED_DOCUMENT"); } });
    await assert.rejects(pipeline.accept({ userId: "user-1", filename: "contract.txt", mimeType: "text/plain", size: 9, buffer: Buffer.from("legal text") }), /EXTRACTION_REJECTED_DOCUMENT/);
    assert.equal((await fs.promises.readdir(cleanDir).catch(() => [])).length, 0);
    assert.equal((await fs.promises.readdir(quarantineDir).catch(() => [])).length, 0);
  } finally { await fs.promises.rm(root, { recursive: true, force: true }); }
});
