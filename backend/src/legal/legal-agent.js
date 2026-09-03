const crypto = require("crypto");
const { URL } = require("url");
const axios = require("axios");
const { validateSourceUrl } = require("./ingestion-policy");
const { ingestEvidence } = require("./ingestor");
const { localRag } = require("./local-rag");
const { createNotificationStore } = require("./notification-store");
const { createLegalWatchStore } = require("./legal-watch-store");
const { IRAN_LEGAL_SOURCES } = require("./iran-sources");
const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");

const DEFAULT_INTERVAL_MS = Number(process.env.LEGAL_AGENT_INTERVAL_MS || 15 * 60 * 1000);
const MAX_LINKS_PER_SOURCE = Number(process.env.LEGAL_AGENT_MAX_LINKS_PER_SOURCE || 40);
const REQUEST_TIMEOUT_MS = Number(process.env.LEGAL_AGENT_DISCOVERY_TIMEOUT_MS || 10000);

const notifications = createNotificationStore();
const watches = createLegalWatchStore();

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(base, href) {
  try {
    const url = new URL(href, base);
    return url.toString();
  } catch {
    return null;
  }
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

function inferSourceType(sourceId, url, title, text) {
  const haystack = normalizeText(`${url} ${title} ${text.slice(0, 3000)}`);
  if (sourceId === "ir-judiciary") {
    if (haystack.includes("وحدت رویه")) return IRAN_SOURCE_TYPES.UNIFIED_SUPREME_COURT.code;
    if (haystack.includes("نظریه مشورتی")) return IRAN_SOURCE_TYPES.LEGAL_ADVISORY_OPINION.code;
    if (haystack.includes("هیأت عمومی")) return IRAN_SOURCE_TYPES.ADMINISTRATIVE_GENERAL_BOARD.code;
    if (haystack.includes("هیأت تخصصی")) return IRAN_SOURCE_TYPES.ADMINISTRATIVE_SPECIALIZED_BOARD.code;
    return IRAN_SOURCE_TYPES.OFFICIAL_NOTICE.code;
  }
  if (haystack.includes("بخشنامه")) return IRAN_SOURCE_TYPES.EXECUTIVE_CIRCULAR.code;
  if (haystack.includes("آیین نامه") || haystack.includes("آیین‌نامه")) return IRAN_SOURCE_TYPES.REGULATION.code;
  return IRAN_SOURCE_TYPES.STATUTE.code;
}

function inferTitle(html, fallbackUrl) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match && match[1].trim()) return match[1].replace(/\s+/g, " ").trim();
  try { return new URL(fallbackUrl).pathname.split("/").filter(Boolean).pop() || fallbackUrl; } catch { return fallbackUrl; }
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
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
  return {
    status: response.status,
    headers: response.headers,
    html: String(response.data || "")
  };
}

function extractLegalLinks(baseUrl, html) {
  const links = new Set();
  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) && links.size < MAX_LINKS_PER_SOURCE) {
    const absolute = absoluteUrl(baseUrl, match[1]);
    if (!absolute || !sameOriginAllowed(baseUrl, absolute)) continue;
    const checked = validateSourceUrl(absolute);
    if (!checked.valid) continue;
    if (/\.(css|js|png|jpg|jpeg|gif|svg|zip|mp4|mp3)(\?|$)/i.test(absolute)) continue;
    links.add(absolute);
  }
  return [...links];
}

function buildEvidence(source, url, html) {
  const text = htmlToText(html);
  if (text.length < 200) return null;
  const title = inferTitle(html, url);
  const sourceType = inferSourceType(source.id, url, title, text);
  const id = `${source.id}-${crypto.createHash("sha256").update(url).digest("hex").slice(0, 24)}`;
  return ingestEvidence({
    id,
    jurisdiction: "IR",
    sourceType,
    authority: source.name,
    title,
    citation: title,
    article: "",
    paragraph: "",
    text,
    sourceUrl: url,
    publishedOn: null,
    effectiveFrom: null,
    effectiveTo: null,
    status: "active"
  });
}

function findExisting(records, id) {
  return records.find((record) => record.id === id) || null;
}

function findRelatedWatches(evidence) {
  const haystack = normalizeText(`${evidence.title} ${evidence.citation} ${evidence.text}`);
  return watches.list({ jurisdiction: evidence.jurisdiction }).filter((watch) => {
    const terms = [watch.title, watch.metadata?.keywords || "", watch.text]
      .join(" ")
      .split(/\s+/)
      .map(normalizeText)
      .filter((term) => term.length >= 4);
    return terms.some((term) => haystack.includes(term));
  });
}

function emitLawUpdateNotifications(previous, current) {
  const existing = previous || null;
  const changed = !existing || existing.contentHash !== current.contentHash;
  if (!changed) return 0;

  let count = 0;
  const related = findRelatedWatches(current);
  for (const watch of related) {
    notifications.add({
      type: "legal_update",
      status: "new",
      ownerId: watch.ownerId,
      relatedItemId: watch.id,
      legalEvidenceId: current.id,
      jurisdiction: current.jurisdiction,
      title: `به‌روزرسانی حقوقی مرتبط با «${watch.title}»`,
      message: `مقرره/رأی «${current.title}» در پایگاه حقوقی محلی شاه‌اثر اضافه یا به‌روزرسانی شد و با مورد تحت پایش شما مرتبط تشخیص داده شد.`,
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

  for (const source of IRAN_LEGAL_SOURCES.filter((item) => item.enabled)) {
    try {
      const landing = await fetchHtml(source.url);
      const urls = [source.url, ...extractLegalLinks(source.url, landing.html)];
      for (const url of urls.slice(0, MAX_LINKS_PER_SOURCE)) {
        try {
          const page = url === source.url ? landing : await fetchHtml(url);
          const evidence = buildEvidence(source, url, page.html);
          if (evidence) candidates.push(evidence);
        } catch (error) {
          failures.push({ sourceId: source.id, url, error: error.message });
        }
      }
    } catch (error) {
      failures.push({ sourceId: source.id, url: source.url, error: error.message });
    }
  }

  const deduped = [...new Map(candidates.map((record) => [record.id, record])).values()];
  let updated = 0;
  let notificationsCreated = 0;

  if (deduped.length) {
    for (const record of deduped) {
      const previous = beforeById.get(record.id) || null;
      if (!previous || previous.contentHash !== record.contentHash) updated += 1;
      notificationsCreated += emitLawUpdateNotifications(previous, record);
    }
    localRag.addMany(deduped, { persist: true });
  }

  const result = {
    attemptedSources: IRAN_LEGAL_SOURCES.filter((item) => item.enabled).length,
    discovered: candidates.length,
    accepted: deduped.length,
    updated,
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
    message: `همگام‌سازی خودکار انجام شد: ${updated} مورد جدید/تغییریافته، ${failures.length} خطا.`,
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
