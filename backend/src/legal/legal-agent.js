"use strict";

const fs = require("fs");
const { URL } = require("url");
const { spawn } = require("child_process");
const crypto = require("crypto");
const axios = require("axios");
const { validateSourceUrl } = require("./ingestion-policy");
const { parseLegalPage } = require("./corpus-parser");
const { discoverSourceUrls } = require("./corpus-discovery");
const { createCrawlState } = require("./crawl-state");
const { localRag } = require("./local-rag");
const { createNotificationStore } = require("./notification-store");
const { createLegalWatchStore } = require("./legal-watch-store");
const { COUNTRY_LEGAL_SOURCES, listEnabledCountrySources } = require("./country-sources");
const { SUPPORTED_JURISDICTIONS, isSupportedJurisdiction } = require("./country-policy");
const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");
const { ingestEvidence } = require("./ingestor");

const DEFAULT_INTERVAL_MS = Number(process.env.LEGAL_AGENT_INTERVAL_MS || 15 * 60 * 1000);
const DEFAULT_RECHECK_MS = Number(process.env.LEGAL_AGENT_RECHECK_MS || 24 * 60 * 60 * 1000);
const MAX_DISCOVERY_LINKS = Math.min(Number(process.env.LEGAL_AGENT_DISCOVERY_LIMIT || 5000), 5000);
const MAX_URLS_PER_RUN = Math.min(Number(process.env.LEGAL_AGENT_URLS_PER_RUN || 120), 120);
const MAX_RECORDS_PER_RUN = Math.min(Number(process.env.LEGAL_AGENT_RECORDS_PER_RUN || 10000), 10000);
const MAX_RUN_BYTES = Math.min(Number(process.env.LEGAL_AGENT_MAX_RUN_BYTES || 512 * 1024 * 1024), 512 * 1024 * 1024);
const MIN_FREE_DISK_BYTES = Math.max(Number(process.env.LEGAL_AGENT_MIN_FREE_DISK_BYTES || 2 * 1024 * 1024 * 1024), 512 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.LEGAL_AGENT_DISCOVERY_TIMEOUT_MS || 10000);
const MAX_DOCUMENT_BYTES = Math.min(Number(process.env.LEGAL_AGENT_MAX_DOCUMENT_BYTES || 8 * 1024 * 1024), 8 * 1024 * 1024);
const PDF_TEXT_TIMEOUT_MS = Number(process.env.LEGAL_AGENT_PDF_TIMEOUT_MS || 15000);
const PDF_TEXT_MAX_BYTES = Math.min(Number(process.env.LEGAL_AGENT_PDF_TEXT_MAX_BYTES || 2 * 1024 * 1024), 2 * 1024 * 1024);

const notifications = createNotificationStore();
const watches = createLegalWatchStore();
const crawlState = createCrawlState();

function absoluteUrl(base, href) { try { return new URL(href, base).toString(); } catch { return null; } }
function sameOriginAllowed(baseUrl, candidateUrl) { try { return new URL(baseUrl).origin === new URL(candidateUrl).origin; } catch { return false; } }
function isLikelyDocumentUrl(url) { return !/\.(css|js|png|jpg|jpeg|gif|svg|ico|zip|rar|7z|mp4|mp3|webp|woff2?|ttf)(\?|$)/i.test(url); }
function isPdfUrl(url) { return /\.pdf(?:\?|$)/i.test(url); }
function looksLikePdf(buffer) { return Buffer.isBuffer(buffer) && buffer.subarray(0, 5).toString("ascii") === "%PDF-"; }

function freeDiskBytes(targetPath = process.cwd()) {
  try {
    if (typeof fs.statfsSync !== "function") return null;
    const stat = fs.statfsSync(targetPath);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return null;
  }
}

function storageSafe() {
  const free = freeDiskBytes(process.cwd());
  return free !== null && free >= MIN_FREE_DISK_BYTES;
}

function approvedSources() {
  return listEnabledCountrySources().filter((source) => {
    if (!isSupportedJurisdiction(source.jurisdiction)) return false;
    const checked = validateSourceUrl(source.url);
    return checked.valid;
  });
}

