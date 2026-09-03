const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createLegalRequest } = require("./src/legal/core");
const { localRag } = require("./src/legal/local-rag");
const { startLegalAgent, runLegalAgentOnce, notifications, watches, crawlState, DEFAULT_RECHECK_MS } = require("./src/legal/legal-agent");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("OK"));
app.get("/ping", (req, res) => res.send("pong"));

// سلامت RAG کاملاً محلی؛ این مسیر به منابع حقوقی خارجی وابسته نیست.
app.get("/legal/rag/health", (req, res) => res.json(localRag.health()));

// وضعیت واقعی corpus + صف agent برای کنترل و ممیزی عملیاتی.
app.get("/legal/agent/status", (req, res) => {
  const health = localRag.health();
  const sources = ["ir-qavanin", "ir-judiciary", "ir-nezamat"].map((sourceId) => ({
    sourceId,
    crawl: crawlState.stats(sourceId)
  }));
  const recentRuns = notifications.list({ type: "agent_run" }).slice(0, 10).map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    status: item.status,
    metadata: item.metadata || null
  }));
  return res.json({
    mode: "local-server",
    corpus: health,
    incremental: {
      recheckMs: DEFAULT_RECHECK_MS,
      conditionalRequests: true,
      rule: "fetch for validation, write to RAG only when content changes"
    },
    sources,
    recentRuns
  });
});

app.get("/legal/laws/new", (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const items = notifications.list({ type: "new_law" }).slice(0, limit).map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    title: item.title,
    message: item.message,
    citation: item.citation || null,
    sourceUrl: item.sourceUrl || null,
    legalEvidenceId: item.legalEvidenceId || null,
    jurisdiction: item.jurisdiction || null
  }));
  return res.json({ count: items.length, items });
});

// اجرای دستی یک چرخه ingestion فقط برای اپراتور/health-check؛ داده فقط در صورت تغییر نوشته می‌شود.
app.post("/legal/agent/run-once", async (req, res) => {
  try {
    const result = await runLegalAgentOnce();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ reply: "API KEY تنظیم نشده روی سرور" });
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      { model: "openai/gpt-4o-mini", messages: [{ role: "user", content: message }] },
      { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
    );
    res.json({ reply: response.data.choices[0].message.content });
  } catch (err) {
    console.log(err?.response?.data || err.message);
    res.json({ reply: "❌ خطا در AI" });
  }
});

app.post("/legal/chat", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const requestedJurisdiction = req.body?.jurisdiction;
    if (!message) return res.status(400).json({ error: "پیام الزامی است" });
    if (message.length > 12000) return res.status(413).json({ error: "طول پیام بیش از حد مجاز است" });

    const legalRequest = createLegalRequest({ message, jurisdiction: requestedJurisdiction });
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API KEY تنظیم نشده روی سرور" });

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: legalRequest.systemPrompt },
          { role: "user", content: legalRequest.query }
        ]
      },
      { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) return res.status(502).json({ error: "پاسخ معتبر از سرویس AI دریافت نشد" });

    return res.json({
      reply,
      legal: {
        jurisdiction: legalRequest.jurisdiction,
        confidence: legalRequest.jurisdictionConfidence,
        source: legalRequest.jurisdictionSource,
        needsJurisdictionClarification: legalRequest.needsJurisdictionClarification,
        evidenceCount: legalRequest.evidence.length,
        knowledgeBase: legalRequest.knowledgeBase,
        retrieval: legalRequest.retrieval
      }
    });
  } catch (err) {
    console.error("Legal AI error:", err?.response?.data || err.message);
    return res.status(502).json({ error: "❌ خطا در Legal AI" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on", PORT);
  if (process.env.LEGAL_AGENT_ENABLED !== "false") {
    startLegalAgent();
    console.log("Legal update agent enabled");
  }
});

module.exports = { app, watches, notifications, crawlState };
