"""
nodes/decision_node.py  (v8 — FINAL)

ROOT CAUSE FIXED:
  Old logic: "PASS (override) if RAG score > 0.30"
  Problem: Seismic notes score 0.30-0.34 on ANY geology-adjacent query.
           Compiler design got 0.34 from seismic notes → PASS override → answered!

FIX:
  DecisionNode now TRUSTS QueryNode completely.
  QueryNode is the sole geology gate (keyword + blocklist).
  DecisionNode just forwards the verdict — no override logic.

  The only purpose of DecisionNode is to provide a clean routing point
  for LangGraph's conditional edges.
"""

import time
from graph_state import AgentState


def decision_node(state: AgentState) -> AgentState:
    is_geology      = state.get("is_geology", False)
    rag_results     = state.get("rag_results", [])
    web_results     = state.get("web_results", [])
    decision_reason = state.get("_decision_reason", "")
    t0 = time.time()

    top_rag = max((r.get("score", 0) for r in rag_results), default=0)
    elapsed = round((time.time() - t0) * 1000)

    if is_geology:
        reason = (
            f"PASS — geology confirmed by QueryNode "
            f"(rag={len(rag_results)} chunks, top={top_rag:.3f}, "
            f"web={len(web_results)} results)"
        )
        print(f"[DecisionNode] {reason} [{elapsed}ms]")
        return {**state, "_decision_reason": reason}
    else:
        reason = "BLOCK — QueryNode rejected as non-geology"
        print(f"[DecisionNode] {reason} [{elapsed}ms]")
        return {**state, "_decision_reason": reason}


def route_after_decision(state: AgentState) -> str:
    return "answer_node" if state.get("is_geology", False) else "block_node"