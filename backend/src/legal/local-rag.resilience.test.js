const assert = require("assert");
const path = require("path");
const { createLocalRag } = require("./local-rag");
const { mergeById } = require("./corpus-sync");

const records = [
  {
    id: "resilience-1",
    jurisdiction: "IR",
    sourceType: "statute",
    authority: "قانون مدنی",
    title: "قانون مدنی",
    citation: "قانون مدنی، ماده ۲۱۹",
    article: "۲۱۹",
    paragraph: "",
    text: "عقد لازم است مگر به رضای طرفین اقاله یا به علت قانونی فسخ شود.",
    sourceUrl: "https://nezamat.ir/قانون-مدنی/",
    publishedOn: "1307-02-20",
    effectiveFrom: "1307-02-20",
    effectiveTo: null,
    status: "active"
  }
];

const rag = createLocalRag({
  snapshotPath: path.join(__dirname, "resilience.snapshot.json"),
  backupPath: path.join(__dirname, "resilience.backup.json")
});

rag.replaceAll(records, { persist: false });
const before = rag.search("ماده ۲۱۹ عقد", { jurisdiction: "IR", topK: 1 });
assert.strictEqual(before.length, 1);

const merged = mergeById(rag.list({}), []);
assert.strictEqual(merged.length, 1, "failed sync must not delete local corpus");

console.log("LOCAL_RAG_RESILIENCE_TEST_OK");
