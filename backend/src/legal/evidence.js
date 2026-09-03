const crypto = require("crypto");

const SOURCE_TYPES = new Set([
  "constitution",
  "statute",
  "regulation",
  "bylaw",
  "court_decision",
  "official_guidance",
  "other_official"
]);

const SOURCE_STATUSES = new Set([
  "active",
  "amended",
  "repealed",
  "unknown"
]);

function normalizeOptionalDate(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function normalizeEvidence(input = {}) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const jurisdiction = typeof input.jurisdiction === "string" ? input.jurisdiction.trim().toUpperCase() : "";
  const sourceType = typeof input.sourceType === "string" ? input.sourceType.trim().toLowerCase() : "";
  const status = typeof input.status === "string" ? input.status.trim().toLowerCase() : "unknown";
  const publishedOn = normalizeOptionalDate(input.publishedOn);
  const effectiveFrom = normalizeOptionalDate(input.effectiveFrom);
  const effectiveTo = normalizeOptionalDate(input.effectiveTo);

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    jurisdiction,
    sourceType,
    authority: typeof input.authority === "string" ? input.authority.trim() : "",
    title,
    citation: typeof input.citation === "string" ? input.citation.trim() : "",
    article: typeof input.article === "string" ? input.article.trim() : "",
    paragraph: typeof input.paragraph === "string" ? input.paragraph.trim() : "",
    text,
    sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl.trim() : "",
    publishedOn,
    effectiveFrom,
    effectiveTo,
    status,
    retrievedAt: normalizeOptionalDate(input.retrievedAt) || new Date().toISOString().slice(0, 10),
    contentHash: crypto.createHash("sha256").update(text, "utf8").digest("hex")
  };
}

function validateEvidence(evidence) {
  const errors = [];

  if (!evidence || typeof evidence !== "object") {
    return { valid: false, errors: [{ code: "invalid_type", message: "سند حقوقی نامعتبر است" }] };
  }

  if (!evidence.jurisdiction) errors.push({ code: "missing_jurisdiction", message: "حوزه قضایی سند مشخص نشده است" });
  if (!SOURCE_TYPES.has(evidence.sourceType)) errors.push({ code: "invalid_source_type", message: "نوع منبع حقوقی نامعتبر است" });
  if (!evidence.title) errors.push({ code: "missing_title", message: "عنوان سند مشخص نشده است" });
  if (!evidence.text) errors.push({ code: "missing_text", message: "متن evidence خالی است" });
  if (!evidence.authority) errors.push({ code: "missing_authority", message: "مرجع صادرکننده مشخص نشده است" });
  if (!SOURCE_STATUSES.has(evidence.status)) errors.push({ code: "invalid_status", message: "وضعیت سند نامعتبر است" });

  if (evidence.effectiveFrom && evidence.effectiveTo && evidence.effectiveFrom > evidence.effectiveTo) {
    errors.push({ code: "invalid_effective_range", message: "بازه اعتبار سند نامعتبر است" });
  }

  if (evidence.sourceUrl && !/^https?:\/\//i.test(evidence.sourceUrl)) {
    errors.push({ code: "invalid_source_url", message: "نشانی منبع باید HTTP یا HTTPS باشد" });
  }

  return { valid: errors.length === 0, errors };
}

function isEvidenceTemporallyValid(evidence, asOfDate) {
  const date = normalizeOptionalDate(asOfDate) || new Date().toISOString().slice(0, 10);
  if (evidence.effectiveFrom && date < evidence.effectiveFrom) return false;
  if (evidence.effectiveTo && date > evidence.effectiveTo) return false;
  if (evidence.status === "repealed") return false;
  return true;
}

function filterEvidence(evidenceList, { jurisdiction, asOfDate } = {}) {
  const target = typeof jurisdiction === "string" ? jurisdiction.trim().toUpperCase() : "";

  return (Array.isArray(evidenceList) ? evidenceList : []).filter((item) => {
    const evidence = normalizeEvidence(item);
    if (target && evidence.jurisdiction !== target) return false;
    if (!isEvidenceTemporallyValid(evidence, asOfDate)) return false;
    return validateEvidence(evidence).valid;
  });
}

module.exports = {
  SOURCE_TYPES,
  SOURCE_STATUSES,
  normalizeEvidence,
  validateEvidence,
  isEvidenceTemporallyValid,
  filterEvidence
};
