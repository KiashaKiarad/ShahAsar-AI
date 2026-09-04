const crypto = require("crypto");
const { createLocalIndex } = require("./local-index");

const MAX_CHUNKS_PER_DOCUMENT = 5000;
const MAX_CHUNK_TEXT = 12000;

function assertOwner(userId) {
  if (typeof userId !== "string" || !userId.trim()) throw new Error("AUTHENTICATED_USER_REQUIRED");
  return userId.trim();
}

function validateChunk(chunk) {
  if (!chunk || typeof chunk !== "object") throw new Error("DOCUMENT_CHUNK_INVALID");
  if (typeof chunk.id !== "string" || !chunk.id.trim()) throw new Error("DOCUMENT_CHUNK_ID_REQUIRED");
  if (typeof chunk.parentId !== "string" || !chunk.parentId.trim()) throw new Error("DOCUMENT_CHUNK_PARENT_REQUIRED");
  if (typeof chunk.userId !== "string" || !chunk.userId.trim()) throw new Error("DOCUMENT_CHUNK_OWNER_REQUIRED");
  if (typeof chunk.text !== "string" || !chunk.text.trim()) throw new Error("DOCUMENT_CHUNK_TEXT_REQUIRED");
  if (chunk.text.length > MAX_CHUNK_TEXT) throw new Error("DOCUMENT_CHUNK_TOO_LARGE");
  if (typeof chunk.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(chunk.sha256)) throw new Error("DOCUMENT_CHUNK_SOURCE_HASH_INVALID");
  if (typeof chunk.extractedSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(chunk.extractedSha256)) throw new Error("DOCUMENT_CHUNK_EXTRACTED_HASH_INVALID");
  if (!Number.isInteger(chunk.chunkIndex) || chunk.chunkIndex < 0) throw new Error("DOCUMENT_CHUNK_INDEX_INVALID");
  if (!Number.isInteger(chunk.chunkCount) || chunk.chunkCount < 1 || chunk.chunkCount > MAX_CHUNKS_PER_DOCUMENT) throw new Error("DOCUMENT_CHUNK_COUNT_INVALID");
  if (chunk.chunkIndex >= chunk.chunkCount) throw new Error("DOCUMENT_CHUNK_INDEX_OUT_OF_RANGE");
  const expectedId = `${chunk.parentId}:chunk:${chunk.chunkIndex + 1}`;
  if (chunk.id !== expectedId) throw new Error("DOCUMENT_CHUNK_ID_PROVENANCE_MISMATCH");
  return Object.freeze({ ...chunk, ownerScope: chunk.userId.trim(), source: "user-upload" });
}

function createPrivateDocumentIndex() {
  const documents = new Map();
  const indexes = new Map();

  function rebuild(userId) {
    const owner = assertOwner(userId);
    const records = [...(documents.get(owner)?.values() || [])];
    indexes.set(owner, createLocalIndex(records));
    return indexes.get(owner).stats();
  }

  function put(userId, chunks) {
    const owner = assertOwner(userId);
    if (!Array.isArray(chunks) || chunks.length === 0) throw new Error("DOCUMENT_CHUNKS_REQUIRED");
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) throw new Error("DOCUMENT_CHUNK_COUNT_LIMIT_EXCEEDED");
    const validated = chunks.map(validateChunk);
    for (const chunk of validated) {
      if (chunk.userId.trim() !== owner) throw new Error("DOCUMENT_CHUNK_OWNER_MISMATCH");
    }
    const parentIds = new Set(validated.map((chunk) => chunk.parentId));
    for (const parentId of parentIds) {
      const sameDocument = validated.filter((chunk) => chunk.parentId === parentId);
      const expectedCount = sameDocument[0].chunkCount;
      if (sameDocument.some((chunk) => chunk.chunkCount !== expectedCount)) throw new Error("DOCUMENT_CHUNK_COUNT_MISMATCH");
      const existing = documents.get(owner)?.get(parentId);
      if (existing && existing[0]?.extractedSha256 !== sameDocument[0].extractedSha256) throw new Error("DOCUMENT_VERSION_CONTENT_CONFLICT");
    }
    const ownerMap = documents.get(owner) || new Map();
    for (const parentId of parentIds) ownerMap.set(parentId, validated.filter((chunk) => chunk.parentId === parentId));
    documents.set(owner, ownerMap);
    rebuild(owner);
    return validated.length;
  }

  function search(userId, query, options = {}) {
    const owner = assertOwner(userId);
    if (typeof query !== "string" || !query.trim()) return [];
    const index = indexes.get(owner);
    if (!index) return [];
    const requestedIds = Array.isArray(options.documentIds) ? new Set(options.documentIds.filter((id) => typeof id === "string")) : null;
    const topK = Math.max(1, Math.min(50, Number(options.topK) || 5));
    const results = index.search(query, { ...options, topK });
    return results
      .filter((item) => !requestedIds || requestedIds.has(item.evidence.parentId))
      .map((item) => ({ evidence: item.evidence, score: item.score }));
  }

  function remove(userId, documentId) {
    const owner = assertOwner(userId);
    if (typeof documentId !== "string" || !documentId.trim()) throw new Error("DOCUMENT_ID_REQUIRED");
    const ownerMap = documents.get(owner);
    if (!ownerMap) return false;
    const removed = ownerMap.delete(documentId.trim());
    if (!ownerMap.size) {
      documents.delete(owner);
      indexes.delete(owner);
    } else if (removed) rebuild(owner);
    return removed;
  }

  function list(userId, documentId) {
    const owner = assertOwner(userId);
    const ownerMap = documents.get(owner);
    if (!ownerMap) return [];
    if (documentId) return [...(ownerMap.get(documentId)?.map((item) => ({ ...item })) || [])];
    return [...ownerMap.values()].flat().map((item) => ({ ...item }));
  }

  function stats(userId) {
    const owner = assertOwner(userId);
    const ownerMap = documents.get(owner);
    return { userId: owner, documents: ownerMap?.size || 0, chunks: ownerMap ? [...ownerMap.values()].reduce((sum, chunks) => sum + chunks.length, 0) : 0 };
  }

  function clear(userId) {
    const owner = assertOwner(userId);
    documents.delete(owner);
    indexes.delete(owner);
  }

  return { put, search, remove, list, stats, clear };
}

function hashChunkText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

module.exports = { MAX_CHUNKS_PER_DOCUMENT, MAX_CHUNK_TEXT, validateChunk, createPrivateDocumentIndex, hashChunkText };
