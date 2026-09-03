const COUNTRY_LEGAL_SOURCES = Object.freeze({
  IR: [
    { id: "ir-qavanin", jurisdiction: "IR", tier: "primary_registry", name: "پایگاه ملی قوانین و مقررات جمهوری اسلامی ایران", url: "https://qavanin.ir/", supports: ["laws", "regulations", "amendments"], enabled: true },
    { id: "ir-judiciary", jurisdiction: "IR", tier: "primary_judicial_portal", name: "درگاه ملی قوه قضاییه", url: "https://eadil.com/", supports: ["laws", "judicial_guidance", "unified_decisions", "advisory_opinions"], enabled: true },
    { id: "ir-nezamat", jurisdiction: "IR", tier: "secondary_curated", name: "نظامات", url: "https://nezamat.ir/", supports: ["consolidated_laws", "amendments", "historical_text"], enabled: true }
  ],
  DE: [
    { id: "de-gesetze-im-internet", jurisdiction: "DE", tier: "federal_official", name: "Gesetze im Internet", url: "https://www.gesetze-im-internet.de/", supports: ["federal_statutes", "regulations", "historical_versions"], enabled: false }
  ],
  US: [
    { id: "us-congress", jurisdiction: "US", tier: "federal_official", name: "Congress.gov", url: "https://www.congress.gov/", supports: ["bills", "laws", "legislative_history"], enabled: false },
    { id: "us-govinfo", jurisdiction: "US", tier: "federal_official", name: "GovInfo", url: "https://www.govinfo.gov/", supports: ["us_code", "federal_register", "public_laws", "regulations"], enabled: false }
  ],
  AE: [
    { id: "ae-uae-legislation", jurisdiction: "AE", tier: "federal_official", name: "UAE Legislation", url: "https://uaelegislation.gov.ae/", supports: ["constitution", "federal_laws", "decree_laws", "cabinet_resolutions", "executive_regulations", "amendments", "official_policies"], enabled: false }
  ],
  SA: [
    { id: "sa-experts", jurisdiction: "SA", tier: "federal_official", name: "هيئة الخبراء بمجلس الوزراء", url: "https://laws.boe.gov.sa/", supports: ["laws", "regulations", "royal_decrees", "council_decisions", "amendments"], enabled: false },
    { id: "sa-ummalqura", jurisdiction: "SA", tier: "official_gazette", name: "جريدة أم القرى", url: "https://uqn.gov.sa/", supports: ["official_gazette", "laws", "regulations", "official_publications"], enabled: false }
  ],
  KW: [
    { id: "kw-moj", jurisdiction: "KW", tier: "justice_ministry", name: "وزارة العدل الكويتية", url: "https://www.moj.gov.kw/", supports: ["legislation", "laws", "judicial_precedents", "legal_services"], enabled: false }
  ],
  OM: [
    { id: "om-mjla", jurisdiction: "OM", tier: "justice_ministry_official", name: "وزارة العدل والشؤون القانونية", url: "https://mjla.gov.om/", supports: ["basic_law", "laws", "royal_decrees", "ministerial_decisions", "official_gazette", "annual_law_volumes"], enabled: false },
    { id: "om-omanportal", jurisdiction: "OM", tier: "government_legal_search", name: "البحث في التشريعات من وزارة الشؤون القانونية", url: "https://omanportal.gov.om/MolaLawSearch/", supports: ["legislation_search", "laws", "decrees"], enabled: false }
  ]
});

function getCountryLegalSources(jurisdiction) {
  return (COUNTRY_LEGAL_SOURCES[String(jurisdiction || "").toUpperCase()] || []).map((source) => ({ ...source, supports: [...source.supports] }));
}

function listEnabledCountrySources() {
  return Object.values(COUNTRY_LEGAL_SOURCES).flat().filter((source) => source.enabled).map((source) => ({ ...source, supports: [...source.supports] }));
}

module.exports = { COUNTRY_LEGAL_SOURCES, getCountryLegalSources, listEnabledCountrySources };
