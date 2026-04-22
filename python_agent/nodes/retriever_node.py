"""
nodes/retriever_node.py

RetrieverNode — Node 2 of the LangGraph pipeline.

Queries Pinecone with the query embedding from QueryNode.
topK=8, score_threshold=0.5, returns top 3 chunks.
Re-embeds if QueryNode embedding is unavailable.
"""

from services.embedding_service import embed_query
from services.pinecone_service import query_pinecone
from graph_state import AgentState


def retriever_node(state: AgentState) -> AgentState:
    """
    Retrieve top-k relevant chunks from Pinecone.
    Uses cached query embedding from QueryNode when available.
    """
    query = state["query"]
    print(f"[RetrieverNode] Querying Pinecone for: '{query[:60]}'")

    try:
        # Reuse embedding from QueryNode to avoid a second API call
        query_embedding = state.get("_query_embedding")
        if query_embedding is None:
            print("[RetrieverNode] No cached embedding — re-embedding query")
            query_embedding = embed_query(query)

        chunks = query_pinecone(
            query_vector=query_embedding,
            top_k=8,
            score_threshold=0.5,
            return_top=3,
        )

        print(f"[RetrieverNode] Retrieved {len(chunks)} qualifying chunks")
        for i, c in enumerate(chunks):
            print(f"  Chunk {i+1}: score={c['score']}, source={c['source'][:40]}")

        return {**state, "rag_results": chunks}

    except Exception as exc:
        print(f"[RetrieverNode] Failed: {exc}")
        return {**state, "rag_results": []}
