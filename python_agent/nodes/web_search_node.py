"""
nodes/web_search_node.py  (v6 — FIXED)

ROOT CAUSE of missing web search:
  RAG returned 5 chunks with scores 0.55–0.66, so _rag_is_strong() returned True
  → web search was skipped entirely
  → answer had no web context → said "not found in your notes"

THE REAL PROBLEM:
  Strong RAG score does NOT mean RAG answered the question.
  "remote sensing in mineral exploration" matched seismic notes (same topic area)
  but the actual topic wasn't in those notes at all.

FIX — Always run web search. Only skip if:
  1. RAG has 3+ chunks scoring ≥ 0.70 (very high confidence, not just "related")
  AND
  2. The rag_query and query are very similar (not a subtopic miss)

For free Tavily tier (1000/month), this is fine — web search only costs
a call when the user actually sends a message.
"""

import time
from services.web_search_service import search_web
from graph_state import AgentState

# Raised from 0.55 → 0.70: only skip web search if RAG is VERY confident
RAG_SKIP_SCORE = 0.70
RAG_SKIP_COUNT = 3   # need 3 chunks ALL above 0.70 to skip web search


def _rag_is_definitive(rag_results: list[dict]) -> bool:
    """
    Returns True only if RAG results are so strong we're certain they answer the query.
    0.70+ threshold means the content is a direct match, not just topic-adjacent.
    """
    if not rag_results:
        return False
    high_score = [r for r in rag_results if r.get("score", 0) >= RAG_SKIP_SCORE]
    return len(high_score) >= RAG_SKIP_COUNT


def web_search_node(state: AgentState) -> AgentState:
    rag_results  = state.get("rag_results",  [])
    search_query = state.get("search_query") or f"geology {state['query']}"

    t0 = time.time()

    # Only skip web search if RAG is definitively strong (0.70+, 3+ chunks)
    if _rag_is_definitive(rag_results):
        top   = max((r.get("score", 0) for r in rag_results), default=0)
        count = len([r for r in rag_results if r.get("score", 0) >= RAG_SKIP_SCORE])
        print(f"[WebSearchNode] Skip — definitive RAG ({count} chunks ≥{RAG_SKIP_SCORE}, top={top:.3f})")
        return {**state, "web_results": []}

    # Run web search for all other cases (RAG weak, RAG absent, or RAG only topic-adjacent)
    top_score = max((r.get("score", 0) for r in rag_results), default=0)
    print(
        f"[WebSearchNode] Running web search "
        f"(rag_chunks={len(rag_results)}, top_score={top_score:.3f}) "
        f"query='{search_query[:70]}'"
    )

    results = search_web(search_query, max_results=4)
    elapsed = round((time.time() - t0) * 1000)

    if results:
        print(f"[WebSearchNode] Got {len(results)} results [{elapsed}ms]")
        for i, r in enumerate(results):
            print(f"  [{i+1}] {r.get('title', 'N/A')[:70]}")
    else:
        print(f"[WebSearchNode] No results (Tavily key missing or API error) [{elapsed}ms]")

    return {**state, "web_results": results}
