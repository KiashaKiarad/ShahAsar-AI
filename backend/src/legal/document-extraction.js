"use strict";

const crypto = require("crypto");
const { spawn } = require("child_process");
const { validatePlainText, readSafeZipEntry, DEFAULTS } = require("./document-parser-guard");

const PDF_TIMEOUT_MS = Math.min(Number(process.env.LEGAL_DOCUMENT_PDF_TIMEOUT_MS || 15000), 30000);
const PDF_MAX_TEXT_BYTES = Math.min(Number(process.env.LEGAL_DOCUMENT_PDF_TEXT_MAX_BYTES || DEFAULTS.maxExtractedTextBytes), DEFAULTS.maxExtractedTextBytes);

function cleanExtractedText(value, maxBytes = DEFAULTS.maxExtractedTextBytes) {
  const text = String(value || "").replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > maxBytes) throw new Error("EXTRACTED_TEXT_LIMIT_EXCEEDED");
  return text;
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function extractDocxText(buffer, maxBytes = DEFAULTS.maxExtractedTextBytes) {
  const xml = readSafeZipEntry(buffer, "word/document.xml", { maxOutputBytes: Math.min(maxBytes, DEFAULTS.maxXmlBytesToInspect || maxBytes) }).toString("utf8");
  const pieces = [];
  const token = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi;
  let match;
  while ((match = token.exec(xml))) {
    pieces.push(decodeXmlEntities(match[1]));
    if (Buffer.byteLength(pieces.join(" "), "utf8") > maxBytes) throw new Error("EXTRACTED_TEXT_LIMIT_EXCEEDED");
  }
  if (!pieces.length) throw new Error("DOCX_TEXT_EMPTY");
  return cleanExtractedText(pieces.join(" "), maxBytes);
}

function extractPdfText(buffer, { timeoutMs = PDF_TIMEOUT_MS, maxTextBytes = PDF_MAX_TEXT_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftotext", ["-layout", "-", "-"], { stdio: ["pipe", "pipe", "pipe"], shell: false });
    const output = [];
    const errors = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("PDF_TEXT_EXTRACTION_TIMEOUT"));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxTextBytes) {
        clearTimeout(timer);
        child.kill("SIGKILL");
        finish(new Error("PDF_TEXT_OUTPUT_LIMIT_EXCEEDED"));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(new Error(`PDF_TEXT_EXTRACTION_FAILED:${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        const detail = Buffer.concat(errors).toString("utf8").trim().slice(0, 300);
        finish(new Error(`PDF_TEXT_EXTRACTION_EXIT_${code}${detail ? `:${detail}` : ""}`));
        return;
      }
      try {
        finish(null, cleanExtractedText(Buffer.concat(output).toString("utf8"), maxTextBytes));
      } catch (error) {
        finish(error);
      }
    });
    child.stdin.on("error", (error) => {
      clearTimeout(timer);
      finish(new Error(`PDF_INPUT_FAILED:${error.message}`));
    });
    child.stdin.end(buffer);
  });
}

async function extractDocumentText({ type, buffer, maxTextBytes = DEFAULTS.maxExtractedTextBytes } = {}) {
  if (!Buffer.isBuffer(buffer)) throw new Error("DOCUMENT_BUFFER_REQUIRED");
  if (type === "txt") {
    validatePlainText(buffer, maxTextBytes);
    return { type, text: cleanExtractedText(buffer.toString("utf8"), maxTextBytes), sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
  }
  if (type === "docx") {
    const text = extractDocxText(buffer, maxTextBytes);
    return { type, text, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
  }
  if (type === "pdf") {
    const text = await extractPdfText(buffer, { maxTextBytes });
    if (!text) throw new Error("PDF_TEXT_EMPTY");
    return { type, text, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
  }
  throw new Error("DOCUMENT_TYPE_UNSUPPORTED");
}

module.exports = { cleanExtractedText, extractDocxText, extractPdfText, extractDocumentText };
