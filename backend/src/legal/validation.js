const { JURISDICTIONS } = require("./jurisdiction");

const MAX_MESSAGE_LENGTH = 12000;
const MAX_JURISDICTION_LENGTH = 8;

function validateLegalInput(body = {}) {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const jurisdictionInput = body.jurisdiction == null ? "" : String(body.jurisdiction).trim().toUpperCase();

  const errors = [];

  if (!message) {
    errors.push({ field: "message", code: "required", message: "پیام الزامی است" });
  } else if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push({ field: "message", code: "too_long", message: "طول پیام بیش از حد مجاز است" });
  }

  if (jurisdictionInput.length > MAX_JURISDICTION_LENGTH) {
    errors.push({ field: "jurisdiction", code: "too_long", message: "حوزه قضایی نامعتبر است" });
  } else if (jurisdictionInput && !JURISDICTIONS[jurisdictionInput]) {
    errors.push({ field: "jurisdiction", code: "unsupported", message: "حوزه قضایی پشتیبانی نمی‌شود" });
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      message,
      jurisdiction: jurisdictionInput || undefined
    }
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_JURISDICTION_LENGTH,
  validateLegalInput
};
