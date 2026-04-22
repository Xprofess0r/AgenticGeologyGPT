/**
 * chatController.js  (v5)
 *
 * Routes to Python LangGraph agent first, Node.js graph as fallback.
 * Maps Python agent response shape to frontend-expected shape.
 */

import { callPythonAgent, isPythonAgentHealthy } from "../services/pythonAgentService.js";
import { runAgentGraph, clearSession }           from "../agents/graph.js";

const ENABLE_NODEJS_FALLBACK = process.env.ENABLE_NODEJS_FALLBACK !== "false";

export async function chat(req, res) {
  try {
    const { messages, sessionId: bodySessionId } = req.body;
    const sessionId = bodySessionId || req.headers["x-session-id"] || "default";

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const query = messages[messages.length - 1]?.content?.trim() || "";
    if (!query) return res.status(400).json({ error: "Last message content is empty" });

    // ── Try Python agent ──────────────────────────────────────
    let result = null;

    try {
      const py = await callPythonAgent(query, messages);

      // Build step trace for frontend AgentSteps component
      const steps = [
        { node: "query_node",      detail: `rag_query="${(py.rag_query||"").slice(0,60)}"` },
        { node: "retriever_node",  detail: `rag_chunks=${py.rag_count}, embed=gemini-embedding-001` },
        { node: "web_search_node", detail: `web_results=${py.web_count}` },
        { node: "decision_node",   detail: py.decision_reason || "n/a" },
        {
          node:   py.is_geology ? "answer_node" : "block_node",
          detail: py.is_geology ? `${py.answer?.length || 0} chars` : "blocked",
        },
      ];

      result = {
        reply:      py.answer,
        sources:    py.sources         || [],
        confidence: py.is_geology ? Math.min(0.95, 0.60 + (py.rag_count || 0) * 0.07) : 0,
        route:      py.is_geology
          ? (py.rag_count > 0 && py.web_count > 0 ? "parallel"
            : py.rag_count > 0 ? "rag"
            : py.web_count > 0 ? "web"
            : "direct")
          : "rejected",
        evaluation: {
          embeddingScore: py.embedding_score,
          isGeology:      py.is_geology,
          ragCount:       py.rag_count,
          webCount:       py.web_count,
          decisionReason: py.decision_reason,
          ragQuery:       py.rag_query,
          searchQuery:    py.search_query,
          latencyMs:      py.latency_ms,
          method:         "python-langgraph-v5",
        },
        steps,
        runId: `py-${Date.now().toString(36)}`,
      };

    } catch (pyErr) {
      console.warn("[ChatController] Python agent unavailable:", pyErr.message);

      if (!ENABLE_NODEJS_FALLBACK) {
        return res.status(503).json({
          error:   "Agent service unavailable",
          message: "Python agent is down. Start it with: cd python_agent && uvicorn main:app",
        });
      }

      console.log("[ChatController] Falling back to Node.js graph");
      const fb = await runAgentGraph(query, messages, sessionId);

      result = {
        reply:      fb.answer,
        sources:    fb.sources    || [],
        confidence: fb.confidence || 0,
        route:      (fb.route || "nodejs-fallback"),
        evaluation: fb.evaluation || null,
        steps:      fb.steps      || [],
        runId:      fb.runId,
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
    model:           process.env.GEMINI_MODEL || "gemini-2.5-flash",
    embedModel:      "gemini-embedding-001 (1024-dim)",
  });
}