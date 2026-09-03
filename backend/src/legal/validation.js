const { isSupportedJurisdiction } = require("./country-policy");
const { normalizeLanguage } = require("./language-policy");

const MAX_MESSAGE_LENGTH = 12000;
const MAX_JURISDICTION_LENGTH = 8;
const MAX_COUNTRY_LENGTH = 2;
const MAX_LANGUAGE_LENGTH = 12;

function validateLegalInput(body = {}) {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const jurisdictionInput = body.jurisdiction == null ? "" : String(body.jurisdiction).trim().toUpperCase();
  const originCountry = body.originCountry == null ? "" : String(body.originCountry).trim().toUpperCase();
  const inputLanguage = body.inputLanguage == null ? "" : String(body.inputLanguage).trim();
  const responseLanguage = body.responseLanguage == null ? "" : String(body.responseLanguage).trim();

  const errors = [];

  if (!message) {
    errors.push({ field: "message", code: "required", message: "پیام الزامی است" });
  } else if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push({ field: "message", code: "too_long", message: "طول پیام بیش از حد مجاز است" });
  }

  if (jurisdictionInput.length > MAX_JURISDICTION_LENGTH) {
    errors.push({ field: "jurisdiction", code: "too_long", message: "حوزه قضایی نامعتبر است" });
  } else if (jurisdictionInput && !isSupportedJurisdiction(jurisdictionInput)) {
    errors.push({ field: "jurisdiction", code: "unsupported", message: "حوزه قضایی پشتیبانی نمی‌شود" });
  }

  if (originCountry.length > MAX_COUNTRY_LENGTH || (originCountry && !/^[A-Z]{2}$/.test(originCountry))) {
    errors.push({ field: "originCountry", code: "invalid", message: "کد کشور مبدأ نامعتبر است" });
  }

  if (inputLanguage.length > MAX_LANGUAGE_LENGTH || (inputLanguage && !normalizeLanguage(inputLanguage))) {
    errors.push({ field: "inputLanguage", code: "unsupported", message: "زبان ورودی پشتیبانی نمی‌شود" });
  }

  if (responseLanguage.length > MAX_LANGUAGE_LENGTH || (responseLanguage && !normalizeLanguage(responseLanguage))) {
    errors.push({ field: "responseLanguage", code: "unsupported", message: "زبان پاسخ پشتیبانی نمی‌شود" });
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      message,
      jurisdiction: jurisdictionInput || undefined,
      originCountry: originCountry || undefined,
      inputLanguage: inputLanguage || undefined,
      responseLanguage: responseLanguage || undefined
    }
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_JURISDICTION_LENGTH,
  MAX_COUNTRY_LENGTH,
  MAX_LANGUAGE_LENGTH,
  validateLegalInput
};
