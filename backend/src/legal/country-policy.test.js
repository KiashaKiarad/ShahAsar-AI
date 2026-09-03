"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SUPPORTED_JURISDICTIONS,
  isSupportedJurisdiction,
  assertSupportedJurisdiction
} = require("./country-policy");
const { createCountryReadiness } = require("./country-readiness");

const EXPECTED = ["IR", "DE", "US", "AE", "SA", "KW", "OM", "TR", "IT"];

test("country allowlist contains exactly the nine supported jurisdictions", () => {
  assert.deepEqual(SUPPORTED_JURISDICTIONS, EXPECTED);
  for (const code of EXPECTED) assert.equal(isSupportedJurisdiction(code), true);
  for (const code of ["AO", "FR", "CN", "GB", "BR", "XX"]) assert.equal(isSupportedJurisdiction(code), false);
});

test("unsupported jurisdiction is fail-closed", () => {
  assert.equal(assertSupportedJurisdiction("ir"), "IR");
  assert.throws(() => assertSupportedJurisdiction("AO"), /COUNTRY_NOT_SUPPORTED/);
});

test("readiness ignores injected countries and refuses setting them", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shahasar-country-"));
  const file = path.join(dir, "readiness.json");
  fs.writeFileSync(file, JSON.stringify({ version: 99, countries: { IR: { status: "planned" }, AO: { status: "ready" } } }));
  const readiness = createCountryReadiness({ filePath: file });
  assert.equal(readiness.list().some((x) => x.jurisdiction === "AO"), false);
  assert.throws(() => readiness.get("AO"), /COUNTRY_NOT_SUPPORTED/);
  assert.throws(() => readiness.set("AO", { status: "ready" }), /COUNTRY_NOT_SUPPORTED/);
  fs.rmSync(dir, { recursive: true, force: true });
});
