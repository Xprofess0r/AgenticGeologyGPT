/**
 * ragService.js (v4.2 — FINAL OPTIMIZED)
 *
 * ✔ Fixed Cohere embedding types
 * ✔ Proper threshold for Cohere
 * ✔ Added reranking (major accuracy boost)
 */

import { chunkText } from "../utils/chunkText.js";
import { embedText, embedBatch } from "./embeddingService.js";
import { upsertVectors, querySimilar } from "./pineconeService.js";
import { v4 as uuidv4 } from "uuid";
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// ── Ingest PDF ────────────────────────────────────────────────
export async function ingestPDF(pdfBuffer, filename) {
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

  console.log(`[RAG] Parsing PDF: ${filename}`);
  const parsed = await pdfParse(pdfBuffer);
  const rawText = parsed.text;

  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Could not extract meaningful text from PDF.");
  }

  const source = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const chunks = chunkText(rawText, source);

  console.log(`[RAG] Split into ${chunks.length} chunks`);

  // ✅ Cohere → search_document
  const texts = chunks.map((c) => c.text);
  const embeddings = await embedBatch(texts);

  const vectors = chunks.map((chunk, i) => ({
    id: `${source}_chunk_${chunk.chunkIndex}_${uuidv4().slice(0, 8)}`,
    values: embeddings[i],
    metadata: {
      text: chunk.text,
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
      wordCount: chunk.wordCount,
    },
  }));

  await upsertVectors(vectors);
  console.log(`[RAG] Stored ${chunks.length} chunks for "${source}"`);

  return { chunksCount: chunks.length, source };
}

// ── RERANK (IMPORTANT) ───────────────────────────────────────
async function rerankChunks(query, chunks) {
  try {
    const response = await cohere.rerank({
      query,
      documents: chunks.map((c) => c.text),
      topN: 3,
      model: "rerank-english-v3.0",
    });

    return response.results.map((r) => chunks[r.index]);
  } catch (err) {
    console.error("[Rerank Error]", err.message);
    return chunks.slice(0, 3);
  }
}

// ── Retrieve context ──────────────────────────────────────────
export async function retrieveContext(query, topK = 8) {
  try {
    // ✅ Cohere → search_query
    const queryEmbedding = await embedText(query);

    const results = await querySimilar(queryEmbedding, topK);

    if (results.length === 0) {
      console.log("[RAG] No results from Pinecone");
      return [];
    }

    // ✅ Better threshold for Cohere
    const MIN_SCORE = 0.65;

    const filtered = results.filter((r) => r.score >= MIN_SCORE);

    if (filtered.length === 0) {
      console.warn(
        `[RAG] Weak matches. Best score: ${results[0]?.score?.toFixed(3)}`
      );
      return results.slice(0, 3);
    }

    // ✅ Sort
    const ranked = filtered.sort((a, b) => b.score - a.score);

    // ✅ RERANK (BIG IMPROVEMENT)
    const reranked = await rerankChunks(query, ranked.slice(0, 5));

    console.log(
      `[RAG] Retrieved ${results.length} → filtered ${filtered.length} → reranked ${reranked.length}`
    );

    return reranked;
  } catch (err) {
    console.error("[RAG] retrieveContext error:", err.message);
    return [];
  }
}