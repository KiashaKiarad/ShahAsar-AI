const assert = require("assert");
const { createLocalIndex } = require("./local-index");

const records = [
  {
    id: "index-1",
    jurisdiction: "IR",
    sourceType: "statute",
    authority: "قانون مدنی",
    title: "قانون مدنی",
    citation: "قانون مدنی، ماده ۲۱۹",
    article: "۲۱۹",
    paragraph: "",
    text: "عقود لازم الاتباع هستند و طرفین باید به تعهدات قراردادی عمل کنند.",
    sourceUrl: "https://nezamat.ir/قانون-مدنی/",
    publishedOn: "1307-02-20",
    effectiveFrom: "1307-02-20",
    effectiveTo: null,
    status: "active"
  },
  {
    id: "index-2",
    jurisdiction: "IR",
    sourceType: "statute",
    authority: "قانون مدنی",
    title: "قانون مدنی",
    citation: "قانون مدنی، ماده ۲۲۳",
    article: "۲۲۳",
    paragraph: "",
    text: "معاملات در اصل محمول بر صحت هستند مگر خلاف آن معلوم شود.",
    sourceUrl: "https://nezamat.ir/قانون-مدنی/",
    publishedOn: "1307-02-20",
    effectiveFrom: "1307-02-20",
    effectiveTo: null,
    status: "active"
  }
];

const index = createLocalIndex(records);
const result = index.search("ماده ۲۱۹ قرارداد عقد", { jurisdiction: "IR", topK: 1 });
assert.strictEqual(result.length, 1);
assert.strictEqual(result[0].evidence.id, "index-1");
assert.ok(result[0].score > 0);

console.log("LOCAL_INDEX_TEST_OK");
