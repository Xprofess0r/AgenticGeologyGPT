/**
 * embeddingService.js  (v5)
 *
 * Gemini embeddings — gemini-embedding-001, dimension 1024.
 * Matches Python agent's embedding_service.py exactly.
 *
 * Rate limit: 1500 RPM free tier — 50ms min interval is safe.
 */

import dotenv from "dotenv";
dotenv.config();

const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIM      = 1024;   // Must match Pinecone index dimension
const BASE_URL        = "https://generativelanguage.googleapis.com/v1beta";

let _lastEmbedTime = 0;
const MIN_INTERVAL = 50; // ms

async function _rateLimit() {
  const elapsed = Date.now() - _lastEmbedTime;
  if (elapsed < MIN_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL - elapsed));
  }
  _lastEmbedTime = Date.now();
}

// ── Single embed ──────────────────────────────────────────────
export async function embedText(text, taskType = "RETRIEVAL_QUERY") {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  await _rateLimit();

  const url     = `${BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const payload = {
    model:    `models/${EMBEDDING_MODEL}`,
    content:  { parts: [{ text: text.slice(0, 8000) }] },
    taskType,
    outputDimensionality: OUTPUT_DIM,
  };

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (res.status === 429) {
      const wait = 5000 * Math.pow(2, attempt);
      console.warn(`[Embed] Rate limited — waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Gemini Embed HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const data   = await res.json();
    const values = data?.embedding?.values;
    if (!values?.length) throw new Error("Empty embedding response");
    return values;
  }

  throw new Error("Embedding failed after max retries");
}

// ── Batch embed ───────────────────────────────────────────────
export async function embedBatch(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const embeddings = [];
  for (let i = 0; i < texts.length; i++) {
    if (i > 0 && i % 10 === 0) {
      console.log(`[Embed] Progress: ${i}/${texts.length}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    embeddings.push(await embedText(texts[i], taskType));
  }
  return embeddings;
}