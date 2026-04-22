
/**
 * reasoning.js  (v5 — Node.js fallback graph)
 * Only used when Python agent is down.
 */

import { callGemini, DR_TERRA_SYSTEM } from "../../services/geminiService.js";

export async function reasoningNode(state) {
  const { query, messages, ragChunks, webResults, route, logger, sessionMemory } = state;

  logger.logStep("reasoning", `Synthesizing (route=${route}, rag=${ragChunks.length}, web=${webResults.length})`);

  let contextBlock = "";

  if (ragChunks.length > 0) {
    const text = ragChunks
      .map((c, i) => `[Source ${i+1} — ${c.source?.replace(/_/g," ")}, ${Math.round((c.score||0)*100)}% relevant]\n${c.text}`)
      .join("\n\n---\n\n");
    contextBlock += `\n=== UPLOADED DOCUMENT CONTEXT ===\n${text}\n=== END ===\n`;
  }

  if (webResults.length > 0) {
    const text = webResults
      .map((r, i) => `[Web ${i+1} — ${r.title}]\n${r.url}\n${r.snippet}`)
      .join("\n\n---\n\n");
    contextBlock += `\n=== WEB RESULTS ===\n${text}\n=== END ===\n`;
  }

  const history = (messages || []).slice(-6)
    .map((m) => `${m.role === "user" ? "Student" : "Dr. Terra"}: ${m.content}`)
    .join("\n\n");

  const memBlock = sessionMemory?.length > 0
    ? `[Prior context]\n${sessionMemory.slice(-4).join("\n")}\n\n`
    : "";

  const accuracy = contextBlock
    ? "Base your answer on the provided context. Cite [Source N] or [Web N] inline."
    : "Answer from your geology expertise. Do not fabricate data.";

  const prompt = `${memBlock}${contextBlock}\n${accuracy}\n\n${history}`;

  try {
    const answer     = await callGemini(prompt, DR_TERRA_SYSTEM, { maxOutputTokens: 1800, temperature: 0.6 });
    const confidence = computeConfidence(ragChunks, webResults, route, answer);
    logger.setAnswer(answer, confidence);
    return { ...state, answer, confidence, reasoningDone: true };
  } catch (err) {
    logger.logStep("reasoning", `Error: ${err.message}`);
    return { ...state, answer: "⚠️ Dr. Terra is temporarily unavailable. Please try again.", confidence: 0 };
  }
}

function computeConfidence(ragChunks, webResults, route, answer) {
  const avgRag = ragChunks.length > 0
    ? ragChunks.reduce((s, c) => s + (c.score || 0), 0) / ragChunks.length : 0;
  let score = 0.55;
  if (route === "rag")      score = 0.55 + avgRag * 0.4;
  if (route === "web")      score = webResults.length > 0 ? 0.72 : 0.45;
  if (route === "parallel") score = 0.55 + avgRag * 0.25 + (webResults.length > 0 ? 0.1 : 0);
  if (route === "direct")   score = 0.75;
  if (answer.length < 200)  score -= 0.1;
  if (answer.startsWith("⚠️")) score = 0.05;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}