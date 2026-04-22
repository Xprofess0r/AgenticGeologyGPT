"""
services/web_search_service.py

Tavily web search service.
Prepends "geology" to query for better relevance.
Returns top 3 results with title, url, snippet.
"""

import os
from tavily import TavilyClient

_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            raise RuntimeError("TAVILY_API_KEY not set")
        _client = TavilyClient(api_key=api_key)
    return _client


def search_web(query: str, max_results: int = 3) -> list[dict]:
    """
    Run a Tavily web search and return structured results.

    Args:
        query: User query (geology prefix added internally).
        max_results: Maximum number of results to return.

    Returns:
        List of dicts: {title, url, snippet, score}
    """
    try:
        client = _get_client()

        # Add geology context to query for relevance
        geology_query = f"geology {query}"

        response = client.search(
            query=geology_query,
            search_depth="basic",
            include_answer=False,
            max_results=max_results + 1,  # fetch one extra, filter below
        )

        results = response.get("results", [])

        return [
            {
                "title": r.get("title", "Untitled"),
                "url": r.get("url", ""),
                "snippet": (r.get("content") or r.get("snippet") or "")[:500],
                "score": round(float(r.get("score", 0.7)), 4),
            }
            for r in results[:max_results]
        ]

    except RuntimeError:
        # No API key configured — silently skip
        return []
    except Exception as exc:
        print(f"[WebSearchService] search failed: {exc}")
        return []


def is_geology_relevant(results: list[dict]) -> bool:
    """
    Lightweight check: do web results contain geology content?
    Used in the decision node for evidence-based validation.
    """
    geology_signals = {
        "rock", "mineral", "geolog", "tectonic", "seismic", "fossil",
        "sediment", "strata", "volcani", "earthquake", "magma", "crust",
        "mantle", "petrol", "paleontol", "stratigraphy", "fault",
    }
    for r in results:
        combined = (r.get("title", "") + " " + r.get("snippet", "")).lower()
        if any(sig in combined for sig in geology_signals):
            return True
    return False
