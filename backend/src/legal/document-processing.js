"use strict";

const crypto = require("crypto");
const { extractDocumentText } = require("./document-extraction");
const { chunkEvidence } = require("./chunker");
const { normalizeForSearch } = require("./retriever");
const { createDocumentStore } = require("./document-store");

const DEFAULT_CHUNK_SIZE = 1400;
const DEFAULT_OVERLAP = 180;

function processCleanDocument({ document, buffer, store, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP, extractor = extractDocumentText } = {}) {
  if (!document || typeof document !== "object") throw new Error("DOCUMENT_RECORD_REQUIRED");
  if (!Buffer.isBuffer(buffer)) throw new Error("DOCUMENT_BUFFER_REQUIRED");
  if (!store || typeof store.create !== "function") throw new Error("DOCUMENT_STORE_REQUIRED");
  if (document.status && document.status !== "accepted") throw new Error("DOCUMENT_NOT_ACCEPTED");
  if (document.scanStatus !== "clean") throw new Error("DOCUMENT_SCAN_NOT_CLEAN");

  return Promise.resolve(extractor({ type: document.type, buffer, maxTextBytes: 2 * 1024 * 1024 })).then((extraction) => {
    if (!extraction || extraction.type !== document.type || !extraction.text?.trim()) throw new Error("DOCUMENT_EXTRACTION_RESULT_INVALID");
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
    if (contentHash !== document.sha256) throw new Error("DOCUMENT_HASH_MISMATCH");

    const chunks = chunkEvidence({
      id: document.id,
      jurisdiction: document.jurisdiction,
      title: document.originalFilename,
      citation: `user-document:${document.id}`,
      text: extraction.text,
      sourceUrl: "",
      sourceType: "other_official",
      authority: "user-upload",
      status: "active"
    }, { chunkSize, overlap });

    const normalizedChunks = chunks.map((chunk) => ({
      id: chunk.id,
      parentId: document.id,
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      text: chunk.text,
      normalizedText: normalizeForSearch(chunk.text)
    }));

    return {
      ...document,
      contentHash,
      extractionHash: extraction.sha256 || contentHash,
      extractedTextBytes: Buffer.byteLength(extraction.text, "utf8"),
      chunkCount: normalizedChunks.length,
      chunks: normalizedChunks,
      processedAt: new Date().toISOString(),
      processingVersion: "1"
    };
  });
}

function persistProcessedDocument({ document, buffer, store, ...options } = {}) {
  return processCleanDocument({ document, buffer, store, ...options }).then((processed) => {
    const record = store.create({
      ...processed,
      status: "ready",
      text: processed.chunks.map((chunk) => chunk.text).join("\n"),
      provenance: { scan: "clean", parser: "validated", extractedAt: processed.processedAt }
    });
    return { record, chunks: processed.chunks };
  });
}

module.exports = { DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP, processCleanDocument, persistProcessedDocument, createDocumentStore };
