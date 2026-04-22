/**
 * graph.js  (v5 — Node.js fallback graph)
 *
 * This graph ONLY runs when Python agent is unreachable.
 * Primary path: Python LangGraph agent (chatController.js).
 *
 * Fixes:
 *  1. Removed isGeologyQuery() keyword gate
 *  2. Always tries RAG; enables web if RAG is weak
 *  3. No keyword-based routing — post-retrieval decisions only
 */

import { v4 as uuidv4 }     from "uuid";
import { createRunLogger }   from "../utils/logger.js";
import { retrieverNode }     from "./nodes/retriever.js";
import { webSearchNode }     from "./nodes/webSearch.js";
import { reasoningNode }     from "./nodes/reasoning.js";
import { selfCorrectorNode } from "./nodes/selfCorrector.js";

const sessionStore       = new Map();
const MAX_SESSION_MEMORY = 6;

const TEMPORAL = ["latest","recent","current","2024","2025","2026","new research","today","this year","news"];

function hasTemporalSignal(q) {
  return TEMPORAL.some((s) => q.toLowerCase().includes(s));
}

export async function runAgentGraph(query, messages = [], sessionId = "default") {
  const runId  = uuidv4().slice(0, 8);
  const logger = createRunLogger(runId, query, sessionId);
  logger.logStep("graph", `[Node.js fallback] Run started — runId=${runId}`);

  const sessionMemory = sessionStore.get(sessionId) || [];
  const wantsWeb = hasTemporalSignal(query);

  let state = {
    query, messages, sessionId, sessionMemory, logger,
    route: wantsWeb ? "parallel" : "rag",
    needsRAG: true, needsWeb: wantsWeb,
    ragChunks: [], webResults: [],
    answer: null, confidence: 0,
    evaluation: null, needsRetry: false, retryCount: 0,
  };

  // Step 1: RAG retrieval
  state = await retrieverNode(state);

  // Step 2: Enable web if RAG is weak
  const ragWeak = state.ragChunks.length === 0 ||
    state.ragChunks.every((c) => (c.score || 0) < 0.35);

  if (!state.needsWeb && ragWeak) {
    logger.logStep("graph", `RAG weak → enabling web search`);
    state = { ...state, needsWeb: true };
  }

  state = await webSearchNode(state);

  // Update route label
  const hasRag = state.ragChunks.length > 0;
  const hasWeb = state.webResults.length > 0;
  state.route = hasRag && hasWeb ? "parallel" : hasRag ? "rag" : hasWeb ? "web" : "direct";
  logger.setRoute(state.route);

  // Step 3: Reasoning + self-correction (max 2 Gemini calls)
  let attempts = 0;
  do {
    if (attempts > 0) {
      const enriched = await retrieverNode({ ...state, needsRAG: true, retryTopK: 10 });
      state = { ...state, ragChunks: enriched.ragChunks, needsWeb: true };
      state = await webSearchNode(state);
    }
    state = await reasoningNode(state);
    state = await selfCorrectorNode(state);
    attempts++;
  } while (state.needsRetry && attempts < 2);

  // Update session memory
  if (state.answer && !state.answer.startsWith("⚠️")) {
    const kp = `Q: ${query.slice(0, 60)} → ${state.answer.slice(0, 100)}`;
    sessionStore.set(sessionId, [...sessionMemory, kp].slice(-MAX_SESSION_MEMORY));
  }

  const docSources = (state.ragChunks || []).map((c) => ({
    type: "document",
    label: c.source?.replace(/_/g," ").replace(/\.pdf$/i,"") || "Uploaded Notes",
    preview: (c.text?.slice(0, 130) || "") + "…",
    score: Math.round((c.score || 0) * 100) / 100,
    chunkIndex: c.chunkIndex,
  }));

  const webSources = (state.webResults || []).map((r) => ({
    type: "web", label: r.title || "Web Result",
    url: r.url, preview: (r.snippet?.slice(0, 130) || "") + "…",
    score: Math.round((r.score || 0.7) * 100) / 100,
  }));

  const logEntry = logger.flush();
  return {
    answer: state.answer, sources: [...docSources, ...webSources],
    confidence: state.confidence, route: state.route,
    evaluation: state.evaluation, steps: logEntry.steps, runId,
  };
}

export function clearSession(sessionId) { sessionStore.delete(sessionId); }
export function getSessionMemory(sessionId) { return sessionStore.get(sessionId) || []; }