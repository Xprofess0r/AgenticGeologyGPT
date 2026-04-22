"""
graph_state.py  (FIXED)

Fixes applied:
  1. Added missing field: _decision_reason (was referenced but not declared)
  2. Made all fields properly optional with total=False
"""

from typing import Any
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # ── Core inputs ───────────────────────────────────────────
    query:   str
    history: list[dict]

    # ── Guard / classification ────────────────────────────────
    embedding_score: float
    is_geology:      bool

    # ── Retrieval results ─────────────────────────────────────
    rag_results: list[dict]
    web_results: list[dict]

    # ── Output ───────────────────────────────────────────────
    final_answer: str
    sources:      list[dict]

    # ── Internal / debug ─────────────────────────────────────
    _query_embedding: list[float] | None
    _decision_reason: str              # ← was missing from original TypedDict
