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



app.use(cors({
  origin: true,
  credentials: true,
}));

app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────
app.use("/api/chat",    chatRouter);
app.use("/api/explain", explainRouter);
app.use("/api/upload",  uploadRouter);
app.use("/api/logs",    logsRouter);

// ── Health ───────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({
  status:  "GeologyGPT Node.js API 🪨",
  version: "3.0.0",
  pythonAgentUrl: process.env.PYTHON_AGENT_URL || "http://localhost:8000",
  clientUrl:      process.env.CLIENT_URL       || "http://localhost:3000",
}));

// ── Error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "PDF too large. Max 20MB." });
  }
  if (err.message?.startsWith("CORS")) {
    return res.status(403).json({ error: err.message });
  }
  console.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🌍 GeologyGPT Node.js API → http://localhost:${PORT}`);
  console.log(`🐍 Python agent URL: ${process.env.PYTHON_AGENT_URL || "http://localhost:8000"}`);
  console.log(`🌐 Client URL (CORS): ${process.env.CLIENT_URL || "http://localhost:3000"}\n`);
});