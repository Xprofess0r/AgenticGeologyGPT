// /**
//  * embeddingService.js (Cohere - FIXED SDK)
//  */

// import { CohereClient } from "cohere-ai";

// const cohere = new CohereClient({
//   token: process.env.COHERE_API_KEY,
// });

// // ── Single text → embedding ───────────────────────────────────

// export async function embedText(text, type = "search_document") {
//   try {
//     const response = await cohere.embed({
//       texts: [text.slice(0, 8000)],
//       model: "embed-english-v3.0",
//       inputType: type, // IMPORTANT (camelCase in new SDK)
//     });

//     return response.embeddings[0];
//   } catch (err) {
//     console.error("[Embedding Error]", err.message);
//     throw err;
//   }
// }

// // ── Batch embed ───────────────────────────────────────────────

// export async function embedBatch(texts) {
//   try {
//     const response = await cohere.embed({
//       texts: texts.map(t => t.slice(0, 8000)),
//       model: "embed-english-v3.0",
//       inputType: "search_document",
//     });

//     return response.embeddings;
//   } catch (err) {
//     console.error("[Batch Embedding Error]", err.message);
//     throw err;
//   }
// }

/**
 * embeddingService.js  (v4.0 — Switched to Gemini, dropped Cohere)
 *
 * WHY SWITCH FROM COHERE TO GEMINI EMBEDDINGS:
 *  - Cohere free tier: 100 calls/min, limited batch size → quota exhaustion
 *  - Gemini text-embedding-004: same free key you already use, 1500 req/min
 *  - Dimension: 768 (Cohere embed-english-v3.0 was 1024) → update Pinecone index
 *  - One SDK, one API key, one bill = simpler for deployment
 *
 * PINECONE NOTE: If your existing index is 1024-dim you must delete it and
 * recreate with dimension: 768, OR keep PINECONE_DIMENSION=1024 and use
 * taskType workaround below. We default to 768.
 */

import dotenv from "dotenv";
dotenv.config();

const EMBEDDING_MODEL = "gemini-embedding-001"; // 768-dim, free tier 1500 RPM
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ── Single text → embedding vector ───────────────────────────
export async function embedText(text, taskType = "RETRIEVAL_QUERY") {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const url = `${BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: text.slice(0, 8000) }] },
    taskType, // RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for queries
    outputDimensionality: 1024
  };

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini Embedding HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const values = data?.embedding?.values;
  if (!values || values.length === 0) throw new Error("Empty embedding response");
  return values;
}

// ── Batch embed with rate-limit protection ────────────────────
// Gemini embedding: 1500 RPM free tier → safe at 50ms delay between calls
export async function embedBatch(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const embeddings = [];
  for (let i = 0; i < texts.length; i++) {
    if (i > 0 && i % 20 === 0) {
      // Brief pause every 20 requests to stay well under rate limit
      await new Promise((r) => setTimeout(r, 1000));
    }
    const vec = await embedText(texts[i], taskType);
    embeddings.push(vec);
  }
  return embeddings;
}
console.log("GEMINI KEY:", process.env.GEMINI_API_KEY);