function extractPdfText(buffer) {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftotext", ["-layout", "-", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    const output = [], errors = [];
    let outputBytes = 0, settled = false;
    const finish = (error, text) => { if (settled) return; settled = true; error ? reject(error) : resolve(text); };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(new Error("PDF_TEXT_EXTRACTION_TIMEOUT")); }, PDF_TEXT_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => { outputBytes += chunk.length; if (outputBytes > PDF_TEXT_MAX_BYTES) { clearTimeout(timer); child.kill("SIGKILL"); finish(new Error("PDF_TEXT_OUTPUT_LIMIT_EXCEEDED")); return; } output.push(chunk); });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", (error) => { clearTimeout(timer); finish(new Error(`PDF_TEXT_EXTRACTION_FAILED:${error.message}`)); });
    child.on("close", (code) => { clearTimeout(timer); if (settled) return; if (code !== 0) { const detail = Buffer.concat(errors).toString("utf8").trim(); finish(new Error(`PDF_TEXT_EXTRACTION_EXIT_${code}${detail ? `:${detail.slice(0, 300)}` : ""}`)); return; } finish(null, Buffer.concat(output).toString("utf8")); });
    child.stdin.on("error", (error) => { clearTimeout(timer); finish(new Error(`PDF_INPUT_FAILED:${error.message}`)); });
    child.stdin.end(buffer);
  });
}

