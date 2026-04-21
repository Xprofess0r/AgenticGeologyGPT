/**
 * chatController.js
 * POST /api/chat
 *
 * Runs the full agentic RAG graph and returns structured response.
 * Supports session memory via X-Session-ID header or body.sessionId.
 */

import { runAgentGraph, clearSession } from "../agents/graph.js";

export async function chat(req, res) {
  try {
    const { messages, sessionId: bodySessionId } = req.body;
    const sessionId = bodySessionId
      || req.headers["x-session-id"]
      || "default";

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const query = messages[messages.length - 1]?.content || "";

    if (!query.trim()) {
      return res.status(400).json({ error: "Last message content is empty" });
    }

    // Run full agent workflow
    const result = await runAgentGraph(query, messages, sessionId);

    res.json({
      reply:      result.answer,
      sources:    result.sources,
      confidence: result.confidence,
      route:      result.route,
      evaluation: result.evaluation,
      steps:      result.steps,
      runId:      result.runId,
    });

  } catch (err) {
    console.error("[ChatController]", err.message);
    res.status(500).json({ error: "Agent workflow failed", message: err.message });
  }
}

export async function resetSession(req, res) {
  const sessionId = req.params.sessionId || req.body.sessionId || "default";
  clearSession(sessionId);
  res.json({ success: true, message: `Session ${sessionId} cleared` });
}
