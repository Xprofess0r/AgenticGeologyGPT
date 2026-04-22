"""
graph_state.py

Shared state object for the LangGraph agent pipeline.
All nodes read from and write to this typed dictionary.
"""

from typing import Any
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # ── Core inputs ──────────────────────────────────────────
    query: str                      # User's question
    history: list[dict]             # Conversation history [{role, content}]

    # ── Guard / classification ────────────────────────────────
    embedding_score: float          # Cosine similarity vs geology reference
    is_geology: bool                # True = proceed to answer; False = block

    # ── Retrieval results ─────────────────────────────────────
    rag_results: list[dict]         # Pinecone chunks [{text, source, score, ...}]
    web_results: list[dict]         # Tavily results [{title, url, snippet, score}]

    # ── Output ────────────────────────────────────────────────
    final_answer: str               # Generated answer or block message
    sources: list[dict]             # Structured sources for frontend

    # ── Internal / debug ─────────────────────────────────────
    _query_embedding: list[float] | None   # Cached embedding from QueryNode
    _decision_reason: str                  # Human-readable decision log
