// /**
//  * queryAnalyzer.js — Node 1
//  *
//  * Analyzes the user's query and decides routing:
//  *   "rag"        → query answered from uploaded notes
//  *   "web"        → needs current/recent information
//  *   "parallel"   → both RAG + web together
//  *   "direct"     → general knowledge, no retrieval needed
//  *
//  * Uses Gemini to classify intent with a lightweight prompt.
//  * Falls back to "parallel" if classification fails.
//  */

// import { callGemini } from "../../services/geminiService.js";

// const ANALYZER_SYSTEM = `You are a query routing assistant for a geology AI system.
// Classify the user's query into exactly ONE of these routing strategies:

// - "rag"      : Query is about specific content from uploaded documents/notes
// - "web"      : Query needs current, recent, or real-time information (latest research, news, current events)
// - "parallel" : Query benefits from both document context AND web search
// - "direct"   : Simple geology concept question answerable from training knowledge alone

// Reply ONLY with a JSON object, nothing else:
// {"route": "<route>", "reason": "<one sentence why>", "needsRAG": <bool>, "needsWeb": <bool>}`;

// export async function queryAnalyzerNode(state) {
//   const { query, logger } = state;
//   logger.logStep("queryAnalyzer", `Analyzing: "${query.slice(0, 80)}"`);

//   try {
//     const raw = await callGemini(
//       `Classify this geology query:\n\n"${query}"`,
//       ANALYZER_SYSTEM,
//       { maxOutputTokens: 150, temperature: 0.1 }
//     );

//     // Extract JSON — handle markdown code fences
//     const jsonMatch = raw.match(/\{[\s\S]*?\}/);
//     if (!jsonMatch) throw new Error("No JSON in response");

//     const parsed = JSON.parse(jsonMatch[0]);
//     const route  = ["rag", "web", "parallel", "direct"].includes(parsed.route)
//       ? parsed.route
//       : "parallel";

//     logger.logStep("queryAnalyzer", `Route decided: ${route} — ${parsed.reason}`);
//     logger.logToolCall("queryAnalyzer", query, `route=${route}`);
//     logger.setRoute(route);

//     return {
//       ...state,
//       route,
//       needsRAG: parsed.needsRAG ?? true,
//       needsWeb: parsed.needsWeb ?? false,
//       analyzerReason: parsed.reason,
//     };
//   } catch (err) {
//     console.warn("[queryAnalyzer] Classification failed, defaulting to parallel:", err.message);
//     logger.logStep("queryAnalyzer", "Classification failed — defaulting to parallel");
//     return { ...state, route: "parallel", needsRAG: true, needsWeb: true, analyzerReason: "fallback" };
//   }
// }



/**
 * queryAnalyzer.js  (v3.1 — deprecated as standalone node)
 *
 * Routing logic has been moved to graph.js as a pure heuristic
 * (keyword-based, zero API calls) to save quota.
 *
 * This file is kept for reference. It is NOT called in the main graph.
 * If you want to re-enable Gemini-based routing (costs 1 extra call),
 * uncomment the usage in graph.js and call queryAnalyzerNode there.
 */

export async function queryAnalyzerNode(state) {
  // Routing is handled by decideRoute() in graph.js — no API call needed
  return state;
}
