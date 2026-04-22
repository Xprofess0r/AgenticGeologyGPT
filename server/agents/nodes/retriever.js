import { retrieveContext } from "../../services/ragService.js";

export async function retrieverNode(state) {
  const { query, needsRAG, logger, retryTopK } = state;

  if (!needsRAG) {
    logger.logStep("retriever", "Skipped — needsRAG=false");
    return { ...state, ragChunks: [] };
  }

  const topK = retryTopK || 6;
  logger.logStep("retriever", `Querying Pinecone (topK=${topK})…`);

  try {
    const chunks = await retrieveContext(query, topK);

    const bestScore = chunks.length > 0
      ? `best=${chunks[0].score?.toFixed(3)}`
      : "no results";

    logger.logStep("retriever", `Retrieved ${chunks.length} chunks (${bestScore})`);
    logger.logChunks(chunks);
    logger.logToolCall("pinecone_query", query, `${chunks.length} chunks`);

    return { ...state, ragChunks: chunks };
  } catch (err) {
    console.error("[retriever] Error:", err.message);
    logger.logStep("retriever", `Error: ${err.message}`);
    return { ...state, ragChunks: [] };
  }
};