"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSourceUrl, isAllowedHost } = require("./ingestion-policy");

test("only HTTPS allowlisted official hosts are accepted", () => {
  for (const url of [
    "https://qavanin.ir/",
    "https://www.gesetze-im-internet.de/",
    "https://www.govinfo.gov/",
    "https://uaelegislation.gov.ae/",
    "https://laws.boe.gov.sa/",
    "https://www.moj.gov.kw/",
    "https://mjla.gov.om/",
    "https://resmigazete.gov.tr/",
    "https://www.normattiva.it/",
    "https://www.gazzettaufficiale.it/"
  ]) assert.equal(validateSourceUrl(url).valid, true, url);
});

test("non-approved hosts, protocols and URL credentials are rejected", () => {
  assert.equal(validateSourceUrl("http://qavanin.ir/").valid, false);
  assert.equal(validateSourceUrl("https://example.com/").valid, false);
  assert.equal(validateSourceUrl("file:///etc/passwd").valid, false);
  assert.equal(validateSourceUrl("https://user:pass@qavanin.ir/").valid, false);
  assert.equal(isAllowedHost("qavanin.ir.evil.example"), false);
});
