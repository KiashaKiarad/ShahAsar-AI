const assert = require("assert");
const { splitArticles, parseLegalPage } = require("./corpus-parser");

const text = [
  "قانون نمونه",
  "ماده ۱: هر شخص مکلف است از قانون تبعیت کند.",
  "ماده ۲: قرارداد باید با حسن نیت اجرا شود.",
  "ماده ۳: تخلف موجب مسئولیت قانونی است."
].join("\n");

const articles = splitArticles(text);
assert.strictEqual(articles.length, 3);
assert.strictEqual(articles[0].article, "1");
assert.ok(articles[1].text.includes("حسن نیت"));

const source = {
  id: "ir-qavanin",
  name: "پایگاه ملی قوانین و مقررات جمهوری اسلامی ایران"
};

const records = parseLegalPage({
  source,
  url: "https://qavanin.ir/test",
  html: `<html><head><title>قانون نمونه</title></head><body>${text.replace(/\n/g, "<br>")}</body></html>`
});

assert.strictEqual(records.length, 3);
assert.strictEqual(records[0].jurisdiction, "IR");
assert.strictEqual(records[0].article, "1");
assert.ok(records.every((record) => record.sourceUrl === "https://qavanin.ir/test"));

console.log("CORPUS_PARSER_TEST_OK");
