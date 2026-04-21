/**
 * reasoning.js  (v3.1)
 *
 * Changes:
 *  - Imports DR_TERRA_SYSTEM from geminiService (single source of truth)
 *  - Improved accuracy: context cited inline, strict factual instructions
 *  - Prompt trimmed to stay under token limits
 */

import { callGemini, DR_TERRA_SYSTEM } from "../../services/geminiService.js";

export async function reasoningNode(state) {
  const { query, messages, ragChunks, webResults, route, logger, sessionMemory } = state;

  logger.logStep("reasoning", `Synthesizing (route=${route}, chunks=${ragChunks.length}, web=${webResults.length})`);

  // ── Context block ─────────────────────────────────────────────
  let contextBlock = "";

  if (ragChunks.length > 0) {
    const chunkText = ragChunks
      .map((c, i) =>
        `[Source ${i + 1} — ${c.source?.replace(/_/g, " ")}, ${Math.round((c.score || 0) * 100)}% relevant]\n${c.text}`
      )
      .join("\n\n---\n\n");
    contextBlock += `\n=== UPLOADED DOCUMENT CONTEXT ===\n${chunkText}\n=== END ===\n`;
  }

  if (webResults.length > 0) {
    const webText = webResults
      .map((r, i) => `[Web ${i + 1} — ${r.title}]\n${r.url}\n${r.snippet}`)
      .join("\n\n---\n\n");
    contextBlock += `\n=== WEB RESULTS ===\n${webText}\n=== END ===\n`;
  }

  // ── Conversation history (last 6 messages only) ───────────────
  const history = (messages || [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Student" : "Dr. Terra"}: ${m.content}`)
    .join("\n\n");

  // ── Session memory ─────────────────────────────────────────────
  const memBlock = sessionMemory?.length > 0
    ? `[Prior context from this session]\n${sessionMemory.slice(-4).join("\n")}\n\n`
    : "";

  // ── Accuracy instruction ──────────────────────────────────────
  const accuracyInstruction = contextBlock
    ? `IMPORTANT: Base your answer primarily on the provided context above.
Cite [Source N] or [Web N] inline when using specific facts from context.
If context contradicts your training data, prefer the context.
Do NOT fabricate data, measurements, or citations.`
    : `Answer from your geology expertise. Be precise — do not fabricate data or properties.`;

  const prompt = `${memBlock}${contextBlock}
${accuracyInstruction}

${history}`;

  try {
    const answer = await callGemini(prompt, DR_TERRA_SYSTEM, {
      maxOutputTokens: 1800,
      temperature:     0.6, // slightly lower = more factual
    });

    const confidence = computeConfidence(ragChunks, webResults, route, answer);
    logger.logStep("reasoning", `Done — ${answer.length} chars, confidence=${confidence}`);
    logger.setAnswer(answer, confidence);

    return { ...state, answer, confidence, reasoningDone: true };
  } catch (err) {
    console.error("[reasoning] Error:", err.message);
    logger.logStep("reasoning", `Error: ${err.message}`);
    return {
      ...state,
      answer:        "⚠️ Dr. Terra is temporarily unavailable. Please try again in a moment.",
      confidence:    0,
      reasoningDone: false,
    };
  }
}

function computeConfidence(ragChunks, webResults, route, answer) {
  const avgRag = ragChunks.length > 0
    ? ragChunks.reduce((s, c) => s + (c.score || 0), 0) / ragChunks.length
    : 0;

  let score = 0.55;
  if (route === "direct")   score = 0.75;
  if (route === "rag")      score = 0.55 + avgRag * 0.4;
  if (route === "web")      score = webResults.length > 0 ? 0.72 : 0.45;
  if (route === "parallel") score = 0.55 + avgRag * 0.25 + (webResults.length > 0 ? 0.1 : 0);

  if (answer.length < 200) score -= 0.1;
  if (answer.includes("⚠️") || answer.includes("🪨")) score = 0.05;

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}
