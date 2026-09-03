const crypto = require("crypto");
const { URL } = require("url");
const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");
const { normalizeForSearch } = require("./retriever");
const { ingestEvidence } = require("./ingestor");

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2f;/gi, "/")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value) {
  return decodeEntities(String(value || ""))
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function extractTitle(html, fallbackUrl) {
  const title = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title && cleanText(title)) return cleanText(title);
  try {
    const url = new URL(fallbackUrl);
    const part = url.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(part || url.hostname);
  } catch {
    return fallbackUrl;
  }
}

function htmlToText(html) {
  return cleanText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n\n")
      .replace(/<\/div\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function inferSourceType(sourceId, text, url) {
  const haystack = normalizeForSearch(`${url} ${text.slice(0, 6000)}`);
  if (sourceId === "ir-judiciary") {
    if (haystack.includes("وحدت رویه")) return IRAN_SOURCE_TYPES.UNIFIED_SUPREME_COURT.code;
    if (haystack.includes("نظریه مشورتی")) return IRAN_SOURCE_TYPES.LEGAL_ADVISORY_OPINION.code;
    if (haystack.includes("هیأت عمومی")) return IRAN_SOURCE_TYPES.ADMINISTRATIVE_GENERAL_BOARD.code;
    if (haystack.includes("هیأت تخصصی")) return IRAN_SOURCE_TYPES.ADMINISTRATIVE_SPECIALIZED_BOARD.code;
    if (haystack.includes("بخشنامه")) return IRAN_SOURCE_TYPES.EXECUTIVE_CIRCULAR.code;
    return IRAN_SOURCE_TYPES.OFFICIAL_NOTICE.code;
  }
  if (haystack.includes("بخشنامه")) return IRAN_SOURCE_TYPES.EXECUTIVE_CIRCULAR.code;
  if (haystack.includes("آیین نامه") || haystack.includes("آیین‌نامه")) return IRAN_SOURCE_TYPES.REGULATION.code;
  if (haystack.includes("تصویب نامه") || haystack.includes("تصویب‌نامه")) return IRAN_SOURCE_TYPES.EXECUTIVE_RESOLUTION.code;
  return IRAN_SOURCE_TYPES.STATUTE.code;
}

function extractDate(text, labels) {
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const labelPattern = escapedLabels.join("|");
  const match = normalizeDigits(text).match(
    new RegExp(`(?:${labelPattern})\\s*[:：]?\\s*(13\\d{2}|14\\d{2})[\\/-](0?[1-9]|1[0-2])[\\/-](0?[1-9]|[12]\\d|3[01])`, "i")
  );
  if (!match) return null;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function splitArticles(text) {
  const source = cleanText(text);
  const normalized = normalizeDigits(source);
  const marker = /(?:^|\n|\s)(?:ماده|مادهٔ|ماده‌)\s*([0-9]{1,4})\s*(?:\.|-|:|：)?/giu;
  const matches = [];
  let match;
  while ((match = marker.exec(normalized))) {
    matches.push({ index: match.index, number: match[1], end: marker.lastIndex });
  }

  if (matches.length < 2) return [];

  const sections = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const end = next ? next.index : normalized.length;
    const body = cleanText(normalized.slice(current.end, end));
    if (body.length < 12) continue;
    sections.push({ article: current.number, text: body });
  }
  return sections;
}

function buildId(sourceId, url, article = "") {
  return `${sourceId}-${crypto.createHash("sha256").update(`${url}::${article}`).digest("hex").slice(0, 24)}`;
}

function parseLegalPage({ source, url, html }) {
  const title = extractTitle(html, url);
  const text = htmlToText(html);
  if (text.length < 80) return [];

  const sourceType = inferSourceType(source.id, text, url);
  const publishedOn = extractDate(text, ["تاریخ تصویب", "تاریخ انتشار", "تاریخ صدور", "تاریخ ابلاغ", "تصویب"]);
  const effectiveFrom = extractDate(text, ["تاریخ اجرا", "لازم الاجرا", "لازم‌الاجرا", "تاریخ لازم الاجرا"]);
  const articles = splitArticles(text);
  const common = {
    jurisdiction: "IR",
    sourceType,
    authority: source.name,
    title,
    sourceUrl: url,
    publishedOn,
    effectiveFrom,
    effectiveTo: null,
    status: "active"
  };

  if (!articles.length) {
    return [ingestEvidence({
      ...common,
      id: buildId(source.id, url),
      citation: title,
      article: "",
      paragraph: "",
      text
    })];
  }

  return articles.map((item) => ingestEvidence({
    ...common,
    id: buildId(source.id, url, item.article),
    citation: `${title}، ماده ${item.article}`,
    article: item.article,
    paragraph: "",
    text: item.text
  }));
}

module.exports = {
  cleanText,
  htmlToText,
  inferSourceType,
  extractDate,
  splitArticles,
  parseLegalPage
};
