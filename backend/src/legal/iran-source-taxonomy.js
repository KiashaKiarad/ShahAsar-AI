const IRAN_SOURCE_TYPES = Object.freeze({
  CONSTITUTION: { code: "constitution", name_fa: "قانون اساسی", authority_level: "highest" },
  STATUTE: { code: "statute", name_fa: "قانون عادی", authority_level: "primary" },
  PARLIAMENTARY_INTERPRETATION: { code: "parliamentary_interpretation", name_fa: "تفسیر رسمی مجلس", authority_level: "primary" },
  REGULATION: { code: "regulation", name_fa: "آیین‌نامه و مقررات", authority_level: "delegated" },
  EXECUTIVE_DECISION: { code: "executive_decision", name_fa: "تصویب‌نامه و تصمیم‌نامه", authority_level: "delegated" },
  CIRCULAR: { code: "circular", name_fa: "بخشنامه و دستورالعمل", authority_level: "administrative" },
  CHARTER: { code: "charter", name_fa: "اساسنامه", authority_level: "delegated" },
  JUDICIAL_UNIFIED_DECISION: { code: "judicial_unified_decision", name_fa: "رأی وحدت رویه دیوان عالی کشور", authority_level: "judicial_binding" },
  ADMINISTRATIVE_COURT_DECISION: { code: "administrative_court_decision", name_fa: "رأی هیأت عمومی دیوان عدالت اداری", authority_level: "judicial_binding" },
  ADMINISTRATIVE_SPECIALIZED_DECISION: { code: "administrative_specialized_decision", name_fa: "رأی هیأت تخصصی دیوان عدالت اداری", authority_level: "judicial" },
  JUDICIAL_DECISION: { code: "judicial_decision", name_fa: "رأی قضایی", authority_level: "case_specific" },
  ADVISORY_OPINION: { code: "advisory_opinion", name_fa: "نظریه مشورتی", authority_level: "persuasive" },
  GUARDIAN_COUNCIL_OPINION: { code: "guardian_council_opinion", name_fa: "نظر و نظریه شورای نگهبان", authority_level: "constitutional" },
  EXPEDIENCY_COUNCIL_DECISION: { code: "expediency_council_decision", name_fa: "مصوبه مجمع تشخیص مصلحت نظام", authority_level: "high" },
  SUPREME_NATIONAL_SECURITY_COUNCIL_DECISION: { code: "supreme_national_security_council_decision", name_fa: "مصوبه شورای عالی امنیت ملی", authority_level: "special" },
  SUPREME_CULTURAL_REVOLUTION_COUNCIL_DECISION: { code: "supreme_cultural_revolution_council_decision", name_fa: "مصوبه شورای عالی انقلاب فرهنگی", authority_level: "special" },
  SUPREME_CYBERSPACE_COUNCIL_DECISION: { code: "supreme_cyberspace_council_decision", name_fa: "مصوبه شورای عالی فضای مجازی", authority_level: "special" },
  OFFICIAL_GUIDANCE: { code: "official_guidance", name_fa: "راهنمایی و تفسیر اداری رسمی", authority_level: "guidance" },
  OFFICIAL_NOTICE: { code: "official_notice", name_fa: "ابلاغیه و اعلامیه رسمی", authority_level: "notice" },
  HISTORICAL_VERSION: { code: "historical_version", name_fa: "نسخه تاریخی سند", authority_level: "historical" }
});

const IRAN_SOURCE_PRIORITY = Object.freeze([
  "constitution",
  "statute",
  "parliamentary_interpretation",
  "judicial_unified_decision",
  "administrative_court_decision",
  "expediency_council_decision",
  "supreme_national_security_council_decision",
  "regulation",
  "executive_decision",
  "charter",
  "circular",
  "administrative_specialized_decision",
  "judicial_decision",
  "guardian_council_opinion",
  "advisory_opinion",
  "supreme_cultural_revolution_council_decision",
  "supreme_cyberspace_council_decision",
  "official_guidance",
  "official_notice",
  "historical_version"
]);

module.exports = { IRAN_SOURCE_TYPES, IRAN_SOURCE_PRIORITY };
