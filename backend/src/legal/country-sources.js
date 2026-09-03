const COUNTRY_LEGAL_SOURCES = Object.freeze({
  IR: [
    {
      id: "ir-qavanin",
      jurisdiction: "IR",
      tier: "primary_registry",
      name: "پایگاه ملی قوانین و مقررات جمهوری اسلامی ایران",
      url: "https://qavanin.ir/",
      supports: ["laws", "regulations", "amendments"],
      enabled: true
    },
    {
      id: "ir-judiciary",
      jurisdiction: "IR",
      tier: "primary_judicial_portal",
      name: "درگاه ملی قوه قضاییه",
      url: "https://eadil.com/",
      supports: ["laws", "judicial_guidance", "unified_decisions", "advisory_opinions"],
      enabled: true
    },
    {
      id: "ir-nezamat",
      jurisdiction: "IR",
      tier: "secondary_curated",
      name: "نظامات",
      url: "https://nezamat.ir/",
      supports: ["consolidated_laws", "amendments", "historical_text"],
      enabled: true
    }
  ],
  DE: [
    {
      id: "de-gesetze-im-internet",
      jurisdiction: "DE",
      tier: "federal_official",
      name: "Gesetze im Internet",
      url: "https://www.gesetze-im-internet.de/",
      supports: ["federal_statutes", "regulations", "historical_versions"],
      enabled: false
    }
  ],
  US: [
    {
      id: "us-congress",
      jurisdiction: "US",
      tier: "federal_official",
      name: "Congress.gov",
      url: "https://www.congress.gov/",
      supports: ["bills", "laws", "legislative_history"],
      enabled: false
    },
    {
      id: "us-govinfo",
      jurisdiction: "US",
      tier: "federal_official",
      name: "GovInfo",
      url: "https://www.govinfo.gov/",
      supports: ["us_code", "federal_register", "public_laws", "regulations"],
      enabled: false
    }
  ]
});

function getCountryLegalSources(jurisdiction) {
  return (COUNTRY_LEGAL_SOURCES[String(jurisdiction || "").toUpperCase()] || []).map((source) => ({
    ...source,
    supports: [...source.supports]
  }));
}

function listEnabledCountrySources() {
  return Object.values(COUNTRY_LEGAL_SOURCES).flat().filter((source) => source.enabled)
    .map((source) => ({ ...source, supports: [...source.supports] }));
}

module.exports = { COUNTRY_LEGAL_SOURCES, getCountryLegalSources, listEnabledCountrySources };
