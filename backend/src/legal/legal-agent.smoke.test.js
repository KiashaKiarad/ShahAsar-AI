const test = require("node:test");
const assert = require("node:assert/strict");

test("legal agent module loads without syntax/runtime initialization errors", () => {
  const agent = require("./legal-agent");
  assert.equal(typeof agent.runLegalAgentOnce, "function");
  assert.equal(typeof agent.startLegalAgent, "function");
  assert.equal(typeof agent.extractPdfText, "function");
});
