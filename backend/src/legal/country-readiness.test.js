const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCountryReadiness } = require("./country-readiness");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shahasar-country-"));
const readiness = createCountryReadiness({ filePath: path.join(dir, "readiness.json") });

for (const code of ["AE", "SA", "KW", "OM"]) {
  assert.strictEqual(readiness.isActive(code), false);
  assert.throws(
    () => readiness.set(code, {
      status: "ready",
      bootstrapComplete: false,
      coverageVerified: false,
      validatedAt: null
    }),
    /COUNTRY_CANNOT_BE_READY_WITHOUT_VERIFIED_BOOTSTRAP/
  );
}

assert.deepStrictEqual(readiness.active(), []);
const now = new Date().toISOString();
readiness.set("AE", {
  status: "ready",
  bootstrapComplete: true,
  coverageVerified: true,
  validatedAt: now,
  recordCount: 100,
  lastSyncAt: now,
  lastError: null
});

assert.strictEqual(readiness.isActive("AE"), true);
assert.strictEqual(readiness.isActive("SA"), false);
assert.strictEqual(readiness.active().length, 1);
assert.strictEqual(readiness.get("AE").recordCount, 100);

console.log("COUNTRY_READINESS_TEST_OK");
