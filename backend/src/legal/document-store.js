"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { assertSupportedJurisdiction } = require("./country-policy");

const VERSION = 1;
const ALLOWED_STATUSES = new Set(["processing", "ready", "rejected", "failed"]);

function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

function normalizeDocument(input = {}) {
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  const jurisdiction = assertSupportedJurisdiction(input.jurisdiction);
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!userId) throw new Error("AUTHENTICATED_USER_REQUIRED");
  if (!text) throw new Error("DOCUMENT_TEXT_REQUIRED");
  const contentHash = typeof input.contentHash === "string" && /^[a-f0-9]{64}$/i.test(input.contentHash)
    ? input.contentHash.toLowerCase() : sha256(text);
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    userId,
    jurisdiction,
    originalFilename: typeof input.originalFilename === "string" ? input.originalFilename.trim().slice(0, 180) : "document",
    type: typeof input.type === "string" ? input.type.trim().toLowerCase() : "txt",
    size: Number.isInteger(input.size) && input.size >= 0 ? input.size : Buffer.byteLength(text, "utf8"),
    contentHash,
    status: ALLOWED_STATUSES.has(input.status) ? input.status : "processing",
    source: input.source === "upload" ? "upload" : "user_document",
    createdAt: typeof input.createdAt === "string" ? input.createdAt : now(),
    updatedAt: now(),
    version: Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
    parserVersion: typeof input.parserVersion === "string" ? input.parserVersion : "1",
    extractionHash: typeof input.extractionHash === "string" && /^[a-f0-9]{64}$/i.test(input.extractionHash) ? input.extractionHash.toLowerCase() : contentHash,
    extractedTextBytes: Buffer.byteLength(text, "utf8"),
    chunkCount: Number.isInteger(input.chunkCount) && input.chunkCount >= 0 ? input.chunkCount : 0,
    provenance: {
      scan: input.provenance?.scan === "clean" ? "clean" : "unknown",
      parser: input.provenance?.parser === "validated" ? "validated" : "unknown",
      extractedAt: typeof input.provenance?.extractedAt === "string" ? input.provenance.extractedAt : now()
    }
  };
}

function createDocumentStore({ filePath } = {}) {
  if (typeof filePath !== "string" || !filePath.trim()) throw new Error("DOCUMENT_STORE_PATH_REQUIRED");
  const target = path.resolve(filePath);
  const backup = `${target}.last-good.json`;
  let state = { version: VERSION, updatedAt: now(), records: [] };

  function loadFile(file) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.records)) throw new Error("DOCUMENT_STORE_INVALID");
    return parsed;
  }
  function load() {
    for (const file of [target, backup]) {
      try { if (fs.existsSync(file)) { state = loadFile(file); return clone(state); } } catch (_) {}
    }
    return clone(state);
  }
  function persist() {
    state.updatedAt = now();
    const payload = JSON.stringify(state, null, 2);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, payload, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temp, target);
    const backupTemp = `${backup}.${process.pid}.tmp`;
    fs.writeFileSync(backupTemp, payload, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(backupTemp, backup);
    return { path: target, sha256: sha256(payload), recordCount: state.records.length };
  }
  function create(input) {
    const record = normalizeDocument(input);
    if (state.records.some((item) => item.id === record.id)) throw new Error("DOCUMENT_ID_ALREADY_EXISTS");
    state.records.push(record); persist(); return clone(record);
  }
  function get(id, userId) {
    const record = state.records.find((item) => item.id === id && item.userId === userId);
    return record ? clone(record) : null;
  }
  function updateStatus(id, userId, status, patch = {}) {
    if (!ALLOWED_STATUSES.has(status)) throw new Error("DOCUMENT_STATUS_INVALID");
    const index = state.records.findIndex((item) => item.id === id && item.userId === userId);
    if (index < 0) throw new Error("DOCUMENT_NOT_FOUND");
    state.records[index] = { ...state.records[index], ...patch, status, updatedAt: now() };
    persist(); return clone(state.records[index]);
  }
  function listByUser(userId, jurisdiction) {
    return state.records.filter((item) => item.userId === userId && (!jurisdiction || item.jurisdiction === String(jurisdiction).toUpperCase())).map(clone);
  }
  return { load, persist, create, get, updateStatus, listByUser, all: () => state.records.map(clone) };
}

module.exports = { VERSION, normalizeDocument, createDocumentStore };
