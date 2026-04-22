"""
nodes/query_node.py

QueryNode — Node 1 of the LangGraph pipeline.

Responsibilities:
  1. Embed the query using Cohere.
  2. Compute cosine similarity against geology reference embedding.
  3. Set embedding_score in state.
  4. Determine initial is_geology flag (Step 1 of hybrid guard).

The final guard decision is made in DecisionNode after RAG + web evidence.
This node ONLY does the embedding similarity check — no blocking here.
"""

from services.embedding_service import (
    embed_query,
    get_geology_reference_embedding,
    cosine_similarity,
)
from graph_state import AgentState

SIMILARITY_THRESHOLD = 0.45


def query_node(state: AgentState) -> AgentState:
    """
    Compute embedding similarity between query and geology reference.
    Sets embedding_score; marks is_geology=True if score >= threshold.
    """
    query = state["query"]
    print(f"[QueryNode] Processing: '{query[:80]}'")

    try:
        query_embedding = embed_query(query)
        ref_embedding = list(get_geology_reference_embedding())  # tuple → list

        score = cosine_similarity(query_embedding, ref_embedding)
        score = round(score, 4)

        is_geology_by_embedding = score >= SIMILARITY_THRESHOLD

        print(
            f"[QueryNode] Embedding similarity={score:.4f} "
            f"(threshold={SIMILARITY_THRESHOLD}) → "
            f"is_geology={is_geology_by_embedding}"
        )

        return {
            **state,
            "embedding_score": score,
            "is_geology": is_geology_by_embedding,
            # Store embedding for RAG retrieval — avoids double call
            "_query_embedding": query_embedding,
        }

    except Exception as exc:
        print(f"[QueryNode] Embedding failed: {exc}")
        # On failure, be permissive — let RAG/Web evidence decide
        return {
            **state,
            "embedding_score": 0.0,
            "is_geology": False,
            "_query_embedding": None,
        }
