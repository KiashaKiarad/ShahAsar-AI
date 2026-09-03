const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createLegalRequest } = require("./src/legal/core");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// تست سرور
app.get("/", (req, res) => {
  res.send("OK");
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

// چت AI - مسیر موجود بدون تغییر رفتاری
app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message;

    // 🔴 اینجا خیلی مهمه
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "API KEY تنظیم نشده روی سرور",
      });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      reply: response.data.choices[0].message.content,
    });
  } catch (err) {
    console.log(err?.response?.data || err.message);

    res.json({
      reply: "❌ خطا در AI",
    });
  }
});

// مسیر افزایشی Legal AI؛ مسیر /chat و رفتار آن دست‌نخورده می‌ماند.
app.post("/legal/chat", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const requestedJurisdiction = req.body?.jurisdiction;

    if (!message) {
      return res.status(400).json({
        error: "پیام الزامی است",
      });
    }

    if (message.length > 12000) {
      return res.status(413).json({
        error: "طول پیام بیش از حد مجاز است",
      });
    }

    const legalRequest = createLegalRequest({
      message,
      jurisdiction: requestedJurisdiction,
    });

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API KEY تنظیم نشده روی سرور",
      });
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: legalRequest.systemPrompt },
          { role: "user", content: legalRequest.query },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "پاسخ معتبر از سرویس AI دریافت نشد",
      });
    }

    return res.json({
      reply,
      legal: {
        jurisdiction: legalRequest.jurisdiction,
        confidence: legalRequest.jurisdictionConfidence,
        source: legalRequest.jurisdictionSource,
        needsJurisdictionClarification: legalRequest.needsJurisdictionClarification,
        evidenceCount: legalRequest.evidence.length,
      },
    });
  } catch (err) {
    console.error("Legal AI error:", err?.response?.data || err.message);

    return res.status(502).json({
      error: "❌ خطا در Legal AI",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on", PORT);
});
