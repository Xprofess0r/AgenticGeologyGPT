/**
 * graph.js  (v4.0 — Fixed)
 *
 * ROOT CAUSES FIXED:
 *  1. REMOVED isGeologyQuery() keyword gate — was blocking valid queries like
 *     "what is Bowen's series?" (no keyword match) or "explain subduction"
 *  2. REMOVED decideRoute() keyword heuristic — needsWeb was always false
 *     which meant web search NEVER triggered for most queries
 *  3. NEW smart routing: always try RAG, trigger web when RAG score is low
 *     OR query has temporal signals — decided AFTER retrieval, not before
 *  4. selfCorrector weak-answer retry now also enables web search
 *
 * Call budget per request (free tier safe):
 *   Normal (RAG hits):    1 embed + 1 Gemini  = 2 API calls
 *   Normal (RAG miss):    1 embed + 1 web + 1 Gemini = 3 API calls
 *   Retry:                +1 Gemini
 */

import { v4 as uuidv4 }     from "uuid";
import { createRunLogger }   from "../utils/logger.js";
import { retrieverNode }     from "./nodes/retriever.js";
import { webSearchNode }     from "./nodes/webSearch.js";
import { reasoningNode }     from "./nodes/reasoning.js";
import { selfCorrectorNode } from "./nodes/selfCorrector.js";

const sessionStore       = new Map();
const MAX_SESSION_MEMORY = 6;

// Temporal signals => web search is proactively useful
const TEMPORAL_SIGNALS = [
  "latest", "recent", "current", "2024", "2025", "2026",
  "new research", "just published", "today", "this year",
  "news", "update", "discovery",
];

function hasTemporalSignal(query) {
  const q = query.toLowerCase();
  return TEMPORAL_SIGNALS.some((s) => q.includes(s));
}

// ── Main agent graph ──────────────────────────────────────────

export async function runAgentGraph(query, messages = [], sessionId = "default") {
  const runId  = uuidv4().slice(0, 8);
  const logger = createRunLogger(runId, query, sessionId);

  logger.logStep("graph", `Run started — runId=${runId}`);

  const sessionMemory = sessionStore.get(sessionId) || [];

  // Always try RAG; proactively add web for temporal queries
  const wantsWeb = hasTemporalSignal(query);
  let route = wantsWeb ? "parallel" : "rag";
  logger.setRoute(route);
  logger.logStep("graph", `Initial route: ${route} (temporal=${wantsWeb})`);

  let state = {
    query, messages, sessionId, sessionMemory, logger,
    route,
    needsRAG: true,
    needsWeb: wantsWeb,
    ragChunks: [], webResults: [],
    answer: null, confidence: 0,
    evaluation: null, needsRetry: false, retryCount: 0,
  };

  // Step 1: Always retrieve from RAG (embed query, query Pinecone)
  state = await retrieverNode(state);

  // Step 2: If RAG returned weak results, enable web search as fallback
  const ragIsWeak = state.ragChunks.length === 0
    || state.ragChunks.every((c) => (c.score || 0) < 0.45);

  if (!state.needsWeb && ragIsWeak) {
    logger.logStep("graph", `RAG weak (${state.ragChunks.length} chunks) → enabling web fallback`);
    state = { ...state, needsWeb: true };
  }

  state = await webSearchNode(state);

  // Compute final route label for UI
  const finalRoute = computeRoute(state.ragChunks, state.webResults);
  state = { ...state, route: finalRoute };
  logger.setRoute(finalRoute);

  // Step 3: Reasoning + self-correction (max 2 Gemini calls total)
  let attempts = 0;
  do {
    if (attempts > 0) {
      logger.logStep("graph", `Retry ${attempts} — broadening retrieval + enabling web`);
      const enriched = await retrieverNode({ ...state, needsRAG: true, retryTopK: 8 });
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

  // Build source lists
  const docSources = (state.ragChunks || []).map((c) => ({
    type:       "document",
    label:      c.source?.replace(/_/g, " ").replace(/\.pdf$/i, "") || "Uploaded Notes",
    preview:    (c.text?.slice(0, 130) || "") + "…",
    score:      Math.round((c.score || 0) * 100) / 100,
    chunkIndex: c.chunkIndex,
  }));

  const webSources = (state.webResults || []).map((r) => ({
    type:    "web",
    label:   r.title || "Web Result",
    url:     r.url,
    preview: (r.snippet?.slice(0, 130) || "") + "…",
    score:   Math.round((r.score || 0.7) * 100) / 100,
  }));

  const logEntry = logger.flush();

  return {
    answer:     state.answer,
    sources:    [...docSources, ...webSources],
    confidence: state.confidence,
    route:      state.route,
    evaluation: state.evaluation,
    steps:      logEntry.steps,
    runId,
  };
}

function computeRoute(ragChunks, webResults) {
  const hasRag = ragChunks && ragChunks.length > 0;
  const hasWeb = webResults && webResults.length > 0;
  if (hasRag && hasWeb) return "parallel";
  if (hasRag)           return "rag";
  if (hasWeb)           return "web";
  return "direct";
}

export function clearSession(sessionId) { sessionStore.delete(sessionId); }
export function getSessionMemory(sessionId) { return sessionStore.get(sessionId) || []; }