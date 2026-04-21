import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import chatRouter   from "./routes/chat.js";
import explainRouter from "./routes/explain.js";
import uploadRouter  from "./routes/upload.js";
import logsRouter    from "./routes/logs.js";



const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────
app.use("/api/chat",    chatRouter);
app.use("/api/explain", explainRouter);
app.use("/api/upload",  uploadRouter);
app.use("/api/logs",    logsRouter);

// ── Health check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:   "GeologyGPT Agentic API 🪨",
    version:  "3.0.0",
    features: ["agentic-rag", "web-search", "self-correction", "session-memory", "observability"],
  });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "PDF too large. Max 20MB." });
  }
  console.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🌍 GeologyGPT v3 Agentic → http://localhost:${PORT}`);
  console.log(`🤖 Multi-node agent: QueryAnalyzer → RAG ∥ WebSearch → Reasoning → SelfCorrector`);
  console.log(`📋 Logs: http://localhost:${PORT}/api/logs\n`);
});
