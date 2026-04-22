"""
nodes/decision_node.py  (v5 — SpaceGPT-aligned)

SpaceGPT uses should_continue() which reads is_out_of_scope from plan_node.
We trust QueryNode's Gemini planner verdict. The decision node just forwards it.

If QueryNode's Gemini call failed and fell back to keywords:
  - We also check RAG evidence and web results as secondary signals
  - This ensures robustness even when the planner call fails

BLOCK only if ALL of these fail:
  1. QueryNode said is_geology=False
  2. No RAG evidence (score < 0.30)
  3. No geology-relevant web results
"""

import time
from services.web_search_service import is_geology_relevant
from graph_state import AgentState


def decision_node(state: AgentState) -> AgentState:
    is_geology  = state.get("is_geology",       False)
    rag_results = state.get("rag_results",       [])
    web_results = state.get("web_results",       [])
    emb_score   = state.get("embedding_score",   0.0)

    t0 = time.time()

    # If planner already confirmed geology — trust it
    if is_geology:
        top_rag = max((r.get("score", 0) for r in rag_results), default=0)
        reason  = f"PASS — planner confirmed geology (emb={emb_score:.2f}, rag_top={top_rag:.3f})"
        elapsed = round((time.time() - t0) * 1000)
        print(f"[DecisionNode] {reason} [{elapsed}ms]")
        return {**state, "is_geology": True, "_decision_reason": reason}

    # Planner said NOT geology — check secondary evidence before blocking
    rag_has_evidence = any(r.get("score", 0) >= 0.30 for r in rag_results)
    web_has_geology  = is_geology_relevant(web_results)

    # Override if evidence found
    if rag_has_evidence or web_has_geology:
        signals = []
        if rag_has_evidence:
            top = max((r["score"] for r in rag_results), default=0)
            signals.append(f"RAG_evidence(top={top:.3f})")
        if web_has_geology:
            signals.append(f"web_geology_detected")
        reason  = "PASS (override) — " + ", ".join(signals)
        elapsed = round((time.time() - t0) * 1000)
        print(f"[DecisionNode] {reason} [{elapsed}ms]")
        return {**state, "is_geology": True, "_decision_reason": reason}

    reason  = f"BLOCK — planner: not geology, no RAG evidence, no geo web results"
    elapsed = round((time.time() - t0) * 1000)
    print(f"[DecisionNode] {reason} [{elapsed}ms]")
    return {**state, "is_geology": False, "_decision_reason": reason}


def route_after_decision(state: AgentState) -> str:
    return "answer_node" if state.get("is_geology", False) else "block_node"