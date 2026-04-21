/**
 * pineconeService.js
 * Handles all Pinecone vector DB operations:
 *  - Lazy index initialization
 *  - Upsert embeddings
 *  - Query similar vectors
 */

import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient = null;
let indexInstance = null;

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "geologygpt";

// ── Lazy init ─────────────────────────────────────────────────

async function getIndex() {
  if (indexInstance) return indexInstance;

  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }

  // Check if index exists; if not, create it
  const existingIndexes = await pineconeClient.listIndexes();
  const names = existingIndexes.indexes?.map((i) => i.name) || [];
  
  if (!names.includes(INDEX_NAME)) {
    console.log(`[Pinecone] Creating index "${INDEX_NAME}"...`);
    await pineconeClient.createIndex({
      name: INDEX_NAME,
      dimension: 1024,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    // Wait for index to be ready
    await new Promise((r) => setTimeout(r, 10000));
    console.log(`[Pinecone] Index "${INDEX_NAME}" created.`);
  }

  indexInstance = pineconeClient.index(INDEX_NAME);
  return indexInstance;
}

// ── Upsert vectors ────────────────────────────────────────────

/**
 * @param {Array<{id, values, metadata}>} vectors
 */
export async function upsertVectors(vectors) {
  const index = await getIndex();
  // Pinecone recommends batches of 100
  const BATCH = 100;
  for (let i = 0; i < vectors.length; i += BATCH) {
    await index.upsert(vectors.slice(i, i + BATCH));
  }
  console.log(`[Pinecone] Upserted ${vectors.length} vectors.`);
}

// ── Query similar vectors ─────────────────────────────────────

/**
 * @param {number[]} queryVector  - Embedding of the user's query
 * @param {number}   topK         - Number of results to return
 * @returns {Array<{score, metadata}>}
 */
export async function querySimilar(queryVector, topK = 5) {
  const index = await getIndex();
  const result = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  return (result.matches || []).map((m) => ({
    score: m.score,
    text: m.metadata?.text || "",
    source: m.metadata?.source || "unknown",
    chunkIndex: m.metadata?.chunkIndex ?? 0,
  }));
}

// ── Delete all vectors for a source ──────────────────────────

export async function deleteBySource(source) {
  try {
    const index = await getIndex();
    await index.deleteMany({ source });
    console.log(`[Pinecone] Deleted vectors for source: ${source}`);
  } catch (err) {
    console.warn("[Pinecone] deleteBySource error:", err.message);
  }
}

console.log("Pinecone key:", process.env.PINECONE_API_KEY);