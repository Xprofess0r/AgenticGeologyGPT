"""
services/web_search_service.py  (v5 — unchanged logic, uses search_query from planner)

The search_web function now receives the pre-optimised search_query from QueryNode.
This gives much better results than prepending "geology " to the raw query.
"""

import os


def _get_tavily():
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
    Run Tavily web search. Returns [] on any failure — non-fatal.
    query should already be search-optimised (from QueryNode planner).
    """
    try:
        client   = _get_tavily()
        response = client.search(
            query=query,
            search_depth="basic",
            max_results=max_results + 1,
        )

        results = (
            response.get("results", [])
            if isinstance(response, dict)
            else getattr(response, "results", [])
        )

        output = []
        for r in results[:max_results]:
            if isinstance(r, dict):
                title   = r.get("title",   "Untitled")
                url     = r.get("url",     "")
                content = r.get("content") or r.get("snippet") or ""
                score   = float(r.get("score", 0.7))
            else:
                title   = getattr(r, "title",   "Untitled")
                url     = getattr(r, "url",     "")
                content = getattr(r, "content", "") or getattr(r, "snippet", "")
                score   = float(getattr(r, "score", 0.7))

            output.append({
                "title":   title,
                "url":     url,
                "snippet": str(content)[:600],
                "score":   round(score, 4),
            })

        return output

    except RuntimeError as exc:
        print(f"[WebSearchService] Skipping — {exc}")
        return []
    except Exception as exc:
        print(f"[WebSearchService] Failed: {exc}")
        return []


def is_geology_relevant(results: list[dict]) -> bool:
    """Check if web results contain geology-related content."""
    signals = {
        "rock", "mineral", "geolog", "tectonic", "seismic", "fossil",
        "sediment", "strata", "volcani", "earthquake", "magma", "crust",
        "mantle", "petrol", "paleontol", "stratigraphy", "fault", "borehole",
        "reservoir", "hydrogeol", "geomorpholog", "geophy",
    }
    for r in results:
        text = (r.get("title", "") + " " + r.get("snippet", "")).lower()
        if any(s in text for s in signals):
            return True
    return False