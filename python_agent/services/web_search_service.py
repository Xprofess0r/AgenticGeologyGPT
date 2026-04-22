"""
services/web_search_service.py  (FIXED)

Fixes applied:
  1. Added try/except around TavilyClient import (graceful if not installed)
  2. Safer response parsing — tavily API response structure varies by version
  3. search() params normalized for tavily-python 0.3.x
"""

import os


def _get_client():
    api_key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("TAVILY_API_KEY not set")

    try:
        from tavily import TavilyClient
        return TavilyClient(api_key=api_key)
    except ImportError:
        raise RuntimeError("tavily-python not installed. Run: pip install tavily-python")


def search_web(query: str, max_results: int = 3) -> list[dict]:
    """
    Run Tavily web search and return structured results.
    Returns empty list on any failure (non-fatal — RAG alone can answer).
    """
    try:
        client = _get_client()
        geology_query = f"geology {query}"

        response = client.search(
            query=geology_query,
            search_depth="basic",
            max_results=max_results + 1,
        )

        # Tavily returns dict with "results" key
        if isinstance(response, dict):
            results = response.get("results", [])
        else:
            # Newer tavily versions may return an object
            results = getattr(response, "results", [])

        output = []
        for r in results[:max_results]:
            if isinstance(r, dict):
                title   = r.get("title", "Untitled")
                url     = r.get("url", "")
                content = r.get("content") or r.get("snippet") or ""
                score   = float(r.get("score", 0.7))
            else:
                title   = getattr(r, "title", "Untitled")
                url     = getattr(r, "url", "")
                content = getattr(r, "content", "") or getattr(r, "snippet", "")
                score   = float(getattr(r, "score", 0.7))

            output.append({
                "title":   title,
                "url":     url,
                "snippet": str(content)[:500],
                "score":   round(score, 4),
            })

        return output

    except RuntimeError as exc:
        print(f"[WebSearchService] Skipping — {exc}")
        return []
    except Exception as exc:
        print(f"[WebSearchService] search failed: {exc}")
        return []


def is_geology_relevant(results: list[dict]) -> bool:
    """Check if web results contain geology content."""
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
