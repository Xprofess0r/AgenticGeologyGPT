/**
 * ragService.js  (v5 — Fixed)
 *
 * CHANGES FROM v4:
 *  1. REMOVED Cohere import and cohere.rerank() — was causing quota exhaustion
 *     Reranking now done by simple score-sort (free, zero API calls)
 *  2. ingestPDF now sends chunks to Python agent /ingest endpoint for embedding
 *     → keeps embedding logic in ONE place (Python, using Gemini)
 *  3. retrieveContext threshold lowered 0.65 → 0.35 (correct for gemini-embedding-001)
 *  4. embedBatch still available as fallback if Python agent is down
 */

import { chunkText }                  from "../utils/chunkText.js";
import { embedText, embedBatch }      from "./embeddingService.js";
import { upsertVectors, querySimilar } from "./pineconeService.js";
import { v4 as uuidv4 }              from "uuid";

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || "http://localhost:8000";

// ── Ingest PDF ────────────────────────────────────────────────
export async function ingestPDF(pdfBuffer, filename) {
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

  console.log(`[RAG] Parsing PDF: ${filename}`);
  const parsed  = await pdfParse(pdfBuffer);
  const rawText = parsed.text;

  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Could not extract meaningful text from PDF.");
  }

  const source = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const chunks  = chunkText(rawText, source);
  console.log(`[RAG] Split into ${chunks.length} chunks`);

  // ── Try Python agent /ingest first (uses Gemini embeddings) ──
  try {
    const res = await fetch(`${PYTHON_AGENT_URL}/ingest`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chunks, source }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[RAG] Python agent ingested ${data.chunksIndexed} chunks`);
      return { chunksCount: data.chunksIndexed, source };
    }
    console.warn(`[RAG] Python agent ingest returned ${res.status} — falling back to Node.js embed`);
  } catch (err) {
    console.warn(`[RAG] Python agent unreachable (${err.message}) — falling back to Node.js embed`);
  }

  // ── Fallback: embed in Node.js ────────────────────────────
  console.log(`[RAG] Embedding ${chunks.length} chunks in Node.js...`);
  const texts      = chunks.map((c) => c.text);
  const embeddings = await embedBatch(texts, "RETRIEVAL_DOCUMENT");

  const vectors = chunks.map((chunk, i) => ({
    id:     `${source}_chunk_${chunk.chunkIndex}_${uuidv4().slice(0, 8)}`,
    values: embeddings[i],
    metadata: {
      text:       chunk.text,
      source:     chunk.source,
      chunkIndex: chunk.chunkIndex,
      wordCount:  chunk.wordCount,
    },
  }));

  await upsertVectors(vectors);
  console.log(`[RAG] Node.js embedded and stored ${chunks.length} chunks`);
  return { chunksCount: chunks.length, source };
}

// ── Retrieve context ──────────────────────────────────────────
export async function retrieveContext(query, topK = 8) {
  try {
    // Embed with RETRIEVAL_QUERY task type
    const queryEmbedding = await embedText(query, "RETRIEVAL_QUERY");
    const results        = await querySimilar(queryEmbedding, topK);

    if (results.length === 0) {
      console.log("[RAG] No results from Pinecone");
      return [];
    }

    // Threshold appropriate for gemini-embedding-001 cosine scores
    const MIN_SCORE = 0.35;
    const filtered  = results.filter((r) => r.score >= MIN_SCORE);

    if (filtered.length === 0) {
      const best = results[0]?.score?.toFixed(3) ?? "0";
      console.warn(`[RAG] No results above ${MIN_SCORE}. Best score: ${best}. Returning top 2.`);
      return results.slice(0, 2);
    }

    // Sort descending — no Cohere rerank needed (Gemini cosine is reliable)
    const ranked = filtered.sort((a, b) => b.score - a.score);
    console.log(`[RAG] Retrieved ${results.length} → filtered ${filtered.length} chunks`);
    return ranked.slice(0, 5);

  } catch (err) {
    console.error("[RAG] retrieveContext error:", err.message);
    return [];
  }
}