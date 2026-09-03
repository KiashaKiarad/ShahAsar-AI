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

state.markVisited("ir-test", "https://qavanin.ir/b", {
  etag: "\"v1\"",
  lastModified: "Tue, 01 Sep 2026 00:00:00 GMT",
  contentHash: "hash-v1",
  contentType: "text/html"
});
const visited = state.getVisited("ir-test", "https://qavanin.ir/b");
assert.strictEqual(visited.etag, "\"v1\"");
assert.strictEqual(visited.contentHash, "hash-v1");
assert.strictEqual(state.stats("ir-test").visited, 2);

const oldCutoff = Date.now() + 1000;
assert.strictEqual(state.requeueDue("ir-test", oldCutoff, 10), 1);
assert.deepStrictEqual(state.take("ir-test", 1), ["https://qavanin.ir/b"]);
state.markNotModified("ir-test", "https://qavanin.ir/b", { etag: "\"v1\"" });
const revalidated = state.getVisited("ir-test", "https://qavanin.ir/b");
assert.strictEqual(revalidated.status, 304);
assert.strictEqual(revalidated.etag, "\"v1\"");

console.log("CRAWL_STATE_TEST_OK");
