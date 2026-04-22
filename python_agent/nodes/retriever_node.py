"""
nodes/retriever_node.py

RetrieverNode — Node 2 of the LangGraph pipeline.

Key behavior:
  - If QueryNode did keyword-fast-path, _query_embedding is None
    → Must embed here using Cohere (single embed call total per request)
  - If QueryNode did Cohere embed, reuse it (zero extra calls)
  - Graceful on Pinecone errors — empty results → web search compensates
"""

import time
from graph_state import AgentState


def retriever_node(state: AgentState) -> AgentState:
    """Retrieve top-k relevant chunks from Pinecone."""
    query = state["query"]
    print(f"[RetrieverNode] Querying Pinecone for: '{query[:60]}'")
    t0 = time.time()

    try:
        query_embedding = state.get("_query_embedding")

        if query_embedding is None:
            # QueryNode used keyword fast-path — embed now for Pinecone
            print("[RetrieverNode] Embedding query for Pinecone (keyword path)")
            from services.embedding_service import embed_query
            query_embedding = embed_query(query)

        from services.pinecone_service import query_pinecone
        chunks = query_pinecone(
            query_vector=query_embedding,
            top_k=10,
            score_threshold=0.30,
            return_top=5,
        )

        elapsed = round((time.time() - t0) * 1000)
        print(f"[RetrieverNode] {len(chunks)} chunks retrieved [{elapsed}ms]")
        for i, c in enumerate(chunks):
            print(f"  Chunk {i+1}: score={c['score']}, source={c['source'][:40]}")

        return {**state, "rag_results": chunks, "_query_embedding": query_embedding}

    except Exception as exc:
        elapsed = round((time.time() - t0) * 1000)
        print(f"[RetrieverNode] Failed [{elapsed}ms]: {exc}")
        return {**state, "rag_results": []}