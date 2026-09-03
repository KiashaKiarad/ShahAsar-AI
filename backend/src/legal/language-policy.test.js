const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeLanguage, getLegalLanguage, resolveLanguagePlan } = require("./language-policy");

test("normalizes supported language tags", () => {
  assert.equal(normalizeLanguage("fa-IR"), "fa");
  assert.equal(normalizeLanguage("TR"), "tr");
  assert.equal(normalizeLanguage("xx"), undefined);
});

test("maps legal jurisdiction to legal language", () => {
  assert.equal(getLegalLanguage("IR"), "fa");
  assert.equal(getLegalLanguage("DE"), "de");
  assert.equal(getLegalLanguage("TR"), "tr");
  assert.equal(getLegalLanguage("AO"), undefined);
});

test("origin country does not restrict supported legal jurisdiction", () => {
  const plan = resolveLanguagePlan({ originCountry: "AO", inputLanguage: "en", responseLanguage: "en", jurisdiction: "TR" });
  assert.equal(plan.originCountry, "AO");
  assert.equal(plan.originCountrySupportedAsJurisdiction, false);
  assert.equal(plan.legalJurisdiction, "TR");
  assert.equal(plan.legalLanguage, "tr");
  assert.equal(plan.draftingLanguage, "tr");
});

test("German jurisdiction keeps user response language independent", () => {
  const plan = resolveLanguagePlan({ originCountry: "TR", inputLanguage: "tr", responseLanguage: "tr", jurisdiction: "DE" });
  assert.equal(plan.inputLanguage, "tr");
  assert.equal(plan.responseLanguage, "tr");
  assert.equal(plan.legalLanguage, "de");
  assert.equal(plan.draftingLanguage, "de");
});
