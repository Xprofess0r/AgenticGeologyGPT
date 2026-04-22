"""
nodes/decision_node.py

DecisionNode — Node 4 of the LangGraph pipeline.

Implements the 3-step hybrid guard logic:

  Step 1: Embedding similarity (from QueryNode)
  Step 2: Evidence-based validation (RAG + Web results)
  Step 3: FINAL BLOCK — ONLY if ALL signals are negative:
            - embedding_score < threshold
            - AND no qualifying RAG results
            - AND no qualifying web results

Examples:
  "react js"         → embedding low + no RAG + no geo web → BLOCK
  "types of bivalves" → low embedding BUT web/RAG confirms geo → PASS
  "earthquake causes" → high embedding → PASS immediately
"""

from services.web_search_service import is_geology_relevant
from graph_state import AgentState

EMBEDDING_THRESHOLD = 0.65
RAG_EVIDENCE_MIN_SCORE = 0.5      # Any RAG chunk above this = evidence
WEB_EVIDENCE_REQUIRED = True      # Use is_geology_relevant() for web check


def decision_node(state: AgentState) -> AgentState:
    """
    Decide whether to answer or block the query.
    Sets is_geology=True/False in state.
    The graph routes to AnswerNode or BlockNode based on this.
    """
    embedding_score = state.get("embedding_score", 0.0)
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])

    # ── Step 1: Embedding similarity ──────────────────────────
    embedding_ok = embedding_score >= EMBEDDING_THRESHOLD

    # ── Step 2: Evidence-based validation ─────────────────────
    rag_has_evidence = any(
        r.get("score", 0) >= RAG_EVIDENCE_MIN_SCORE for r in rag_results
    )
    web_has_geology = len(web_results) > 0 and is_geology_relevant(web_results)

    # ── Step 3: Final decision — only block if ALL fail ────────
    is_geology = embedding_ok or rag_has_evidence or web_has_geology

    # Detailed reasoning for logs
    reason_parts = []
    if embedding_ok:
        reason_parts.append(f"embedding={embedding_score:.3f}≥{EMBEDDING_THRESHOLD}")
    if rag_has_evidence:
        top_score = max((r["score"] for r in rag_results), default=0)
        reason_parts.append(f"RAG_evidence(top={top_score:.2f})")
    if web_has_geology:
        reason_parts.append(f"web_geology({len(web_results)} results)")

    if is_geology:
        reason = "PASS — " + ", ".join(reason_parts)
    else:
        reason = (
            f"BLOCK — embedding={embedding_score:.3f}<{EMBEDDING_THRESHOLD}, "
            f"no_RAG_evidence, no_geo_web"
        )

    print(f"[DecisionNode] {reason}")

    return {**state, "is_geology": is_geology, "_decision_reason": reason}


def route_after_decision(state: AgentState) -> str:
    """
    LangGraph conditional edge function.
    Returns node name to route to: 'answer_node' or 'block_node'.
    """
    return "answer_node" if state.get("is_geology", False) else "block_node"
