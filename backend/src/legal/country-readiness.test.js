const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCountryReadiness } = require("./country-readiness");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shahasar-country-"));
const readiness = createCountryReadiness({ filePath: path.join(dir, "readiness.json") });

assert.strictEqual(readiness.isActive("IR"), false);
assert.throws(
  () => readiness.set("IR", { status: "ready", bootstrapComplete: true, coverageVerified: false, validatedAt: new Date().toISOString() }),
  /COUNTRY_CANNOT_BE_READY_WITHOUT_VERIFIED_BOOTSTRAP/
);

const now = new Date().toISOString();
readiness.set("IR", {
  status: "ready",
  bootstrapComplete: true,
  coverageVerified: true,
  validatedAt: now,
  recordCount: 100,
  lastSyncAt: now,
  lastError: null
});

assert.strictEqual(readiness.isActive("ir"), true);
assert.strictEqual(readiness.active().length, 1);
assert.strictEqual(readiness.get("IR").recordCount, 100);

console.log("COUNTRY_READINESS_TEST_OK");
