"""
nodes/retriever_node.py  (v5 — SpaceGPT-aligned)

SpaceGPT: retrieve_and_search_node runs RAG + web search CONCURRENTLY.

Key changes vs old code:
  - Uses rag_query (from QueryNode's Gemini planner) not raw query
    → much more precise vector search
  - Embeds rag_query once (RETRIEVAL_QUERY task type)
  - Threshold lowered to 0.35 for gemini-embedding-001
  - Returns top 5 chunks (enough context, not too many tokens)
"""

import time
from graph_state import AgentState


def retriever_node(state: AgentState) -> AgentState:
    # Use the precision-optimised rag_query from QueryNode
    rag_query = state.get("rag_query") or state["query"]
    print(f"[RetrieverNode] Querying Pinecone with: '{rag_query[:80]}'")
    t0 = time.time()

    try:
        from services.embedding_service import embed_query
        from services.pinecone_service  import query_pinecone

        # Embed the rag_query (not raw query — more precise)
        query_embedding = embed_query(rag_query)

        chunks = query_pinecone(
            query_vector    = query_embedding,
            top_k           = 10,
            score_threshold = 0.35,  # gemini-embedding-001 appropriate threshold
            return_top      = 5,
        )

        elapsed = round((time.time() - t0) * 1000)
        print(f"[RetrieverNode] {len(chunks)} chunks retrieved [{elapsed}ms]")
        for i, c in enumerate(chunks):
            print(f"  [{i+1}] score={c['score']:.3f} source={c['source'][:50]}")

        return {
            **state,
            "rag_results":      chunks,
            "_query_embedding": query_embedding,
        }

    except Exception as exc:
        elapsed = round((time.time() - t0) * 1000)
        print(f"[RetrieverNode] Failed [{elapsed}ms]: {exc}")
        return {**state, "rag_results": [], "_query_embedding": None}