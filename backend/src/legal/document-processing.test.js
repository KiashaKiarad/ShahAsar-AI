"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { createDocumentStore } = require("./document-store");
const { persistProcessedDocument } = require("./document-processing");

test("document processing persists hash, provenance, version and chunks", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-doc-store-"));
  try {
    const file = path.join(root, "documents.json");
    const store = createDocumentStore({ filePath: file });
    const buffer = Buffer.from("این متن قرارداد است. ماده ۱. تعهدات طرفین باید به صورت روشن ثبت شود.", "utf8");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const result = await persistProcessedDocument({
      store,
      buffer,
      document: { id: "doc-1", userId: "user-1", jurisdiction: "IR", originalFilename: "contract.txt", type: "txt", size: buffer.length, sha256: hash, scanStatus: "clean", status: "accepted" },
      extractor: async () => ({ type: "txt", text: buffer.toString("utf8"), sha256: hash })
    });
    assert.equal(result.record.status, "ready");
    assert.equal(result.record.contentHash, hash);
    assert.equal(result.record.extractionHash, hash);
    assert.equal(result.record.provenance.scan, "clean");
    assert.equal(result.record.provenance.parser, "validated");
    assert.ok(result.record.chunkCount >= 1);
    assert.equal(result.record.chunks[0].parentId, "doc-1");
    assert.equal(store.get("doc-1", "user-1").status, "ready");
    const loaded = createDocumentStore({ filePath: file });
    assert.equal(loaded.load().records.length, 1);
    assert.equal(loaded.get("doc-1", "user-2"), null);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("unsupported jurisdiction is rejected before document persistence", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-doc-store-"));
  try {
    const store = createDocumentStore({ filePath: path.join(root, "documents.json") });
    assert.throws(() => store.create({ id: "doc-x", userId: "user-1", jurisdiction: "CN", text: "text" }), /COUNTRY_NOT_SUPPORTED/);
    assert.equal(store.all().length, 0);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("document hash mismatch never creates a ready record", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shahasar-doc-store-"));
  try {
    const store = createDocumentStore({ filePath: path.join(root, "documents.json") });
    const buffer = Buffer.from("safe text", "utf8");
    await assert.rejects(() => persistProcessedDocument({
      store,
      buffer,
      document: { id: "doc-bad", userId: "user-1", jurisdiction: "IR", originalFilename: "bad.txt", type: "txt", size: buffer.length, sha256: "0".repeat(64), scanStatus: "clean", status: "accepted" },
      extractor: async () => ({ type: "txt", text: "safe text", sha256: "0".repeat(64) })
    }), /DOCUMENT_HASH_MISMATCH/);
    assert.equal(store.all().length, 0);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
