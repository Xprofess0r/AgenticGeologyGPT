/**
 * pineconeService.js  (v5)
 *
 * CHANGE: dimension set to 1024 to match gemini-embedding-001.
 * (Cohere embed-english-v3.0 was also 1024 — so existing indexes still work!)
 */

import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient = null;
let indexInstance  = null;

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "geologygpt";
const DIMENSION  = 1024; // gemini-embedding-001 with outputDimensionality=1024

async function getIndex() {
  if (indexInstance) return indexInstance;

  if (!process.env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY not set");
  pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  const existing = await pineconeClient.listIndexes();
  const names    = existing.indexes?.map((i) => i.name) || [];

  if (!names.includes(INDEX_NAME)) {
    console.log(`[Pinecone] Creating index "${INDEX_NAME}" dim=${DIMENSION}…`);
    await pineconeClient.createIndex({
      name:      INDEX_NAME,
      dimension: DIMENSION,
      metric:    "cosine",
      spec: { serverless: { cloud: "aws", region: "us-east-1" } },
    });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const desc = await pineconeClient.describeIndex(INDEX_NAME);
      if (desc.status?.ready) { console.log("[Pinecone] Index ready."); break; }
      console.log(`[Pinecone] Waiting… (${i + 1}/20)`);
    }
  }

  indexInstance = pineconeClient.index(INDEX_NAME);
  console.log(`[Pinecone] Connected to "${INDEX_NAME}"`);
  return indexInstance;
}

export async function upsertVectors(vectors) {
  const index = await getIndex();
  const BATCH = 100;
  for (let i = 0; i < vectors.length; i += BATCH) {
    await index.upsert(vectors.slice(i, i + BATCH));
  }
  console.log(`[Pinecone] Upserted ${vectors.length} vectors.`);
}

export async function querySimilar(queryVector, topK = 8) {
  const index  = await getIndex();
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

export async function deleteBySource(source) {
  try {
    const index = await getIndex();
    await index.deleteMany({ filter: { source: { $eq: source } } });
    console.log(`[Pinecone] Deleted vectors for source: ${source}`);
  } catch (err) {
    console.warn("[Pinecone] deleteBySource error:", err.message);
  }
}