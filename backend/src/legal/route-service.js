const { createLegalRequest } = require("./core");
const { validateLegalInput } = require("./validation");

function prepareLegalRequest(body = {}) {
  const validation = validateLegalInput(body);

  if (!validation.valid) {
    const error = new Error("LEGAL_INPUT_INVALID");
    error.statusCode = validation.errors.some((item) => item.code === "too_long") ? 413 : 400;
    error.details = validation.errors;
    throw error;
  }

  return createLegalRequest(validation.value);
}

module.exports = { prepareLegalRequest };
