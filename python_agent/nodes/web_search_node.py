"""
nodes/web_search_node.py

WebSearchNode — Node 3 of the LangGraph pipeline.

Runs Tavily web search ONLY when RAG results are weak/absent.
"Weak" = fewer than 2 chunks OR max score < 0.6.
Returns top 3 results with title, url, snippet.
"""

from services.web_search_service import search_web
from graph_state import AgentState

# RAG is considered "strong" if we have 2+ chunks with score >= this
RAG_STRONG_SCORE_THRESHOLD = 0.60
RAG_STRONG_MIN_CHUNKS = 2


def _rag_is_strong(rag_results: list[dict]) -> bool:
    """Return True if RAG results are sufficient to skip web search."""
    if len(rag_results) >= RAG_STRONG_MIN_CHUNKS:
        if any(r["score"] >= RAG_STRONG_SCORE_THRESHOLD for r in rag_results):
            return True
    return False


def web_search_node(state: AgentState) -> AgentState:
    """
    Trigger web search only when RAG is insufficient.
    Strong RAG → skip web search (saves API quota).
    Weak/no RAG → search web for supplementary evidence.
    """
    rag_results = state.get("rag_results", [])
    query = state["query"]

    if _rag_is_strong(rag_results):
        print(
            f"[WebSearchNode] Skipping — RAG is strong "
            f"({len(rag_results)} chunks, "
            f"top score={max((r['score'] for r in rag_results), default=0):.2f})"
        )
        return {**state, "web_results": []}

    print(
        f"[WebSearchNode] RAG weak/empty "
        f"({len(rag_results)} chunks) — running web search"
    )

    try:
        results = search_web(query, max_results=3)
        print(f"[WebSearchNode] Got {len(results)} web results")
        for i, r in enumerate(results):
            print(f"  Web {i+1}: {r['title'][:60]} (score={r['score']})")
        return {**state, "web_results": results}

    except Exception as exc:
        print(f"[WebSearchNode] Search failed: {exc}")
        return {**state, "web_results": []}
