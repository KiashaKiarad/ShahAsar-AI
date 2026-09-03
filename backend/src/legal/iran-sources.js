const IRAN_LEGAL_SOURCES = Object.freeze([
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
]);

function getIranLegalSources() {
  return IRAN_LEGAL_SOURCES.map((source) => ({ ...source, supports: [...source.supports] }));
}

module.exports = { IRAN_LEGAL_SOURCES, getIranLegalSources };
