"""
graph_state.py  (v5 — SpaceGPT-aligned)

Mirrors SpaceGPT's GraphState but adapted for geology + Pinecone.
SpaceGPT uses: original_query, rag_query, search_query, is_out_of_scope,
               retrieved_docs, search_results, filtered_context, final_answer

We add:  embedding_score, rag_results, web_results, sources, _query_embedding
"""

from typing import Any
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # ── Core inputs ────────────────────────────────────────────
    query:   str
    history: list[dict]

    # ── Planning (SpaceGPT-style: planner generates these) ─────
    rag_query:    str        # precision-optimised query for vector search
    search_query: str        # web-search-optimised query

    # ── Guard / classification ─────────────────────────────────
    embedding_score: float
    is_geology:      bool

    # ── Retrieval results ──────────────────────────────────────
    rag_results:  list[dict]   # from Pinecone
    web_results:  list[dict]   # from Tavily

    # ── SpaceGPT critique stage outputs ───────────────────────
    filtered_context: str      # post-critique consolidated context

    # ── Output ────────────────────────────────────────────────
    final_answer: str
    sources:      list[dict]

    # ── Internal / debug ──────────────────────────────────────
    _query_embedding: list[float] | None
    _decision_reason: str