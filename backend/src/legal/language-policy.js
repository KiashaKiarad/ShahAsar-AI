const { isSupportedJurisdiction } = require("./country-policy");

const LANGUAGE_POLICY = Object.freeze({
  fa: Object.freeze({ code: "fa", name: "فارسی", script: "Arab", direction: "rtl" }),
  en: Object.freeze({ code: "en", name: "English", script: "Latn", direction: "ltr" }),
  de: Object.freeze({ code: "de", name: "Deutsch", script: "Latn", direction: "ltr" }),
  tr: Object.freeze({ code: "tr", name: "Türkçe", script: "Latn", direction: "ltr" }),
  it: Object.freeze({ code: "it", name: "Italiano", script: "Latn", direction: "ltr" }),
  ar: Object.freeze({ code: "ar", name: "العربية", script: "Arab", direction: "rtl" })
});

const JURISDICTION_LANGUAGE = Object.freeze({
  IR: "fa",
  DE: "de",
  US: "en",
  AE: "ar",
  SA: "ar",
  KW: "ar",
  OM: "ar",
  TR: "tr",
  IT: "it"
});

function normalizeLanguage(value) {
  if (value == null || value === "") return undefined;
  const code = String(value).trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_POLICY[code] ? code : undefined;
}

function getLegalLanguage(jurisdiction) {
  const code = String(jurisdiction || "").trim().toUpperCase();
  return isSupportedJurisdiction(code) ? JURISDICTION_LANGUAGE[code] : undefined;
}

function resolveLanguagePlan({ originCountry, inputLanguage, responseLanguage, jurisdiction } = {}) {
  const origin = String(originCountry || "").trim().toUpperCase() || undefined;
  const legalJurisdiction = String(jurisdiction || "").trim().toUpperCase() || undefined;
  const input = normalizeLanguage(inputLanguage) || "en";
  const response = normalizeLanguage(responseLanguage) || input;
  const legal = getLegalLanguage(legalJurisdiction);

  return Object.freeze({
    originCountry: origin,
    originCountrySupportedAsJurisdiction: Boolean(origin && isSupportedJurisdiction(origin)),
    inputLanguage: input,
    responseLanguage: response,
    legalJurisdiction,
    legalLanguage: legal,
    draftingLanguage: legal,
    requiresEnglishFallback: !origin || !isSupportedJurisdiction(origin)
  });
}

module.exports = {
  LANGUAGE_POLICY,
  JURISDICTION_LANGUAGE,
  normalizeLanguage,
  getLegalLanguage,
  resolveLanguagePlan
};
