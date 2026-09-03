const IRAN_SOURCE_TYPES = Object.freeze({
  CONSTITUTION: { code: "constitution", name: "قانون اساسی", class: "primary_binding" },
  STATUTE: { code: "statute", name: "قانون عادی", class: "primary_binding" },
  PARLIAMENTARY_INTERPRETATION: { code: "parliamentary_interpretation", name: "تفسیر رسمی مجلس", class: "official_interpretive" },
  REGULATION: { code: "regulation", name: "آیین‌نامه و مقررات", class: "primary_official" },
  EXECUTIVE_RESOLUTION: { code: "executive_resolution", name: "تصویب‌نامه و تصمیم‌نامه", class: "primary_official" },
  EXECUTIVE_CIRCULAR: { code: "executive_circular", name: "بخشنامه", class: "official_guidance" },
  BYLAW: { code: "bylaw", name: "اساسنامه", class: "primary_official" },
  OFFICIAL_INSTRUCTION: { code: "official_instruction", name: "دستورالعمل", class: "official_guidance" },
  UNIFIED_SUPREME_COURT: { code: "unified_supreme_court", name: "رأی وحدت رویه دیوان عالی کشور", class: "judicial_authoritative" },
  ADMINISTRATIVE_GENERAL_BOARD: { code: "administrative_general_board", name: "رأی هیأت عمومی دیوان عدالت اداری", class: "judicial_authoritative" },
  ADMINISTRATIVE_SPECIALIZED_BOARD: { code: "administrative_specialized_board", name: "رأی هیأت تخصصی دیوان عدالت اداری", class: "judicial_authoritative" },
  JUDICIAL_DECISION: { code: "judicial_decision", name: "رأی قضایی", class: "judicial_authoritative" },
  LEGAL_ADVISORY_OPINION: { code: "legal_advisory_opinion", name: "نظریه مشورتی اداره حقوقی", class: "official_interpretive" },
  GUARDIAN_COUNCIL_OPINION: { code: "guardian_council_opinion", name: "نظر/مصوبه شورای نگهبان", class: "official_interpretive" },
  EXPEDIENCY_COUNCIL_DECISION: { code: "expediency_council_decision", name: "مصوبه مجمع تشخیص مصلحت نظام", class: "primary_official" },
  SUPREME_NATIONAL_SECURITY_COUNCIL: { code: "supreme_national_security_council", name: "مصوبه شورای عالی امنیت ملی", class: "primary_official" },
  SUPREME_CULTURAL_REVOLUTION_COUNCIL: { code: "supreme_cultural_revolution_council", name: "مصوبه شورای عالی انقلاب فرهنگی", class: "primary_official" },
  SUPREME_CYBERSPACE_COUNCIL: { code: "supreme_cyberspace_council", name: "مصوبه شورای عالی فضای مجازی", class: "primary_official" },
  OFFICIAL_NOTICE: { code: "official_notice", name: "ابلاغیه/اطلاعیه رسمی", class: "official_guidance" },
  HISTORICAL_VERSION: { code: "historical_version", name: "نسخه تاریخی مقرره", class: "historical_reference" }
});

function getIranSourceTypes() {
  return Object.values(IRAN_SOURCE_TYPES).map((item) => ({ ...item }));
}

function isKnownIranSourceType(code) {
  return Object.values(IRAN_SOURCE_TYPES).some((item) => item.code === code);
}

module.exports = {
  IRAN_SOURCE_TYPES,
  getIranSourceTypes,
  isKnownIranSourceType
};
