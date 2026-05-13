"""
nodes/web_search_node.py  (v7 — ALWAYS run web search)

FINAL FIX: Remove ALL score-based skip logic.
Web search ALWAYS runs. Period.

Reason:
  Score-based skipping is fundamentally broken:
  - 0.70 RAG score means "same topic area" not "answers this question"
  - Underground mining query hits seismic notes (both geophysics domain) at 0.60+
  - There is NO reliable way to know if RAG answers the question without reading it

Cost analysis:
  Tavily free tier = 1000 searches/month = 33/day = fine for a geology research tool.
  The cost of a wrong "not found" answer >> cost of 1 Tavily API call.

Only true skip: if TAVILY_API_KEY is not set (handled in search_web() gracefully).
"""

import time
from services.web_search_service import search_web
from graph_state import AgentState


def web_search_node(state: AgentState) -> AgentState:
    # Use the search-optimised query from planner, fall back to raw query
    search_query = (state.get("search_query") or "").strip()
    if not search_query:
        search_query = f"geology {state['query']}"

    rag_count = len(state.get("rag_results", []))
    print(f"[WebSearchNode] Running web search (rag_chunks={rag_count})")
    print(f"[WebSearchNode] Query: '{search_query[:80]}'")

    t0 = time.time()
    results = search_web(search_query, max_results=4)
    elapsed = round((time.time() - t0) * 1000)

    if results:
        print(f"[WebSearchNode] ✓ {len(results)} results [{elapsed}ms]")
        for i, r in enumerate(results):
            print(f"  [{i+1}] {r.get('title','N/A')[:70]}")
    else:
        print(f"[WebSearchNode] ✗ 0 results [{elapsed}ms] — check TAVILY_API_KEY on Render!")

    return {**state, "web_results": results}
