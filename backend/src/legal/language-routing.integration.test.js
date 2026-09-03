const test = require("node:test");
const assert = require("node:assert/strict");
const { createLegalRequest } = require("./core");
const { validateLegalInput } = require("./validation");

test("Angola user can target Turkey; origin country is not a jurisdiction gate", () => {
  const input = validateLegalInput({ message: "Bir sözleşme uyuşmazlığı hakkında yardım istiyorum", originCountry: "AO", inputLanguage: "en", responseLanguage: "en", jurisdiction: "TR" });
  assert.equal(input.valid, true);
  const request = createLegalRequest(input.value);
  assert.equal(request.jurisdiction.code, "TR");
  assert.equal(request.languagePlan.originCountry, "AO");
  assert.equal(request.languagePlan.legalLanguage, "tr");
  assert.equal(request.languagePlan.draftingLanguage, "tr");
});

test("Turkish user can target Germany and keep Turkish explanation with German drafting", () => {
  const input = validateLegalInput({ message: "Ich brauche eine Klage wegen eines Vertrags", originCountry: "TR", inputLanguage: "tr", responseLanguage: "tr", jurisdiction: "DE" });
  assert.equal(input.valid, true);
  const request = createLegalRequest(input.value);
  assert.equal(request.jurisdiction.code, "DE");
  assert.equal(request.languagePlan.responseLanguage, "tr");
  assert.equal(request.languagePlan.legalLanguage, "de");
  assert.equal(request.languagePlan.draftingLanguage, "de");
});

test("unknown legal jurisdiction is rejected while unknown origin country remains valid", () => {
  const input = validateLegalInput({ message: "legal help", originCountry: "AO", inputLanguage: "en", jurisdiction: "CN" });
  assert.equal(input.valid, false);
  assert.ok(input.errors.some((error) => error.field === "jurisdiction" && error.code === "unsupported"));
  assert.equal(input.errors.some((error) => error.field === "originCountry"), false);
});
