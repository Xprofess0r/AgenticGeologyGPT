/**
 * controllers/chatController.js  (v4 — Python Agent Integration)
 *
 * Routes all chat queries to the Python LangGraph agent via HTTP.
 * Falls back to the original Node.js graph if Python agent is unreachable.
 *
 * POST /api/chat
 *   Body: { messages: [{role, content}], sessionId?: string }
 *   Headers: X-Session-ID (optional override)
 *
 * Response shape is backward-compatible with the React frontend.
 */

import { callPythonAgent, isPythonAgentHealthy } from "../services/pythonAgentService.js";
import { runAgentGraph, clearSession }           from "../agents/graph.js";

// ── Fallback flag — set to false to disable Node.js fallback ──
const ENABLE_NODEJS_FALLBACK = process.env.ENABLE_NODEJS_FALLBACK !== "false";

export async function chat(req, res) {
  try {
    const { messages, sessionId: bodySessionId } = req.body;
    const sessionId =
      bodySessionId || req.headers["x-session-id"] || "default";

    // ── Validation ────────────────────────────────────────────
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const query = messages[messages.length - 1]?.content?.trim() || "";
    if (!query) {
      return res.status(400).json({ error: "Last message content is empty" });
    }

    // ── Try Python agent first ────────────────────────────────
    let result = null;

    try {
      const agentResult = await callPythonAgent(query, messages);

      result = {
        reply:      agentResult.answer,
        sources:    agentResult.sources        || [],
        confidence: agentResult.is_geology ? 0.8 : 0,
        route:      agentResult.is_geology ? "python-agent" : "rejected",
        evaluation: {
          embeddingScore: agentResult.embedding_score,
          isGeology:      agentResult.is_geology,
          ragCount:       agentResult.rag_count,
          webCount:       agentResult.web_count,
          decisionReason: agentResult.decision_reason,
          latencyMs:      agentResult.latency_ms,
          method:         "python-langgraph",
        },
        steps: [
          { node: "query_node",      detail: `embedding_score=${(agentResult.embedding_score || 0).toFixed(3)}` },
          { node: "retriever_node",  detail: `rag_chunks=${agentResult.rag_count}` },
          { node: "web_search_node", detail: `web_results=${agentResult.web_count}` },
          { node: "decision_node",   detail: agentResult.decision_reason },
          { node: agentResult.is_geology ? "answer_node" : "block_node", detail: "done" },
        ],
        runId: `py-${Date.now().toString(36)}`,
      };

    } catch (pyErr) {
      console.warn("[ChatController] Python agent unavailable:", pyErr.message);

      if (!ENABLE_NODEJS_FALLBACK) {
        return res.status(503).json({
          error:   "Agent service unavailable",
          message: "Python agent is down and fallback is disabled",
        });
      }

      // ── Fallback to Node.js graph ─────────────────────────
      console.log("[ChatController] Falling back to Node.js graph");
      const fallback = await runAgentGraph(query, messages, sessionId);

      result = {
        reply:      fallback.answer,
        sources:    fallback.sources    || [],
        confidence: fallback.confidence || 0,
        route:      fallback.route      || "nodejs-fallback",
        evaluation: fallback.evaluation || null,
        steps:      fallback.steps      || [],
        runId:      fallback.runId,
        _fallback:  true,
      };
    }

    return res.json(result);

  } catch (err) {
    console.error("[ChatController]", err.message);
    return res.status(500).json({ error: "Agent workflow failed", message: err.message });
  }
}

export async function resetSession(req, res) {
  const sessionId = req.params.sessionId || req.body?.sessionId || "default";
  clearSession(sessionId);
  res.json({ success: true, message: `Session ${sessionId} cleared` });
}

export async function agentStatus(req, res) {
  const healthy = await isPythonAgentHealthy();
  res.json({
    pythonAgent:     healthy ? "online" : "offline",
    fallbackEnabled: ENABLE_NODEJS_FALLBACK,
  });
}
