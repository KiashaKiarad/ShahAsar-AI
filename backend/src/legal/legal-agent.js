const { URL } = require("url");
const axios = require("axios");
const { validateSourceUrl } = require("./ingestion-policy");
const { parseLegalPage } = require("./corpus-parser");
const { localRag } = require("./local-rag");
const { createNotificationStore } = require("./notification-store");
const { createLegalWatchStore } = require("./legal-watch-store");
const { IRAN_LEGAL_SOURCES } = require("./iran-sources");

const DEFAULT_INTERVAL_MS = Number(process.env.LEGAL_AGENT_INTERVAL_MS || 15 * 60 * 1000);
const MAX_LINKS_PER_SOURCE = Number(process.env.LEGAL_AGENT_MAX_LINKS_PER_SOURCE || 120);
const MAX_DEPTH = Number(process.env.LEGAL_AGENT_MAX_DEPTH || 2);
const REQUEST_TIMEOUT_MS = Number(process.env.LEGAL_AGENT_DISCOVERY_TIMEOUT_MS || 10000);
const MAX_PAGES_PER_RUN = Number(process.env.LEGAL_AGENT_MAX_PAGES_PER_RUN || 300);

const notifications = createNotificationStore();
const watches = createLegalWatchStore();

function absoluteUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function sameOriginAllowed(baseUrl, candidateUrl) {
  try {
    const base = new URL(baseUrl);
    const candidate = new URL(candidateUrl);
    return base.protocol === candidate.protocol && base.hostname === candidate.hostname;
  } catch {
    return false;
  }
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
    validateStatus: (status) => status >= 200 && status < 400,
    headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9" }
  });

  const location = response.headers.location;
  if (location) {
    const redirected = absoluteUrl(checked.url.toString(), location);
    if (!redirected || !sameOriginAllowed(checked.url.toString(), redirected)) {
      throw new Error("SOURCE_REDIRECT_OUTSIDE_ORIGIN_REJECTED");
    }
  }

  return { status: response.status, headers: response.headers, html: String(response.data || "") };
}

function extractLegalLinks(baseUrl, html) {
  const links = new Set();
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) && links.size < MAX_LINKS_PER_SOURCE) {
    const absolute = absoluteUrl(baseUrl, match[1]);
    if (!absolute || !sameOriginAllowed(baseUrl, absolute) || !isLikelyDocumentUrl(absolute)) continue;
    if (!validateSourceUrl(absolute).valid) continue;
    links.add(absolute);
  }
  return [...links];
}

async function discoverSourcePages(source) {
  const queue = [{ url: source.url, depth: 0 }];
  const visited = new Set();
  const pages = [];
  const failures = [];

  while (queue.length && pages.length < MAX_PAGES_PER_RUN) {
    const current = queue.shift();
    if (visited.has(current.url)) continue;
    visited.add(current.url);

    try {
      const page = await fetchHtml(current.url);
      pages.push({ url: current.url, depth: current.depth, html: page.html });
      if (current.depth >= MAX_DEPTH) continue;
      for (const child of extractLegalLinks(current.url, page.html)) {
        if (!visited.has(child)) queue.push({ url: child, depth: current.depth + 1 });
      }
    } catch (error) {
      failures.push({ url: current.url, error: error.message });
    }
  }

  return { pages, failures };
}

function findRelatedWatches(evidence) {
  const haystack = String(`${evidence.title} ${evidence.citation} ${evidence.article} ${evidence.text}`)
    .toLowerCase();
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
      message: `رکورد حقوقی «${current.title}» در پایگاه محلی شاه‌اثر اضافه یا تغییر کرده و با مورد تحت پایش شما مرتبط تشخیص داده شد.`,
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

async function runLegalAgentOnce() {
  const before = localRag.list({});
  const beforeById = new Map(before.map((record) => [record.id, record]));
  const candidates = [];
  const failures = [];
  let discoveredPages = 0;

  for (const source of IRAN_LEGAL_SOURCES.filter((item) => item.enabled)) {
    const discovery = await discoverSourcePages(source);
    discoveredPages += discovery.pages.length;
    failures.push(...discovery.failures.map((item) => ({ sourceId: source.id, ...item })));

    for (const page of discovery.pages) {
      try {
        candidates.push(...parseLegalPage({ source, url: page.url, html: page.html }));
      } catch (error) {
        failures.push({ sourceId: source.id, url: page.url, error: error.message });
      }
    }
  }

  const deduped = [...new Map(candidates.map((record) => [record.id, record])).values()];
  const changed = deduped.filter((record) => {
    const previous = beforeById.get(record.id);
    return !previous || previous.contentHash !== record.contentHash;
  });

  let notificationsCreated = 0;
  for (const record of changed) {
    notificationsCreated += emitLawUpdateNotifications(beforeById.get(record.id) || null, record);
  }

  if (deduped.length) localRag.addMany(deduped, { persist: true });

  const result = {
    attemptedSources: IRAN_LEGAL_SOURCES.filter((item) => item.enabled).length,
    discoveredPages,
    acceptedRecords: deduped.length,
    updated: changed.length,
    failed: failures.length,
    failures,
    notificationsCreated,
    corpusRecordCount: localRag.health().recordCount,
    degraded: failures.length > 0,
    completedAt: new Date().toISOString()
  };

  notifications.add({
    type: "agent_run",
    status: result.degraded ? "degraded" : "success",
    ownerId: null,
    relatedItemId: null,
    legalEvidenceId: null,
    title: "گزارش عامل پایش قوانین شاه‌اثر",
    message: `همگام‌سازی خودکار انجام شد: ${result.updated} رکورد جدید/تغییریافته، ${result.failed} خطا.`,
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
  watches
};
