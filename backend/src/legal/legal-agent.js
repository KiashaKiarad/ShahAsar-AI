const { URL } = require("url");
const axios = require("axios");
const { validateSourceUrl } = require("./ingestion-policy");
const { parseLegalPage } = require("./corpus-parser");
const { discoverSourceUrls } = require("./corpus-discovery");
const { createCrawlState } = require("./crawl-state");
const { localRag } = require("./local-rag");
const { createNotificationStore } = require("./notification-store");
const { createLegalWatchStore } = require("./legal-watch-store");
const { IRAN_LEGAL_SOURCES } = require("./iran-sources");
const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");
const { ingestEvidence } = require("./ingestor");

const DEFAULT_INTERVAL_MS = Number(process.env.LEGAL_AGENT_INTERVAL_MS || 15 * 60 * 1000);
const MAX_DISCOVERY_LINKS = Number(process.env.LEGAL_AGENT_DISCOVERY_LIMIT || 5000);
const MAX_URLS_PER_RUN = Number(process.env.LEGAL_AGENT_URLS_PER_RUN || 120);
const REQUEST_TIMEOUT_MS = Number(process.env.LEGAL_AGENT_DISCOVERY_TIMEOUT_MS || 10000);

const notifications = createNotificationStore();
const watches = createLegalWatchStore();
const crawlState = createCrawlState();

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function sameOriginAllowed(baseUrl, candidateUrl) {
  try { return new URL(baseUrl).origin === new URL(candidateUrl).origin; } catch { return false; }
}

function isLikelyDocumentUrl(url) {
  return !/\.(css|js|png|jpg|jpeg|gif|svg|ico|zip|rar|7z|mp4|mp3|webp|woff2?|ttf)(\?|$)/i.test(url);
}

async function fetchHtml(url) {
  const checked = validateSourceUrl(url);
  if (!checked.valid) throw new Error(`SOURCE_URL_REJECTED:${checked.reason}`);
  const response = await axios.get(checked.url.toString(), {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 0,
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 300,
    headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9" }
  });

  const location = response.headers.location;
  if (location) {
    const redirected = absoluteUrl(checked.url.toString(), location);
    if (!redirected || !sameOriginAllowed(checked.url.toString(), redirected)) {
      throw new Error("SOURCE_REDIRECT_OUTSIDE_ORIGIN_REJECTED");
    }
  }

  return String(response.data || "");
}

function extractPageLinks(baseUrl, html, limit = MAX_DISCOVERY_LINKS) {
  const links = new Set();
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(String(html || ""))) && links.size < limit) {
    const absolute = absoluteUrl(baseUrl, match[1]);
    if (!absolute || !sameOriginAllowed(baseUrl, absolute) || !isLikelyDocumentUrl(absolute)) continue;
    if (!validateSourceUrl(absolute).valid) continue;
    links.add(absolute);
  }
  return [...links];
}

function dedupeById(records) {
  return [...new Map((Array.isArray(records) ? records : []).map((record) => [record.id, record])).values()];
}

function archiveChangedRecord(previous, current) {
  if (!previous || previous.contentHash === current.contentHash) return null;
  return ingestEvidence({
    ...previous,
    id: `${previous.id}:history:${previous.contentHash.slice(0, 16)}`,
    sourceType: IRAN_SOURCE_TYPES.HISTORICAL_VERSION.code,
    status: "active",
    effectiveTo: current.publishedOn || new Date().toISOString().slice(0, 10)
  });
}

function findRelatedWatches(evidence) {
  const haystack = `${evidence.title} ${evidence.citation} ${evidence.article} ${evidence.text}`.toLowerCase();
  return watches.list({ jurisdiction: evidence.jurisdiction }).filter((watch) => {
    const terms = [watch.title, watch.metadata?.keywords || "", watch.text]
      .join(" ")
      .split(/\s+/)
      .map((term) => term.toLowerCase().trim())
      .filter((term) => term.length >= 4);
    return terms.some((term) => haystack.includes(term));
  });
}

function emitLawUpdateNotifications(previous, current) {
  if (previous && previous.contentHash === current.contentHash) return 0;
  let count = 0;

  for (const watch of findRelatedWatches(current)) {
    notifications.add({
      type: "legal_update",
      status: "new",
      ownerId: watch.ownerId,
      relatedItemId: watch.id,
      legalEvidenceId: current.id,
      jurisdiction: current.jurisdiction,
      title: `به‌روزرسانی حقوقی مرتبط با «${watch.title}»`,
      message: `رکورد «${current.title}» در RAG محلی شاه‌اثر اضافه یا تغییر کرده و با مورد تحت پایش شما مرتبط تشخیص داده شد.`,
      citation: current.citation,
      sourceUrl: current.sourceUrl
    });
    count += 1;
  }

  notifications.add({
    type: "new_law",
    status: "new",
    ownerId: null,
    relatedItemId: null,
    legalEvidenceId: current.id,
    jurisdiction: current.jurisdiction,
    title: current.title,
    message: "این رکورد توسط عامل خودکار پایگاه حقوقی شاه‌اثر کشف یا به‌روزرسانی شده است.",
    citation: current.citation,
    sourceUrl: current.sourceUrl
  });

  return count + 1;
}

