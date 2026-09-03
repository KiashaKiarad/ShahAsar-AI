"use strict";

const crypto = require("crypto");
const zlib = require("zlib");

const DEFAULTS = Object.freeze({
  maxDocumentBytes: 25 * 1024 * 1024,
  maxExtractedTextBytes: 2 * 1024 * 1024,
  maxZipEntries: 256,
  maxZipUncompressedBytes: 32 * 1024 * 1024,
  maxZipEntryUncompressedBytes: 8 * 1024 * 1024,
  maxZipCompressionRatio: 200,
  maxPathLength: 240,
  maxXmlBytesToInspect: 2 * 1024 * 1024
});

function fail(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function ensureBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) throw fail("DOCUMENT_BUFFER_REQUIRED");
  if (buffer.length === 0) throw fail("DOCUMENT_EMPTY");
}

function looksLikePdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isPdfEofReasonable(buffer) {
  const tail = buffer.subarray(Math.max(0, buffer.length - 1024)).toString("latin1");
  return tail.includes("%%EOF");
}

function isZip(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
}

function readU16(buffer, offset) {
  if (offset < 0 || offset + 2 > buffer.length) throw fail("ZIP_STRUCTURE_INVALID");
  return buffer.readUInt16LE(offset);
}

function readU32(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) throw fail("ZIP_STRUCTURE_INVALID");
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw fail("ZIP_CENTRAL_DIRECTORY_NOT_FOUND");
}

function readEntryData(buffer, entry) {
  const start = entry.localOffset;
  if (start + 30 > buffer.length || readU32(buffer, start) !== 0x04034b50) throw fail("ZIP_LOCAL_HEADER_INVALID", { name: entry.name });
  const nameLength = readU16(buffer, start + 26);
  const extraLength = readU16(buffer, start + 28);
  const dataStart = start + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) throw fail("ZIP_ENTRY_DATA_RANGE_INVALID", { name: entry.name });
  return buffer.subarray(dataStart, dataEnd);
}

function decompressEntry(buffer, entry, maxOutputBytes) {
  const data = readEntryData(buffer, entry);
  try {
    if (entry.compression === 0) {
      if (data.length > maxOutputBytes) throw fail("ZIP_XML_INSPECTION_LIMIT_EXCEEDED", { name: entry.name });
      return data;
    }
    if (entry.compression === 8) return zlib.inflateRawSync(data, { maxOutputLength: maxOutputBytes });
  } catch (error) {
    if (error?.code === "ZIP_XML_INSPECTION_LIMIT_EXCEEDED") throw error;
    throw fail("ZIP_ENTRY_DECOMPRESSION_FAILED", { name: entry.name });
  }
  throw fail("ZIP_COMPRESSION_METHOD_REJECTED", { name: entry.name, compression: entry.compression });
}

