const assert = require("assert");
const { createLocalRag } = require("./local-rag");

const TEST_RECORDS = [
  {
    id: "test-local-1",
    jurisdiction: "IR",
    sourceType: "statute",
    authority: "قانون مدنی",
    title: "قانون مدنی",
    citation: "قانون مدنی، ماده ۲۱۹",
    article: "۲۱۹",
    paragraph: null,
    text: "عقودی که بر طبق قانون واقع شده باشد بین متعاملین لازم‌الاتباع است.",
    sourceUrl: "https://nezamat.ir/قانون-مدنی/",
    publishedOn: "1307-02-20",
    effectiveFrom: "1307-02-20",
    effectiveTo: null,
    status: "active"
  },
  {
    id: "test-local-2",
    jurisdiction: "IR",
    sourceType: "statute",
    authority: "قانون مدنی",
    title: "قانون مدنی",
    citation: "قانون مدنی، ماده ۲۲۳",
    article: "۲۲۳",
    paragraph: null,
    text: "هر معامله که واقع شده باشد محمول بر صحت است مگر اینکه فساد آن معلوم شود.",
    sourceUrl: "https://nezamat.ir/قانون-مدنی/",
    publishedOn: "1307-02-20",
    effectiveFrom: "1307-02-20",
    effectiveTo: null,
    status: "active"
  }
];

const rag = createLocalRag({
  snapshotPath: require("path").join(__dirname, "local-rag.test.snapshot.json")
});
rag.replaceAll(TEST_RECORDS, { persist: false });

const result = rag.search("ماده ۲۱۹ عقود", {
  jurisdiction: "IR",
  topK: 2
});

assert.ok(result.length >= 1, "local RAG should return local evidence");
assert.strictEqual(result[0].evidence.id, "test-local-1");
assert.strictEqual(rag.health().mode, "local");

console.log("LOCAL_RAG_TEST_OK");
