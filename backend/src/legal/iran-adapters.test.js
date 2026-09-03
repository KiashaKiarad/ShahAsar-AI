const assert = require("assert");
const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");
const { ADAPTERS, getAdapter, validateAdapterCoverage } = require("./iran-adapters");

assert.strictEqual(validateAdapterCoverage().valid, true);
assert.strictEqual(getAdapter("ir-qavanin").baseUrl, "https://qavanin.ir/");
assert.strictEqual(getAdapter("ir-judiciary").baseUrl, "https://eadil.com/");
assert.strictEqual(getAdapter("ir-nezamat").baseUrl, "https://nezamat.ir/");
assert.ok(ADAPTERS["ir-qavanin"].supportedTypes.includes(IRAN_SOURCE_TYPES.STATUTE.code));
assert.ok(ADAPTERS["ir-qavanin"].supportedTypes.includes(IRAN_SOURCE_TYPES.REGULATION.code));
assert.ok(ADAPTERS["ir-judiciary"].supportedTypes.includes(IRAN_SOURCE_TYPES.UNIFIED_SUPREME_COURT.code));
assert.ok(ADAPTERS["ir-judiciary"].supportedTypes.includes(IRAN_SOURCE_TYPES.LEGAL_ADVISORY_OPINION.code));
assert.ok(ADAPTERS["ir-nezamat"].supportedTypes.includes(IRAN_SOURCE_TYPES.HISTORICAL_VERSION.code));

console.log("Iran adapter registry tests: PASS");
