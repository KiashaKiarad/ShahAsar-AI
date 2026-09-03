const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.resolve(
  process.env.LEGAL_RAG_CRAWL_STATE || path.join(__dirname, "../../data/legal-crawl-state.json")
);

function readState(filePath = DEFAULT_PATH) {
  try {
    if (!fs.existsSync(filePath)) {
      return { version: 1, sources: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.sources !== "object") {
      return { version: 1, sources: {} };
    }
    return parsed;
  } catch {
    return { version: 1, sources: {} };
  }
}

function writeState(state, filePath = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(temp, filePath);
}

function createCrawlState(options = {}) {
  const filePath = options.filePath || DEFAULT_PATH;
  const state = readState(filePath);

  function ensureSource(sourceId) {
    if (!state.sources[sourceId]) {
      state.sources[sourceId] = {
        queue: [],
        queued: {},
        visited: {},
        failed: {},
        lastRunAt: null
      };
    }
    return state.sources[sourceId];
  }

  function seed(sourceId, urls = []) {
    const source = ensureSource(sourceId);
    for (const url of Array.isArray(urls) ? urls : []) {
      if (!url || source.visited[url] || source.queued[url]) continue;
      source.queue.push(url);
      source.queued[url] = true;
    }
    writeState(state, filePath);
    return source.queue.length;
  }

  function take(sourceId, limit = 100) {
    const source = ensureSource(sourceId);
    const count = Math.max(1, Math.min(1000, Number(limit) || 100));
    const urls = source.queue.splice(0, count);
    for (const url of urls) delete source.queued[url];
    writeState(state, filePath);
    return urls;
  }

  function addDiscovered(sourceId, urls = []) {
    const source = ensureSource(sourceId);
    let added = 0;
    for (const url of Array.isArray(urls) ? urls : []) {
      if (!url || source.visited[url] || source.queued[url]) continue;
      source.queue.push(url);
      source.queued[url] = true;
      added += 1;
    }
    writeState(state, filePath);
    return added;
  }

  function markVisited(sourceId, url) {
    const source = ensureSource(sourceId);
    if (!url) return;
    source.visited[url] = new Date().toISOString();
    delete source.failed[url];
    writeState(state, filePath);
  }

  function markFailed(sourceId, url, error) {
    const source = ensureSource(sourceId);
    if (!url) return;
    source.failed[url] = {
      at: new Date().toISOString(),
      error: String(error || "unknown")
    };
    writeState(state, filePath);
  }

  function markRun(sourceId) {
    ensureSource(sourceId).lastRunAt = new Date().toISOString();
    writeState(state, filePath);
  }

  function stats(sourceId) {
    const source = ensureSource(sourceId);
    return {
      queued: source.queue.length,
      visited: Object.keys(source.visited).length,
      failed: Object.keys(source.failed).length,
      lastRunAt: source.lastRunAt
    };
  }

  return { seed, take, addDiscovered, markVisited, markFailed, markRun, stats };
}

module.exports = { DEFAULT_PATH, readState, writeState, createCrawlState };
