"use strict";

const assert = require("assert");
const { validateCleanDocument, inspectZipCentralDirectory } = require("./document-parser-guard");

function storedZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    local.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + data.length;
  }

  const localBuf = Buffer.concat(local);
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const validDocx = storedZip([
  ["[Content_Types].xml", "<Types></Types>"],
  ["word/document.xml", "<document><body>متن قرارداد</body></document>"],
  ["word/_rels/document.xml.rels", "<Relationships></Relationships>"]
]);

const docxResult = validateCleanDocument({ type: "docx", buffer: validDocx });
assert.strictEqual(docxResult.type, "docx");
assert.strictEqual(docxResult.zip.entryCount, 3);
assert.ok(docxResult.sha256);

assert.throws(
  () => validateCleanDocument({ type: "docx", buffer: storedZip([
    ["[Content_Types].xml", "<Types></Types>"],
    ["word/document.xml", "<!DOCTYPE document [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><document>&x;</document>"]
  ]) }),
  /DOCX_XML_EXTERNAL_ENTITY_REJECTED/
);

assert.throws(
  () => validateCleanDocument({ type: "docx", buffer: storedZip([
    ["[Content_Types].xml", "<Types></Types>"],
    ["../word/document.xml", "<document/>"]
  ]) }),
  /ZIP_PATH_TRAVERSAL_REJECTED/
);

assert.throws(
  () => validateCleanDocument({ type: "docx", buffer: storedZip([
    ["[Content_Types].xml", "<Types></Types>"],
    ["word/document.xml", "<document/>"],
    ["word/huge.bin", "x"]
  ]), zip: { maxZipEntries: 2 } }),
  /ZIP_ENTRY_COUNT_LIMIT_EXCEEDED/
);

const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100), Buffer.from("\n%%EOF\n")]);
assert.strictEqual(validateCleanDocument({ type: "pdf", buffer: pdf }).type, "pdf");
assert.throws(() => validateCleanDocument({ type: "pdf", buffer: Buffer.from("not a pdf") }), /PDF_SIGNATURE_INVALID/);
assert.throws(() => validateCleanDocument({ type: "pdf", buffer: Buffer.from("%PDF-1.7\ncontent") }), /PDF_EOF_MARKER_MISSING/);

assert.strictEqual(validateCleanDocument({ type: "txt", buffer: Buffer.from("قرارداد\nماده ۱") }).type, "txt");
assert.throws(() => validateCleanDocument({ type: "txt", buffer: Buffer.from([0, 1, 2]) }), /TEXT_BINARY_CONTENT_REJECTED/);

const summary = inspectZipCentralDirectory(validDocx);
assert.strictEqual(summary.totalUncompressedBytes > 0, true);
console.log("DOCUMENT_PARSER_GUARD_TEST_OK");
