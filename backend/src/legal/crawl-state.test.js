const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCrawlState } = require("./crawl-state");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shahasar-crawl-"));
const filePath = path.join(dir, "state.json");
const state = createCrawlState({ filePath, maxRetries: 2 });

state.seed("ir-test", ["https://qavanin.ir/a"]);
assert.deepStrictEqual(state.take("ir-test", 1), ["https://qavanin.ir/a"]);
state.markFailed("ir-test", "https://qavanin.ir/a", "temporary");
assert.strictEqual(state.stats("ir-test").queued, 1);
assert.strictEqual(state.stats("ir-test").failed, 1);

const retry = state.take("ir-test", 1);
assert.deepStrictEqual(retry, ["https://qavanin.ir/a"]);
state.markFailed("ir-test", "https://qavanin.ir/a", "temporary-again");
assert.strictEqual(state.stats("ir-test").queued, 0);
assert.strictEqual(state.stats("ir-test").exhaustedFailures, 1);

console.log("CRAWL_STATE_TEST_OK");
