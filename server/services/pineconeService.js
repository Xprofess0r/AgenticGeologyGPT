/**
 * pineconeService.js  (v4.0)
 *
 * CHANGE: dimension updated to 768 to match Gemini text-embedding-004.
 * If your existing Pinecone index is 1024-dim (from Cohere), you MUST:
 *   1. Go to Pinecone dashboard → delete index "geologygpt"
 *   2. Restart server → it will auto-create a new 768-dim index
 *   3. Re-upload your PDFs
 */

import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient = null;
let indexInstance  = null;

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "geologygpt";
const DIMENSION  = 1024; 

async function getIndex() {
  if (indexInstance) return indexInstance;

  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY not set");
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }

  const existing = await pineconeClient.listIndexes();
  const names = existing.indexes?.map((i) => i.name) || [];

  if (!names.includes(INDEX_NAME)) {
    console.log(`[Pinecone] Creating index "${INDEX_NAME}" dim=${DIMENSION}…`);
    await pineconeClient.createIndex({
      name:      INDEX_NAME,
      dimension: DIMENSION,
      metric:    "cosine",
      spec: {
        serverless: { cloud: "aws", region: "us-east-1" },
      },
    });
    // Poll until ready (up to 60s)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const desc = await pineconeClient.describeIndex(INDEX_NAME);
      if (desc.status?.ready) { console.log("[Pinecone] Index ready."); break; }
      console.log(`[Pinecone] Waiting for index… (${i + 1}/20)`);
    }
  }

  indexInstance = pineconeClient.index(INDEX_NAME);
  console.log(`[Pinecone] Connected to "${INDEX_NAME}"`);
  return indexInstance;
}

// ── Upsert vectors ────────────────────────────────────────────
export async function upsertVectors(vectors) {
  const index = await getIndex();
  const BATCH = 100;
  for (let i = 0; i < vectors.length; i += BATCH) {
    await index.upsert(vectors.slice(i, i + BATCH));
  }
  console.log(`[Pinecone] Upserted ${vectors.length} vectors.`);
}

// ── Query similar vectors ─────────────────────────────────────
export async function querySimilar(queryVector, topK = 6) {
  const index = await getIndex();
  const result = await index.query({
    vector:          queryVector,
    topK,
    includeMetadata: true,
  });

  return (result.matches || []).map((m) => ({
    score:      m.score,
    text:       m.metadata?.text       || "",
    source:     m.metadata?.source     || "unknown",
    chunkIndex: m.metadata?.chunkIndex ?? 0,
  }));
}

// ── Delete by source ──────────────────────────────────────────
export async function deleteBySource(source) {
  try {
    const index = await getIndex();
    await index.deleteMany({ filter: { source: { $eq: source } } });
    console.log(`[Pinecone] Deleted vectors for source: ${source}`);
  } catch (err) {
    console.warn("[Pinecone] deleteBySource error:", err.message);
  }
};