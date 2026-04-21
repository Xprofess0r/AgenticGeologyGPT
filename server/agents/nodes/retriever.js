/**
 * retriever.js — Node 2
 *
 * RAG retrieval node.
 * Queries Pinecone for top-k relevant chunks based on query embedding.
 * Gracefully returns empty array if no documents indexed or Pinecone unavailable.
 */

import { retrieveContext } from "../../services/ragService.js";

export async function retrieverNode(state) {
  const { query, needsRAG, logger } = state;

  if (!needsRAG) {
    logger.logStep("retriever", "Skipped — RAG not needed for this query");
    return { ...state, ragChunks: [] };
  }

  logger.logStep("retriever", "Querying Pinecone for relevant chunks…");

  try {
    const chunks = await retrieveContext(query, 5);
    logger.logStep("retriever", `Retrieved ${chunks.length} chunks (score > 0.3)`);
    logger.logChunks(chunks);
    logger.logToolCall("pinecone_query", query, `${chunks.length} chunks`);

    return { ...state, ragChunks: chunks };
  } catch (err) {
    console.error("[retriever] Error:", err.message);
    logger.logStep("retriever", `Error: ${err.message}`);
    return { ...state, ragChunks: [] };
  }
}
