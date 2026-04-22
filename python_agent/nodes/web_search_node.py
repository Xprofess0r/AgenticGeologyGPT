"""
nodes/web_search_node.py

WebSearchNode — Node 3 of the LangGraph pipeline.

Triggers web search when:
  a) RAG results are weak/empty, OR
  b) embedding_score is low (query might be borderline geology)

Skips when:
  - RAG is strong (2+ chunks with score >= 0.6) AND embedding >= 0.55
  - Saves Tavily quota for when it's actually needed
"""

import time
from services.web_search_service import search_web
from graph_state import AgentState

RAG_STRONG_SCORE  = 0.60   # min score for a "strong" RAG chunk
RAG_STRONG_COUNT  = 2      # need at least this many strong chunks
EMBEDDING_OK      = 0.55   # above this = embedding confirms geology


def _rag_is_strong(rag_results: list[dict]) -> bool:
    strong = [r for r in rag_results if r.get("score", 0) >= RAG_STRONG_SCORE]
    return len(strong) >= RAG_STRONG_COUNT


def web_search_node(state: AgentState) -> AgentState:
    rag_results     = state.get("rag_results",    [])
    embedding_score = state.get("embedding_score", 0.0)
    query           = state["query"]

    t0 = time.time()

    if _rag_is_strong(rag_results) and embedding_score >= EMBEDDING_OK:
        top = max((r.get("score", 0) for r in rag_results), default=0)
        print(f"[WebSearchNode] Skip — RAG strong ({len(rag_results)} chunks, top={top:.2f})")
        return {**state, "web_results": []}

    print(
        f"[WebSearchNode] Running web search "
        f"(rag={len(rag_results)}, embedding={embedding_score:.3f})"
    )

    results = search_web(query, max_results=3)
    elapsed = round((time.time() - t0) * 1000)

    print(f"[WebSearchNode] {len(results)} results [{elapsed}ms]")
    for i, r in enumerate(results):
        print(f"  Web {i+1}: {r.get('title','N/A')[:60]} (score={r.get('score',0):.2f})")

    return {**state, "web_results": results}