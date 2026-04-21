/**
 * ragService.js (FINAL - CLEAN + FREE + HIGH ACCURACY)
 */

import { chunkText } from "../utils/chunkText.js";
import { embedText, embedBatch } from "./embeddingService.js";
import { upsertVectors, querySimilar } from "./pineconeService.js";
import { v4 as uuidv4 } from "uuid";

// ── Simple domain filter (NO API CALLS) ─────────────────────

function isGeologyQuery(query) {
  const keywords = [
    "rock", "mineral", "geology", "tectonic", "earth",
    "sediment", "stratigraphy", "fault", "fold",
    "geomorphology", "hydrogeology", "GIS", "DEM"
  ];

  const q = query.toLowerCase();
  return keywords.some(k => q.includes(k));
}

// ── Ingest PDF ───────────────────────────────────────────────

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

  console.log(`[RAG] Stored ${chunks.length} chunks`);
  return { chunksCount: chunks.length, source };
}

// ── Retrieve Context (OPTIMIZED) ─────────────────────────────

export async function retrieveContext(query, topK = 6) {
  try {
    // 🔴 1. Domain filter (FREE + FAST)
    if (!isGeologyQuery(query)) {
      return [{
        text: "I can only help with geology-related topics.",
        source: "system",
        chunkIndex: -1,
        score: 1
      }];
    }

    // 🔴 2. Query embedding
    const queryEmbedding = await embedText(query);

    // 🔴 3. Retrieve more candidates
    const results = await querySimilar(queryEmbedding, topK);

    // 🔴 4. Strong filtering (IMPORTANT)
    const strong = results.filter(r => r.score > 0.65);

    if (strong.length === 0) {
      console.warn("[RAG] No strong matches, fallback.");
      return results.slice(0, 3);
    }

    // 🔥 5. Manual reranking (FREE alternative to Cohere)
    const reranked = strong.sort((a, b) => {
      const lenScoreA = a.text.length > 200 ? 0.05 : 0;
      const lenScoreB = b.text.length > 200 ? 0.05 : 0;
      return (b.score + lenScoreB) - (a.score + lenScoreA);
    });

    console.log(
      `[RAG] Retrieved ${results.length} → filtered ${strong.length} → final ${reranked.length}`
    );

    return reranked.slice(0, 3);

  } catch (err) {
    console.error("[RAG] retrieveContext error:", err.message);
    return [];
  }
}