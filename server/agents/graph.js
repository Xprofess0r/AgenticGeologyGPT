/**
 * graph.js  (v3.1)
 *
 * Key changes:
 *  1. Geology gate at entry — rejects off-topic with zero API calls
 *  2. queryAnalyzer merged INTO reasoning (1 Gemini call instead of 2)
 *  3. selfCorrector no longer calls Gemini for eval — uses heuristics only
 *     (saves 1 call per request, total: 1 call per non-retried request)
 *
 * Call budget per request:
 *   Off-topic:      0 Gemini calls
 *   Normal:         1 Gemini call  (reasoning node)
 *   Retry:          2 Gemini calls (reasoning × 2)
 */

import { v4 as uuidv4 }        from "uuid";
import { createRunLogger }      from "../utils/logger.js";
import { isGeologyQuery, OFF_TOPIC_REPLY } from "../services/geminiService.js";
import { retrieverNode }        from "./nodes/retriever.js";
import { webSearchNode }        from "./nodes/webSearch.js";
import { reasoningNode }        from "./nodes/reasoning.js";
import { selfCorrectorNode }    from "./nodes/selfCorrector.js";

const sessionStore      = new Map();
const MAX_SESSION_MEMORY = 6;

// ── Route decision — pure heuristic, no API call ──────────────

function decideRoute(query) {
  const q = query.toLowerCase();

  const notesSignals = [
    "my notes", "uploaded", "document", "pdf", "according to",
    "in the file", "from my", "i uploaded", "the notes say",
  ];
  const webSignals = [
    "latest", "recent", "current", "2024", "2025", "new research",
    "just published", "today", "this year", "news",
  ];

  const wantsNotes = notesSignals.some((s) => q.includes(s));
  const wantsWeb   = webSignals.some((s) => q.includes(s));

  if (wantsNotes && wantsWeb) return { route: "parallel", needsRAG: true,  needsWeb: true  };
  if (wantsNotes)              return { route: "rag",      needsRAG: true,  needsWeb: false };
  if (wantsWeb)                return { route: "web",      needsRAG: false, needsWeb: true  };
  // Default: try RAG first, always worth checking
  return                              { route: "parallel", needsRAG: true,  needsWeb: false };
}

// ── Main agent graph ──────────────────────────────────────────

export async function runAgentGraph(query, messages = [], sessionId = "default") {
  const runId  = uuidv4().slice(0, 8);
  const logger = createRunLogger(runId, query, sessionId);

  logger.logStep("graph", `Run started — runId=${runId}`);

  // ── GEOLOGY GATE — zero API calls ─────────────────────────────
  if (!isGeologyQuery(query)) {
    logger.logStep("graph", "Off-topic query rejected by geology gate");
    logger.setAnswer(OFF_TOPIC_REPLY, 0);
    logger.flush();
    return {
      answer:     OFF_TOPIC_REPLY,
      sources:    [],
      confidence: 0,
      route:      "rejected",
      evaluation: null,
      steps:      [{ node: "geologyGate", detail: "Query is not geology-related", ts: 0 }],
      runId,
    };
  }

  // ── Session memory ─────────────────────────────────────────────
  const sessionMemory = sessionStore.get(sessionId) || [];

  // ── Routing (heuristic — no API call) ─────────────────────────
  const { route, needsRAG, needsWeb } = decideRoute(query);
  logger.setRoute(route);
  logger.logStep("graph", `Route: ${route} (heuristic)`);

  let state = {
    query, messages, sessionId, sessionMemory, logger,
    route, needsRAG, needsWeb,
    ragChunks: [], webResults: [],
    answer: null, confidence: 0,
    evaluation: null, needsRetry: false, retryCount: 0,
  };

  // ── Parallel / sequential retrieval ───────────────────────────
  if (needsRAG && needsWeb) {
    const [ragState, webState] = await Promise.all([
      retrieverNode({ ...state }),
      webSearchNode({ ...state }),
    ]);
    state = { ...state, ragChunks: ragState.ragChunks, webResults: webState.webResults };
  } else {
    state = await retrieverNode(state);
    state = await webSearchNode(state);
  }

  // ── Reasoning + self-correction loop (max 2 Gemini calls total) 
  let attempts = 0;
  do {
    if (attempts > 0) {
      logger.logStep("graph", `Retry ${attempts} — re-retrieving with broader k`);
      const enriched = await retrieverNode({ ...state, needsRAG: true });
      state = { ...state, ragChunks: enriched.ragChunks };
    }

    state = await reasoningNode(state);     // 1 Gemini call
    state = await selfCorrectorNode(state); // 0 Gemini calls (heuristic only)
    attempts++;
  } while (state.needsRetry && attempts < 2);

  // ── Update session memory ─────────────────────────────────────
  if (state.answer && !state.answer.includes("⚠️") && !state.answer.includes("🪨")) {
    const kp = `Q: ${query.slice(0, 60)} → ${state.answer.slice(0, 100)}`;
    sessionStore.set(sessionId, [...sessionMemory, kp].slice(-MAX_SESSION_MEMORY));
  }

  // ── Build sources ─────────────────────────────────────────────
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

export function clearSession(sessionId) { sessionStore.delete(sessionId); }
export function getSessionMemory(sessionId) { return sessionStore.get(sessionId) || []; }
