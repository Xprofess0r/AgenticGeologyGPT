"""
nodes/decision_node.py

DecisionNode — Node 4 of the LangGraph pipeline.

4-signal hybrid guard. PASS if ANY signal is positive.
BLOCK only if ALL fail.

Signal priority (fast to slow):
  1. is_geology flag from QueryNode (set True if keyword matched) — instant
  2. Embedding score >= threshold — from Cohere
  3. RAG evidence — from Pinecone
  4. Web geology relevance — from Tavily
"""

import time
from services.web_search_service import is_geology_relevant
from graph_state import AgentState

EMBEDDING_THRESHOLD = 0.40   # Cohere v5 scores; consistent with QueryNode


def decision_node(state: AgentState) -> AgentState:
    embedding_score = state.get("embedding_score", 0.0)
    rag_results     = state.get("rag_results",     [])
    web_results     = state.get("web_results",     [])
    is_geo_flag     = state.get("is_geology",      False)   # True if keyword matched in QueryNode

    t0 = time.time()

    # Signal 1: QueryNode already confirmed via keyword
    if is_geo_flag:
        # If keyword already confirmed, pass immediately — no need to re-check
        top_rag = max((r.get("score", 0) for r in rag_results), default=0)
        reason  = f"PASS — keyword_or_embedding confirmed in QueryNode (emb={embedding_score:.3f}, rag_top={top_rag:.2f})"
        elapsed = round((time.time() - t0) * 1000)
        print(f"[DecisionNode] {reason} [{elapsed}ms]")
        return {**state, "is_geology": True, "_decision_reason": reason}

    # Signal 2: Embedding threshold
    embedding_ok = embedding_score >= EMBEDDING_THRESHOLD

    # Signal 3: RAG evidence
    rag_has_evidence = any(r.get("score", 0) >= 0.30 for r in rag_results)

    # Signal 4: Web geology content
    web_has_geology = len(web_results) > 0 and is_geology_relevant(web_results)

    is_geology = embedding_ok or rag_has_evidence or web_has_geology

    signals = []
    if embedding_ok:
        signals.append(f"embedding={embedding_score:.3f}≥{EMBEDDING_THRESHOLD}")
    if rag_has_evidence:
        top = max((r["score"] for r in rag_results), default=0)
        signals.append(f"RAG_evidence(top={top:.2f})")
    if web_has_geology:
        signals.append(f"web_geology({len(web_results)} results)")

    if is_geology:
        reason = "PASS — " + ", ".join(signals)
    else:
        reason = (
            f"BLOCK — embedding={embedding_score:.3f}<{EMBEDDING_THRESHOLD}, "
            f"no_RAG, no_geo_web, no_keywords"
        )

    elapsed = round((time.time() - t0) * 1000)
    print(f"[DecisionNode] {reason} [{elapsed}ms]")
    return {**state, "is_geology": is_geology, "_decision_reason": reason}


def route_after_decision(state: AgentState) -> str:
    return "answer_node" if state.get("is_geology", False) else "block_node"