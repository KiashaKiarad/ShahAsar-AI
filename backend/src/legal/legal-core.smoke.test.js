const assert = require("assert");
const { createLegalRequest } = require("./core");
const { IRAN_LEGAL_SEED } = require("./iran-seed");
const { retrieveEvidence } = require("./retriever");

function run() {
  assert.strictEqual(IRAN_LEGAL_SEED.length, 5, "Iran seed must contain the registered 5 Civil Code passages");

  const contractRequest = createLegalRequest({
    message: "در حقوق ایران، قراردادها و تعهدات طرفین چگونه تفسیر می‌شوند؟",
    jurisdiction: "IR",
    asOfDate: "2026-09-04"
  });

  assert.strictEqual(contractRequest.jurisdiction.code, "IR");
  assert.ok(contractRequest.evidence.length > 0, "IR request must retrieve evidence");
  assert.ok(contractRequest.evidence.every((item) => item.jurisdiction === "IR"));
  assert.ok(contractRequest.evidence.every((item) => item.sourceUrl.startsWith("https://")));

  const iranResults = retrieveEvidence(
    "اعتبار قرارداد و مسئولیت خسارت ناشی از تعهد",
    IRAN_LEGAL_SEED,
    { jurisdiction: "IR", asOfDate: "2026-09-04", topK: 3 }
  );
  assert.ok(iranResults.length >= 1, "Retriever must find at least one relevant Iran passage");
  assert.ok(iranResults[0].evidence.jurisdiction === "IR");

  const germanyBlocked = retrieveEvidence(
    "قرارداد و تعهد",
    IRAN_LEGAL_SEED,
    { jurisdiction: "DE", asOfDate: "2026-09-04", topK: 3 }
  );
  assert.strictEqual(germanyBlocked.length, 0, "Cross-jurisdiction evidence leakage must be blocked");

  const futureBlocked = retrieveEvidence(
    "قرارداد",
    [{ ...IRAN_LEGAL_SEED[0], effectiveFrom: "2027-01-01" }],
    { jurisdiction: "IR", asOfDate: "2026-09-04", topK: 3 }
  );
  assert.strictEqual(futureBlocked.length, 0, "Future-effective evidence must not be retrieved");

  console.log("Legal Core smoke test: PASS");
}

run();