async function fetchDocument(url, previous = null) {
  const checked = validateSourceUrl(url);
  if (!checked.valid) throw new Error(`SOURCE_URL_REJECTED:${checked.reason}`);
  const headers = { Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9" };
  if (previous?.etag) headers["If-None-Match"] = previous.etag;
  if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
  const response = await axios.get(checked.url.toString(), { timeout: REQUEST_TIMEOUT_MS, maxRedirects: 0, responseType: "arraybuffer", maxContentLength: MAX_DOCUMENT_BYTES, maxBodyLength: MAX_DOCUMENT_BYTES, validateStatus: (status) => (status >= 200 && status < 300) || status === 304, headers });
  const meta = { etag: response.headers.etag || previous?.etag || null, lastModified: response.headers["last-modified"] || previous?.lastModified || null, contentType: String(response.headers["content-type"] || previous?.contentType || "").toLowerCase() };
  if (response.status === 304) return { kind: "not-modified", status: 304, ...meta, bytes: 0 };
  if (response.headers.location) throw new Error("SOURCE_REDIRECT_NOT_FOLLOWED");
  const bytes = Buffer.from(response.data || []);
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error("DOCUMENT_SIZE_LIMIT_EXCEEDED");
  const pdf = meta.contentType.includes("application/pdf") || isPdfUrl(url) || looksLikePdf(bytes);
  if (pdf) { if (!looksLikePdf(bytes)) throw new Error("PDF_SIGNATURE_INVALID"); return { kind: "pdf", text: await extractPdfText(bytes), bytes: bytes.length, ...meta }; }
  return { kind: "html", text: bytes.toString("utf8"), bytes: bytes.length, ...meta };
}

function extractPageLinks(baseUrl, html, limit = MAX_DISCOVERY_LINKS) {
  const links = new Set(); const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi; let match;
  while ((match = regex.exec(String(html || ""))) && links.size < limit) { const absolute = absoluteUrl(baseUrl, match[1]); if (!absolute || !sameOriginAllowed(baseUrl, absolute) || !isLikelyDocumentUrl(absolute)) continue; if (!validateSourceUrl(absolute).valid) continue; links.add(absolute); }
  return [...links];
}

function dedupeById(records) { return [...new Map((Array.isArray(records) ? records : []).map((r) => [r.id, r])).values()]; }
function archiveChangedRecord(previous, current) { if (!previous || previous.contentHash === current.contentHash) return null; return ingestEvidence({ ...previous, id: `${previous.id}:history:${previous.contentHash.slice(0, 16)}`, sourceType: IRAN_SOURCE_TYPES.HISTORICAL_VERSION.code, status: "active", effectiveTo: current.publishedOn || new Date().toISOString().slice(0, 10) }); }
function findRelatedWatches(evidence) { const haystack = `${evidence.title} ${evidence.citation} ${evidence.article} ${evidence.text}`.toLowerCase(); return watches.list({ jurisdiction: evidence.jurisdiction }).filter((watch) => [watch.title, watch.metadata?.keywords || "", watch.text].join(" ").split(/\s+/).map((t) => t.toLowerCase().trim()).filter((t) => t.length >= 4).some((t) => haystack.includes(t))); }
function emitLawUpdateNotifications(previous, current) { if (previous && previous.contentHash === current.contentHash) return 0; let count = 0; for (const watch of findRelatedWatches(current)) { notifications.add({ type: "legal_update", status: "new", ownerId: watch.ownerId, relatedItemId: watch.id, legalEvidenceId: current.id, jurisdiction: current.jurisdiction, title: `به‌روزرسانی حقوقی مرتبط با «${watch.title}»`, message: `رکورد «${current.title}» اضافه یا تغییر کرده است.`, citation: current.citation, sourceUrl: current.sourceUrl }); count++; } notifications.add({ type: "new_law", status: "new", ownerId: null, relatedItemId: null, legalEvidenceId: current.id, jurisdiction: current.jurisdiction, title: current.title, message: "این رکورد توسط عامل خودکار پایگاه حقوقی شاه‌اثر کشف یا به‌روزرسانی شده است.", citation: current.citation, sourceUrl: current.sourceUrl }); return count + 1; }
function mergeCanonical(existing, incoming, archived) { const map = new Map(); for (const r of existing) map.set(r.id, r); for (const r of archived) map.set(r.id, r); for (const r of incoming) map.set(r.id, r); return [...map.values()]; }

async function runLegalAgentOnce() {
  if (!storageSafe()) throw new Error("LEGAL_AGENT_STORAGE_GUARD_TRIGGERED");
  const sources = approvedSources();
  if (!sources.every((source) => SUPPORTED_JURISDICTIONS.includes(source.jurisdiction))) throw new Error("LEGAL_AGENT_UNSUPPORTED_COUNTRY_BLOCKED");

  const before = localRag.list({}); const beforeById = new Map(before.map((r) => [r.id, r]));
  const candidates = [], failures = [], discoveredBySource = {}, countryStats = {};
  let visited = 0, notModified = 0, downloadedBytes = 0, budgetStopped = false;
  const cutoff = Date.now() - DEFAULT_RECHECK_MS;

  outer:
  for (const source of sources) {
    try { const discovery = await discoverSourceUrls(source, { maxLinks: MAX_DISCOVERY_LINKS }); discoveredBySource[source.id] = discovery.urls.length; failures.push(...discovery.failures.map((x) => ({ sourceId: source.id, ...x }))); crawlState.seed(source.id, [source.url, ...discovery.urls]); crawlState.requeueDue(source.id, cutoff, MAX_URLS_PER_RUN); }
    catch (error) { failures.push({ sourceId: source.id, url: source.url, error: error.message }); }
  }

  for (const source of sources) {
    const urls = crawlState.take(source.id, MAX_URLS_PER_RUN);
    for (const url of urls) {
      if (downloadedBytes >= MAX_RUN_BYTES || candidates.length >= MAX_RECORDS_PER_RUN || !storageSafe()) { budgetStopped = true; break outer; }
      try {
        if (!sameOriginAllowed(source.url, url)) throw new Error("SOURCE_ORIGIN_REJECTED");
        const previous = crawlState.getVisited(source.id, url);
        const document = await fetchDocument(url, previous);
        downloadedBytes += document.bytes || 0;
        if (document.kind === "not-modified") { crawlState.markNotModified(source.id, url, document); notModified++; continue; }
        if (document.kind === "html") crawlState.addDiscovered(source.id, extractPageLinks(url, document.text, MAX_DISCOVERY_LINKS));
        const parsed = parseLegalPage({ source, url, html: document.text });
        const room = MAX_RECORDS_PER_RUN - candidates.length;
        candidates.push(...parsed.slice(0, room));
        if (parsed.length > room) budgetStopped = true;
        const contentHash = crypto.createHash("sha256").update(document.text).digest("hex");
        crawlState.markVisited(source.id, url, { ...document, contentHash }); visited++;
      } catch (error) { crawlState.markFailed(source.id, url, error.message); failures.push({ sourceId: source.id, url, error: error.message }); }
    }
    crawlState.markRun(source.id);
    countryStats[source.jurisdiction] = [...(countryStats[source.jurisdiction] ? [countryStats[source.jurisdiction]] : []), { sourceId: source.id, crawl: crawlState.stats(source.id) }];
  }

  const deduped = dedupeById(candidates); const changed = [], archived = []; let unchanged = 0;
  for (const record of deduped) { const previous = beforeById.get(record.id) || null; if (previous && previous.contentHash === record.contentHash) { unchanged++; continue; } const historical = archiveChangedRecord(previous, record); if (historical) archived.push(historical); changed.push(record); }
  let notificationsCreated = 0; for (const record of changed) notificationsCreated += emitLawUpdateNotifications(beforeById.get(record.id) || null, record);
  if ((changed.length || archived.length) && storageSafe()) localRag.replaceAll(mergeCanonical(before, changed, archived), { persist: true });
  else if (changed.length || archived.length) throw new Error("LEGAL_AGENT_STORAGE_GUARD_TRIGGERED_BEFORE_COMMIT");

  const result = { attemptedSources: sources.length, enabledJurisdictions: [...new Set(sources.map((s) => s.jurisdiction))], discoveredBySource, countryStats, visited, notModified, downloadedBytes, budgetStopped, parsedRecords: candidates.length, acceptedRecords: deduped.length, updated: changed.length, unchanged, historicalVersions: archived.length, failed: failures.length, failures, notificationsCreated, corpusRecordCount: localRag.health().recordCount, crawl: Object.fromEntries(sources.map((s) => [s.id, crawlState.stats(s.id)])), degraded: failures.length > 0 || budgetStopped, completedAt: new Date().toISOString() };
  notifications.add({ type: "agent_run", status: result.degraded ? "degraded" : "success", ownerId: null, relatedItemId: null, legalEvidenceId: null, title: "گزارش عامل پایش و جمع‌آوری قوانین شاه‌اثر", message: `اجرای Agent: ${result.updated} رکورد تغییر/جدید، ${result.notModified} بدون تغییر و ${result.failed} خطا.`, metadata: result });
  return result;
}

function startLegalAgent(options = {}) { const intervalMs = Number(options.intervalMs || DEFAULT_INTERVAL_MS); let running = false; async function tick() { if (running) return { skipped: true, reason: "already_running" }; running = true; try { return await runLegalAgentOnce(); } finally { running = false; } } const timer = setInterval(() => { tick().catch((error) => notifications.add({ type: "agent_error", status: "error", ownerId: null, relatedItemId: null, legalEvidenceId: null, title: "خطای عامل پایش قوانین", message: error.message })); }, intervalMs); if (typeof timer.unref === "function") timer.unref(); tick().catch(() => {}); return { intervalMs, tick, stop: () => clearInterval(timer) }; }

function countryReadiness() {
  const out = {};
  for (const [code, sources] of Object.entries(COUNTRY_LEGAL_SOURCES)) {
    if (!isSupportedJurisdiction(code)) continue;
    const configured = sources.length > 0;
    const enabled = sources.some((s) => s.enabled);
    const crawls = sources.map((s) => ({ sourceId: s.id, ...crawlState.stats(s.id) }));
    const exhausted = crawls.reduce((n, x) => n + x.exhaustedFailures, 0);
    const queued = crawls.reduce((n, x) => n + x.queued, 0);
    out[code] = { configured, enabled, queued, exhaustedFailures: exhausted, sources: crawls, ready: false, reason: enabled ? "bootstrap_and_validation_required" : "not_enabled" };
  }
  return out;
}

module.exports = { DEFAULT_INTERVAL_MS, DEFAULT_RECHECK_MS, MAX_RUN_BYTES, MIN_FREE_DISK_BYTES, runLegalAgentOnce, startLegalAgent, notifications, watches, crawlState, countryReadiness, extractPdfText, freeDiskBytes };
