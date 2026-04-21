/**
 * selfCorrector.js  (v3.1)
 *
 * Removed Gemini evaluation call — was consuming 1 extra API call per request.
 * Now uses heuristic scoring only (zero API calls).
 *
 * Still computes evaluation metrics — just via keywords/length rather than LLM.
 * Triggers retry if answer is clearly bad.
 */

const WEAK_PHRASES = [
  "i don't know", "i cannot answer", "i'm not sure",
  "⚠️", "no information available", "cannot find", "not enough context",
  "as an ai", "i don't have access",
];

const GEOLOGY_ANSWER_SIGNALS = [
  "rock", "mineral", "tectonic", "geolog", "sediment", "fossil",
  "volcanic", "earthquake", "fault", "stratum", "strata", "igneous",
  "metamorph", "erosion", "crystal", "magma", "crust", "mantle",
];

export async function selfCorrectorNode(state) {
  const { query, answer, confidence, ragChunks, logger, retryCount = 0 } = state;

  logger.logStep("selfCorrector", `Heuristic eval (confidence=${confidence}, retry=${retryCount})`);

  const lowerAnswer = answer.toLowerCase();

  // ── Weakness checks ───────────────────────────────────────────
  const isTooShort    = answer.length < 180;
  const hasWeakPhrase = WEAK_PHRASES.some((p) => lowerAnswer.includes(p));
  const isWeak        = (isTooShort || hasWeakPhrase) && retryCount < 1;

  if (isWeak) {
    const reason = isTooShort ? "Answer too short" : "Answer contains uncertainty phrase";
    logger.logStep("selfCorrector", `Weak — ${reason}. Triggering retry.`);
    return { ...state, needsRetry: true, retryCount: retryCount + 1 };
  }

  // ── Heuristic evaluation metrics ─────────────────────────────
  const answerHasGeology = GEOLOGY_ANSWER_SIGNALS.some((s) => lowerAnswer.includes(s));

  // answerRelevancy: does the answer contain geology content?
  const answerRelevancy = answer.includes("🪨") ? 0
    : answerHasGeology ? Math.min(1, 0.6 + answer.length / 3000)
    : 0.4;

  // contextPrecision: were retrieved chunks actually used?
  let contextPrecision = 0;
  if (ragChunks.length > 0) {
    const usedSources = ragChunks.filter((c) =>
      answer.toLowerCase().includes(c.source?.replace(/_/g, " ").split(".")[0].toLowerCase() || "")
      || answer.includes("[Source")
    ).length;
    contextPrecision = usedSources > 0
      ? Math.min(1, 0.5 + (usedSources / ragChunks.length) * 0.5)
      : 0.35;
  }

  const evaluation = {
    answerRelevancy:  Math.round(answerRelevancy  * 100) / 100,
    contextPrecision: Math.round(contextPrecision * 100) / 100,
    isWeak:           false,
    weakReason:       null,
    method:           "heuristic", // flag — not LLM-evaluated
  };

  logger.setEvaluation(evaluation);
  logger.logStep("selfCorrector", `OK — relevancy=${evaluation.answerRelevancy}, precision=${evaluation.contextPrecision}`);

  return { ...state, needsRetry: false, evaluation };
}
