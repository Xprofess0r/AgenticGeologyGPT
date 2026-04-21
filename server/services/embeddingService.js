/**
 * embeddingService.js (Cohere - FIXED SDK)
 */

import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// ── Single text → embedding ───────────────────────────────────

export async function embedText(text, type = "search_document") {
  try {
    const response = await cohere.embed({
      texts: [text.slice(0, 8000)],
      model: "embed-english-v3.0",
      inputType: type, // IMPORTANT (camelCase in new SDK)
    });

    return response.embeddings[0];
  } catch (err) {
    console.error("[Embedding Error]", err.message);
    throw err;
  }
}

// ── Batch embed ───────────────────────────────────────────────

export async function embedBatch(texts) {
  try {
    const response = await cohere.embed({
      texts: texts.map(t => t.slice(0, 8000)),
      model: "embed-english-v3.0",
      inputType: "search_document",
    });

    return response.embeddings;
  } catch (err) {
    console.error("[Batch Embedding Error]", err.message);
    throw err;
  }
}