function mergeCanonical(existing, incoming, archived) {
  const map = new Map();
  for (const record of existing) map.set(record.id, record);
  for (const record of archived) map.set(record.id, record);
  for (const record of incoming) map.set(record.id, record);
  return [...map.values()];
}

async function runLegalAgentOnce() {
  const before = localRag.list({});
  const beforeById = new Map(before.map((record) => [record.id, record]));
  const candidates = [];
  const failures = [];
  const discoveredBySource = {};
  let visited = 0;

  for (const source of IRAN_LEGAL_SOURCES.filter((item) => item.enabled)) {
    try {
      const discovery = await discoverSourceUrls(source, { maxLinks: MAX_DISCOVERY_LINKS });
      discoveredBySource[source.id] = discovery.urls.length;
      failures.push(...discovery.failures.map((item) => ({ sourceId: source.id, ...item })));
      crawlState.seed(source.id, [source.url, ...discovery.urls]);
    } catch (error) {
      failures.push({ sourceId: source.id, url: source.url, error: error.message });
    }
  }

  for (const source of IRAN_LEGAL_SOURCES.filter((item) => item.enabled)) {
    const urls = crawlState.take(source.id, MAX_URLS_PER_RUN);
    for (const url of urls) {
      try {
        if (!sameOriginAllowed(source.url, url)) throw new Error("SOURCE_ORIGIN_REJECTED");
        const html = await fetchHtml(url);
        const nextLinks = extractPageLinks(url, html, MAX_DISCOVERY_LINKS);
        crawlState.addDiscovered(source.id, nextLinks);
        const parsed = parseLegalPage({ source, url, html });
        candidates.push(...parsed);
        crawlState.markVisited(source.id, url);
        visited += 1;
      } catch (error) {
        crawlState.markFailed(source.id, url, error.message);
        failures.push({ sourceId: source.id, url, error: error.message });
      }
    }
    crawlState.markRun(source.id);
  }

  const deduped = dedupeById(candidates);
  const changed = [];
  const archived = [];
  let unchanged = 0;

  for (const record of deduped) {
    const previous = beforeById.get(record.id) || null;
    if (previous && previous.contentHash === record.contentHash) {
      unchanged += 1;
      continue;
    }
    const historical = archiveChangedRecord(previous, record);
    if (historical) archived.push(historical);
    changed.push(record);
  }

  let notificationsCreated = 0;
  for (const record of changed) {
    notificationsCreated += emitLawUpdateNotifications(beforeById.get(record.id) || null, record);
  }

  if (changed.length || archived.length) {
    const merged = mergeCanonical(before, changed, archived);
    localRag.replaceAll(merged, { persist: true });
  }

  const result = {
    attemptedSources: IRAN_LEGAL_SOURCES.filter((item) => item.enabled).length,
    discoveredBySource,
    visited,
    parsedRecords: candidates.length,
    acceptedRecords: deduped.length,
    updated: changed.length,
    unchanged,
    historicalVersions: archived.length,
    failed: failures.length,
    failures,
    notificationsCreated,
    corpusRecordCount: localRag.health().recordCount,
    crawl: Object.fromEntries(IRAN_LEGAL_SOURCES.map((source) => [source.id, crawlState.stats(source.id)])),
    degraded: failures.length > 0,
    completedAt: new Date().toISOString()
  };

  notifications.add({
    type: "agent_run",
    status: result.degraded ? "degraded" : "success",
    ownerId: null,
    relatedItemId: null,
    legalEvidenceId: null,
    title: "گزارش عامل پایش و جمع‌آوری قوانین شاه‌اثر",
    message: `اجرای Agent: ${result.updated} رکورد جدید/تغییریافته، ${result.historicalVersions} نسخه تاریخی و ${result.failed} خطا.`,
    metadata: result
  });

  return result;
}

function startLegalAgent(options = {}) {
  const intervalMs = Number(options.intervalMs || DEFAULT_INTERVAL_MS);
  let running = false;

  async function tick() {
    if (running) return { skipped: true, reason: "already_running" };
    running = true;
    try { return await runLegalAgentOnce(); }
    finally { running = false; }
  }

  const timer = setInterval(() => {
    tick().catch((error) => {
      notifications.add({
        type: "agent_error",
        status: "error",
        ownerId: null,
        relatedItemId: null,
        legalEvidenceId: null,
        title: "خطای عامل پایش قوانین",
        message: error.message
      });
    });
  }, intervalMs);

  if (typeof timer.unref === "function") timer.unref();
  tick().catch(() => {});
  return { intervalMs, tick, stop: () => clearInterval(timer) };
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  runLegalAgentOnce,
  startLegalAgent,
  notifications,
  watches,
  crawlState
};
