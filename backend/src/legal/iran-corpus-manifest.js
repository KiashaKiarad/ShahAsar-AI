const IRAN_CORPUS_MANIFEST = Object.freeze([
  {
    id: "ir-qavanin",
    jurisdiction: "IR",
    authorityTier: "primary_registry",
    name: "پایگاه ملی قوانین و مقررات جمهوری اسلامی ایران",
    baseUrl: "https://qavanin.ir/",
    sourceTypes: [
      "constitution",
      "statute",
      "parliamentary_interpretation",
      "regulation",
      "executive_resolution",
      "bylaw",
      "historical_version"
    ],
    mode: "adapter_required"
  },
  {
    id: "ir-judiciary",
    jurisdiction: "IR",
    authorityTier: "primary_judicial_portal",
    name: "درگاه ملی قوه قضاییه",
    baseUrl: "https://eadil.com/",
    sourceTypes: [
      "executive_circular",
      "official_instruction",
      "unified_supreme_court",
      "administrative_general_board",
      "administrative_specialized_board",
      "legal_advisory_opinion",
      "judicial_decision",
      "official_notice"
    ],
    mode: "adapter_required"
  },
  {
    id: "ir-nezamat",
    jurisdiction: "IR",
    authorityTier: "secondary_curated",
    name: "نظامات",
    baseUrl: "https://nezamat.ir/",
    sourceTypes: [
      "statute",
      "regulation",
      "executive_resolution",
      "bylaw",
      "historical_version"
    ],
    mode: "adapter_required"
  }
]);

function getIranCorpusManifest() {
  return IRAN_CORPUS_MANIFEST.map((item) => ({
    ...item,
    sourceTypes: [...item.sourceTypes]
  }));
}

module.exports = { IRAN_CORPUS_MANIFEST, getIranCorpusManifest };
