"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("zlib");
const { extractDocumentText, extractDocxText } = require("./document-extraction");

function zipStored(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    local.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt32LE(0, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + data.length;
  }
  const localBuf = Buffer.concat(local); const centralBuf = Buffer.concat(central); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

function zipDeflated(entries) {
  const local = []; const central = []; let offset = 0;
  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name); const raw = Buffer.from(content); const data = zlib.deflateRawSync(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt32LE(0, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28); local.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(0, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42); central.push(ch, nameBuf); offset += lh.length + nameBuf.length + data.length;
  }
  const localBuf = Buffer.concat(local); const centralBuf = Buffer.concat(central); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const files = [["[Content_Types].xml", "<Types/>"] , ["word/document.xml", "<document><body><w:p><w:r><w:t>قرارداد امن</w:t></w:r></w:p></body></document>"]];

test("extracts bounded DOCX text without an XML parser", () => {
  const result = extractDocxText(zipStored(files));
  assert.equal(result, "قرارداد امن");
});

test("compressed DOCX XML is inspected and extracted", () => {
  const result = extractDocxText(zipDeflated(files));
  assert.equal(result, "قرارداد امن");
});

test("plain text extraction is bounded and hashed", async () => {
  const result = await extractDocumentText({ type: "txt", buffer: Buffer.from("ماده ۱\nتعهد") });
  assert.equal(result.text, "ماده ۱\nتعهد");
  assert.equal(result.sha256.length, 64);
});

test("extraction refuses oversized output", async () => {
  await assert.rejects(
    extractDocumentText({ type: "txt", buffer: Buffer.from("abcdefghij"), maxTextBytes: 5 }),
    /TEXT_SIZE_LIMIT_EXCEEDED/
  );
});

console.log("DOCUMENT_EXTRACTION_TEST_OK");
