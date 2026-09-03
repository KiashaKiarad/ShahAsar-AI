const assert = require("assert");
const { getIranSourceTypes } = require("./iran-source-taxonomy");
const { validateSourceUrl } = require("./ingestion-policy");
const { ingestEvidence } = require("./ingestor");
const { splitIntoChunks } = require("./chunker");

const sourceTypes = getIranSourceTypes();
assert.strictEqual(sourceTypes.length, 20, "Iran source taxonomy must contain 20 types");

const allowed = validateSourceUrl("https://qavanin.ir/");
assert.strictEqual(allowed.valid, true);
assert.strictEqual(validateSourceUrl("http://qavanin.ir/").valid, false);
assert.strictEqual(validateSourceUrl("https://example.com/").valid, false);
assert.strictEqual(validateSourceUrl("https://user:pass@qavanin.ir/").valid, false);

const evidence = ingestEvidence({
  id: "test-ir-law-1",
  jurisdiction: "IR",
  sourceType: sourceTypes[0].code,
  authority: "مرجع رسمی آزمایشی تست فنی",
  title: "سند آزمایشی ingestion",
  citation: "شناسه تست فنی",
  article: "۱",
  text: "این متن فقط برای آزمون فنی ingestion و chunking است.",
  sourceUrl: "https://qavanin.ir/",
  status: "active",
  effectiveFrom: "2020-01-01"
});

assert.ok(evidence.contentHash && evidence.contentHash.length === 64);
assert.strictEqual(evidence.jurisdiction, "IR");

const chunks = splitIntoChunks(`${evidence.text} ${evidence.text}`, { chunkSize: 40, overlap: 5 });
assert.ok(chunks.length >= 1);
assert.ok(chunks.every((chunk) => chunk.hash.length === 64));

console.log("ingestion.test.js: PASS");
