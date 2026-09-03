const { IRAN_SOURCE_TYPES } = require("./iran-source-taxonomy");

const IRAN_SOURCE_CATALOG = Object.freeze([
  {
    id: "ir-laws",
    type: IRAN_SOURCE_TYPES.STATUTE.code,
    discovery: "official-registry",
    primarySourceId: "ir-qavanin",
    description: "قوانین عادی و قوانین خاص"
  },
  {
    id: "ir-constitution",
    type: IRAN_SOURCE_TYPES.CONSTITUTION.code,
    discovery: "official-registry",
    primarySourceId: "ir-qavanin",
    description: "قانون اساسی و نسخه‌های تاریخی"
  },
  {
    id: "ir-regulations",
    type: IRAN_SOURCE_TYPES.REGULATION.code,
    discovery: "official-registry",
    primarySourceId: "ir-qavanin",
    description: "آیین‌نامه‌ها و مقررات اجرایی"
  },
  {
    id: "ir-executive-decisions",
    type: IRAN_SOURCE_TYPES.EXECUTIVE_RESOLUTION.code,
    discovery: "official-registry",
    primarySourceId: "ir-qavanin",
    description: "تصویب‌نامه‌ها و تصمیم‌نامه‌ها"
  },
  {
    id: "ir-circulars",
    type: IRAN_SOURCE_TYPES.EXECUTIVE_CIRCULAR.code,
    discovery: "judiciary-portal",
    primarySourceId: "ir-judiciary",
    description: "بخشنامه‌ها و ابلاغیه‌های رسمی"
  },
  {
    id: "ir-unified-decisions",
    type: IRAN_SOURCE_TYPES.UNIFIED_SUPREME_COURT.code,
    discovery: "judiciary-portal",
    primarySourceId: "ir-judiciary",
    description: "آرای وحدت رویه دیوان عالی کشور"
  },
  {
    id: "ir-administrative-general-decisions",
    type: IRAN_SOURCE_TYPES.ADMINISTRATIVE_GENERAL_BOARD.code,
    discovery: "judiciary-portal",
    primarySourceId: "ir-judiciary",
    description: "آرای هیأت عمومی دیوان عدالت اداری"
  },
  {
    id: "ir-administrative-specialized-decisions",
    type: IRAN_SOURCE_TYPES.ADMINISTRATIVE_SPECIALIZED_BOARD.code,
    discovery: "judiciary-portal",
    primarySourceId: "ir-judiciary",
    description: "آرای هیأت تخصصی دیوان عدالت اداری"
  },
  {
    id: "ir-judicial-decisions",
    type: IRAN_SOURCE_TYPES.JUDICIAL_DECISION.code,
    discovery: "judiciary-portal",
    primarySourceId: "ir-judiciary",
    description: "آرای قضایی منتشرشده"
  },
  {
    id: "ir-advisory-opinions",
    type: IRAN_SOURCE_TYPES.LEGAL_ADVISORY_OPINION.code,
    discovery: "judiciary-portal",
    primarySourceId: "ir-judiciary",
    description: "نظریات مشورتی اداره حقوقی"
  },
  {
    id: "ir-nezamat-consolidated",
    type: IRAN_SOURCE_TYPES.HISTORICAL_VERSION.code,
    discovery: "curated-secondary",
    primarySourceId: "ir-nezamat",
    description: "نسخه‌های تجمیعی و تاریخی برای تطبیق"
  }
]);

function getIranSourceCatalog() {
  return IRAN_SOURCE_CATALOG.map((item) => ({ ...item }));
}

module.exports = { IRAN_SOURCE_CATALOG, getIranSourceCatalog };
