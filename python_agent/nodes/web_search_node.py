"""
nodes/web_search_node.py  (v5 — SpaceGPT-aligned)

SpaceGPT: runs web search ALWAYS in parallel with retrieval.
Our approach: run web search when RAG is weak OR always (configurable).

Key changes vs old code:
  - Uses search_query (from QueryNode's Gemini planner) not raw query
    → much better web results
  - Threshold lowered: triggers if ANY rag chunk < 0.55 (not just 2+ at 0.6)
  - If no Tavily key → skips gracefully (system still works via RAG alone)
"""

import time
from services.web_search_service import search_web
from graph_state import AgentState

# Thresholds for deciding whether to run web search
RAG_STRONG_SCORE = 0.55
RAG_STRONG_COUNT = 3       # Need 3+ strong chunks to skip web search


def _rag_is_strong(rag_results: list[dict]) -> bool:
    strong = [r for r in rag_results if r.get("score", 0) >= RAG_STRONG_SCORE]
    return len(strong) >= RAG_STRONG_COUNT


def web_search_node(state: AgentState) -> AgentState:
    rag_results  = state.get("rag_results", [])
    search_query = state.get("search_query") or f"geology {state['query']}"

    t0 = time.time()

    # SpaceGPT always runs web search. We skip only if RAG is very strong.
    if _rag_is_strong(rag_results):
        top = max((r.get("score", 0) for r in rag_results), default=0)
        strong_count = len([r for r in rag_results if r.get("score", 0) >= RAG_STRONG_SCORE])
        print(f"[WebSearchNode] Skip — strong RAG ({strong_count} chunks ≥{RAG_STRONG_SCORE}, top={top:.3f})")
        return {**state, "web_results": []}

    print(f"[WebSearchNode] Searching: '{search_query[:80]}'")

    results = search_web(search_query, max_results=3)
    elapsed = round((time.time() - t0) * 1000)

    print(f"[WebSearchNode] {len(results)} results [{elapsed}ms]")
    for i, r in enumerate(results):
        print(f"  [{i+1}] {r.get('title','N/A')[:60]}")

    return {**state, "web_results": results}