function inspectZipCentralDirectory(buffer, options = {}) {
  ensureBuffer(buffer);
  const cfg = { ...DEFAULTS, ...options };
  if (!isZip(buffer)) throw fail("DOCX_ZIP_SIGNATURE_INVALID");

  const eocd = findEndOfCentralDirectory(buffer);
  const entries = readU16(buffer, eocd + 10);
  const centralSize = readU32(buffer, eocd + 12);
  const centralOffset = readU32(buffer, eocd + 16);

  if (entries === 0 || entries > cfg.maxZipEntries) throw fail("ZIP_ENTRY_COUNT_LIMIT_EXCEEDED", { entries });
  if (centralOffset + centralSize > eocd) throw fail("ZIP_CENTRAL_DIRECTORY_RANGE_INVALID");

  const result = [];
  let cursor = centralOffset;
  let totalUncompressed = 0;
  const required = new Set(["[Content_Types].xml", "word/document.xml"]);

  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > eocd) throw fail("ZIP_CENTRAL_DIRECTORY_TRUNCATED");
    if (readU32(buffer, cursor) !== 0x02014b50) throw fail("ZIP_CENTRAL_ENTRY_SIGNATURE_INVALID");

    const flags = readU16(buffer, cursor + 8);
    const compression = readU16(buffer, cursor + 10);
    const compressedSize = readU32(buffer, cursor + 20);
    const uncompressedSize = readU32(buffer, cursor + 24);
    const nameLength = readU16(buffer, cursor + 28);
    const extraLength = readU16(buffer, cursor + 30);
    const commentLength = readU16(buffer, cursor + 32);
    const localOffset = readU32(buffer, cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;

    if (nameEnd + extraLength + commentLength > eocd) throw fail("ZIP_ENTRY_RANGE_INVALID");
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    if (!name || name.length > cfg.maxPathLength) throw fail("ZIP_ENTRY_NAME_INVALID");
    if (name.includes("\\") || name.startsWith("/") || name.includes("../") || name.includes("..\\") || /^[A-Za-z]:/.test(name)) {
      throw fail("ZIP_PATH_TRAVERSAL_REJECTED", { name });
    }
    if (name.endsWith("/")) throw fail("ZIP_DIRECTORY_ENTRY_REJECTED", { name });
    if (flags & 0x0001) throw fail("ZIP_ENCRYPTED_ENTRY_REJECTED", { name });
    if (![0, 8].includes(compression)) throw fail("ZIP_COMPRESSION_METHOD_REJECTED", { name, compression });
    if (uncompressedSize > cfg.maxZipEntryUncompressedBytes) throw fail("ZIP_ENTRY_SIZE_LIMIT_EXCEEDED", { name, uncompressedSize });

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > cfg.maxZipUncompressedBytes) throw fail("ZIP_TOTAL_UNCOMPRESSED_LIMIT_EXCEEDED", { totalUncompressed });
    if (compressedSize > 0 && uncompressedSize / compressedSize > cfg.maxZipCompressionRatio) {
      throw fail("ZIP_COMPRESSION_RATIO_LIMIT_EXCEEDED", { name, compressedSize, uncompressedSize });
    }
    if (localOffset >= centralOffset || localOffset >= buffer.length) throw fail("ZIP_LOCAL_HEADER_OFFSET_INVALID", { name });

    result.push({ name, compression, compressedSize, uncompressedSize, localOffset });
    required.delete(name);
    cursor = nameEnd + extraLength + commentLength;
  }

  if (required.size) throw fail("DOCX_REQUIRED_PART_MISSING", { missing: [...required] });

  const xmlEntries = result.filter((entry) => /\.(xml|rels)$/i.test(entry.name));
  for (const entry of xmlEntries) {
    const xml = decompressEntry(buffer, entry, Math.min(cfg.maxXmlBytesToInspect, entry.uncompressedSize));
    const text = xml.toString("utf8");
    if (/<\!DOCTYPE\b/i.test(text) || /<!ENTITY\b/i.test(text) || /SYSTEM\s*["']/i.test(text) || /PUBLIC\s*["']/i.test(text)) {
      throw fail("DOCX_XML_EXTERNAL_ENTITY_REJECTED", { name: entry.name });
    }
    if (/xinclude|xi:include/i.test(text)) throw fail("DOCX_XINCLUDE_REJECTED", { name: entry.name });
  }

  return { entries: result, entryCount: result.length, totalUncompressedBytes: totalUncompressed };
}

function validatePlainText(buffer, maxBytes) {
  ensureBuffer(buffer);
  if (buffer.length > maxBytes) throw fail("TEXT_SIZE_LIMIT_EXCEEDED");
  if (buffer.includes(0)) throw fail("TEXT_BINARY_CONTENT_REJECTED");
  let controls = 0;
  for (const byte of buffer) {
    if ((byte < 9 || (byte > 13 && byte < 32)) && byte !== 27) controls += 1;
  }
  if (controls / buffer.length > 0.01) throw fail("TEXT_CONTROL_CHARACTER_LIMIT_EXCEEDED");
  return true;
}

function validateCleanDocument({ type, buffer, maxDocumentBytes = DEFAULTS.maxDocumentBytes, maxExtractedTextBytes = DEFAULTS.maxExtractedTextBytes, zip = {} }) {
  ensureBuffer(buffer);
  if (!type) throw fail("DOCUMENT_TYPE_REQUIRED");
  if (buffer.length > maxDocumentBytes) throw fail("DOCUMENT_SIZE_LIMIT_EXCEEDED");

  if (type === "pdf") {
    if (!looksLikePdf(buffer)) throw fail("PDF_SIGNATURE_INVALID");
    if (!isPdfEofReasonable(buffer)) throw fail("PDF_EOF_MARKER_MISSING");
    return { type, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), size: buffer.length, maxExtractedTextBytes };
  }
  if (type === "docx") {
    const inspected = inspectZipCentralDirectory(buffer, zip);
    return { type, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), size: buffer.length, maxExtractedTextBytes, zip: inspected };
  }
  if (type === "txt") {
    validatePlainText(buffer, maxExtractedTextBytes);
    return { type, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), size: buffer.length, maxExtractedTextBytes };
  }
  throw fail("DOCUMENT_TYPE_UNSUPPORTED");
}

module.exports = {
  DEFAULTS,
  looksLikePdf,
  inspectZipCentralDirectory,
  validatePlainText,
  validateCleanDocument
};
