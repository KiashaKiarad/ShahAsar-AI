const JURISDICTIONS = {
  IR: {
    code: "IR",
    name_fa: "ایران",
    name_en: "Iran",
    language: "fa",
    status: "enabled"
  },
  DE: {
    code: "DE",
    name_fa: "آلمان",
    name_en: "Germany",
    language: "de",
    status: "planned"
  },
  US: {
    code: "US",
    name_fa: "ایالات متحده آمریکا",
    name_en: "United States",
    language: "en",
    status: "planned"
  }
};

const KEYWORDS = [
  { code: "IR", words: ["ایران", "ایرانی", "قانون ایران", "قوانین ایران", "دادگاه ایران", "حقوق ایران", "تهران", "تبریز", "رشت"] },
  { code: "DE", words: ["آلمان", "قانون آلمان", "حقوق آلمان", "دادگاه آلمان", "germany", "german", "deutschland", "deutsches recht"] },
  { code: "US", words: ["آمریکا", "ایالات متحده", "قانون آمریکا", "حقوق آمریکا", "دادگاه آمریکا", "united states", "american law", "us law"] }
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .trim();
}

function detectJurisdiction({ query, requestedJurisdiction } = {}) {
  const explicit = String(requestedJurisdiction || "").toUpperCase();
  if (explicit && JURISDICTIONS[explicit]) {
    return {
      jurisdiction: JURISDICTIONS[explicit],
      confidence: 1,
      source: "explicit"
    };
  }

  const text = normalizeText(query);
  const scores = Object.fromEntries(KEYWORDS.map(({ code }) => [code, 0]));

  for (const { code, words } of KEYWORDS) {
    for (const word of words) {
      if (text.includes(normalizeText(word))) scores[code] += 1;
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCode, topScore] = ranked[0] || [];

  if (!topCode || !topScore) {
    return {
      jurisdiction: null,
      confidence: 0,
      source: "undetermined"
    };
  }

  const secondScore = ranked[1]?.[1] || 0;
  const confidence = topScore === secondScore ? 0.5 : Math.min(0.95, 0.55 + topScore * 0.1);

  return {
    jurisdiction: JURISDICTIONS[topCode],
    confidence,
    source: "keyword"
  };
}

module.exports = {
  JURISDICTIONS,
  detectJurisdiction
};
