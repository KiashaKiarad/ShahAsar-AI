const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createLegalRequest } = require("./src/legal/core");
const { localRag } = require("./src/legal/local-rag");
const { startLegalAgent, runLegalAgentOnce, notifications, watches, crawlState, DEFAULT_RECHECK_MS } = require("./src/legal/legal-agent");
const { getCountryLegalSources, listEnabledCountrySources } = require("./src/legal/country-sources");
const { countryReadiness } = require("./src/legal/country-readiness");
const { validateLegalInput } = require("./src/legal/validation");
const { LANGUAGE_POLICY, JURISDICTION_LANGUAGE } = require("./src/legal/language-policy");
require("dotenv").config();

const app = express();
const LEGAL_AGENT_CONTROL_TOKEN = process.env.LEGAL_AGENT_CONTROL_TOKEN || "";
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => res.send("OK"));
app.get("/ping", (req, res) => res.send("pong"));
app.get("/legal/rag/health", (req, res) => res.json(localRag.health()));

app.get("/legal/languages", (req, res) => res.json({ languages: LANGUAGE_POLICY, jurisdictionLanguages: JURISDICTION_LANGUAGE }));

app.get("/legal/countries", (req, res) => {
  const countries = countryReadiness.list().map((item) => ({ ...item, sources: getCountryLegalSources(item.jurisdiction) }));
  return res.json({ active: countryReadiness.active(), countries, enabledSources: listEnabledCountrySources() });
});

app.get("/legal/agent/status", (req, res) => {
  const health = localRag.health();
  const sources = ["ir-qavanin", "ir-judiciary", "ir-nezamat"].map((sourceId) => ({ sourceId, crawl: crawlState.stats(sourceId) }));
  const recentRuns = notifications.list({ type: "agent_run" }).slice(0, 10).map((item) => ({ id: item.id, createdAt: item.createdAt, status: item.status, metadata: item.metadata || null }));
  return res.json({ mode: "local-server", corpus: health, incremental: { recheckMs: DEFAULT_RECHECK_MS, conditionalRequests: true, rule: "fetch for validation, write to RAG only when content changes" }, readiness: countryReadiness.active(), sources, recentRuns });
});

app.get("/legal/laws/new", (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const items = notifications.list({ type: "new_law" }).slice(0, limit).map((item) => ({ id: item.id, createdAt: item.createdAt, title: item.title, message: item.message, citation: item.citation || null, sourceUrl: item.sourceUrl || null, legalEvidenceId: item.legalEvidenceId || null, jurisdiction: item.jurisdiction || null }));
  return res.json({ count: items.length, items });
});

app.post("/legal/agent/run-once", async (req, res) => {
  if (!LEGAL_AGENT_CONTROL_TOKEN || req.get("x-legal-agent-token") !== LEGAL_AGENT_CONTROL_TOKEN) return res.status(404).json({ error: "Not Found" });
  try { return res.json(await runLegalAgentOnce()); } catch (error) { return res.status(500).json({ error: "agent_failed", message: error.message }); }
});

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ reply: "API KEY تنظیم نشده روی سرور" });
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: message }] }, { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } });
    res.json({ reply: response.data.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err?.response?.data || err.message);
    res.status(502).json({ reply: "❌ خطا در AI" });
  }
});

app.post("/legal/chat", async (req, res) => {
  try {
    const validation = validateLegalInput(req.body);
    if (!validation.valid) return res.status(400).json({ error: "invalid_legal_input", details: validation.errors });
    const input = validation.value;
    if (input.jurisdiction && !countryReadiness.isActive(input.jurisdiction)) return res.status(409).json({ error: "JURISDICTION_NOT_READY", message: "این حوزه قضایی هنوز از نظر corpus و validation برای استفاده فعال نشده است" });

    const legalRequest = createLegalRequest(input);
    if (!legalRequest.jurisdiction) return res.status(422).json({ error: "JURISDICTION_REQUIRED", message: "حوزه حقوقی را مشخص کنید تا فقط قوانین همان حوزه بازیابی شوند" });
    if (!countryReadiness.isActive(legalRequest.jurisdiction.code)) return res.status(409).json({ error: "JURISDICTION_NOT_READY", jurisdiction: legalRequest.jurisdiction.code, message: "برای این حوزه هنوز corpus معتبر و تأییدشده فعال نشده است" });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API_KEY_NOT_CONFIGURED" });
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", { model: "openai/gpt-4o-mini", messages: [{ role: "system", content: legalRequest.systemPrompt }, { role: "user", content: legalRequest.query }] }, { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } });
    const reply = response.data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return res.status(502).json({ error: "AI_INVALID_RESPONSE" });
    return res.json({ reply, legal: { jurisdiction: legalRequest.jurisdiction, confidence: legalRequest.jurisdictionConfidence, source: legalRequest.jurisdictionSource, needsJurisdictionClarification: legalRequest.needsJurisdictionClarification, evidenceCount: legalRequest.evidence.length, knowledgeBase: legalRequest.knowledgeBase, languagePlan: legalRequest.languagePlan, retrieval: legalRequest.retrieval } });
  } catch (err) {
    console.error("Legal AI error:", err?.response?.data || err.message);
    return res.status(502).json({ error: "LEGAL_AI_ERROR" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on", PORT);
  if (process.env.LEGAL_AGENT_ENABLED !== "false") { startLegalAgent(); console.log("Legal update agent enabled"); }
});

module.exports = { app, watches, notifications, crawlState };
