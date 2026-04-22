"""
nodes/query_node.py  (v5 — SpaceGPT-aligned)

SpaceGPT's plan_node does THREE things in one:
  1. Generates a precision rag_query for vector search
  2. Generates a web search_query
  3. Decides is_out_of_scope

We replicate the same logic adapted for geology using Gemini structured output.

KEY FIX vs old code:
  - Old code: keyword check first, Cohere embed second — expensive + unreliable
  - New code: Gemini classifies intent AND generates optimised queries in ONE call
    (same as SpaceGPT's plan_node) — much more reliable, queries are better
  - Cohere embed is ONLY used as fallback if Gemini call fails
  - is_out_of_scope check is SEMANTIC not keyword-based (no more false blocks)
"""

import os
import json
import time
import httpx
from graph_state import AgentState

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

PLANNER_SYSTEM = """You are a query understanding engine for a geology AI assistant.

Analyze the user's query and:
1. Decide if it is geology/earth science related (is_out_of_scope = false means IS geology)
2. Generate a precise, keyword-rich rag_query for vector database retrieval
3. Generate a concise search_query optimised for web search

Geology topics include: rocks, minerals, tectonics, stratigraphy, petrology, 
geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology,
seismology, field mapping, structural geology, sedimentology, GIS for geology,
borehole analysis, seismic interpretation, reservoir geology.

Respond ONLY with valid JSON, no markdown fences:
{
  "rag_query": "precise query with geology keywords for vector search",
  "search_query": "concise web search query",
  "is_out_of_scope": false
}"""


def _call_gemini_planner(query: str, history: list[dict]) -> dict:
    """Single Gemini call to plan queries — mirrors SpaceGPT plan_node."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    history_text = ""
    if history:
        history_text = "\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-4:]
        )

    prompt = f"""Chat History:
{history_text}

User Query: {query}

Analyze and return JSON only."""

    url = f"{BASE_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": PLANNER_SYSTEM}]},
        "generationConfig": {
            "maxOutputTokens": 300,
            "temperature": 0.1,  # Low temp for consistent JSON
        },
    }

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()

    data = resp.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    ).strip()

    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def _keyword_fast_path(query: str) -> bool:
    """Broad keyword check — only used as Gemini fallback."""
    _GEO_KW = {
        "geolog", "petrol", "minerolog", "litholog", "paleontol", "stratigraph",
        "sedimentolog", "geomorpholog", "hydrogeol", "geophys", "geochem",
        "volcanolog", "seismolog", "tecton", "rock", "stone", "mineral",
        "crystal", "gem", "ore", "igneous", "metamorph", "sediment",
        "strata", "basalt", "granite", "limestone", "sandstone", "shale",
        "fossil", "earthquake", "seismic", "fault", "fold", "volcani",
        "erosion", "weathering", "magma", "lava", "crust", "mantle",
        "quartz", "feldspar", "calcite", "aquifer", "groundwater",
        "topograph", "terrain", "canyon", "glacier", "fluvial", "soil",
        "outcrop", "borehole", "drill", "stratigraphy", "subduct", "plate",
    }
    lower = query.lower()
    return any(kw in lower for kw in _GEO_KW)


def query_node(state: AgentState) -> AgentState:
    query   = state["query"]
    history = state.get("history", [])

    print(f"[QueryNode] Planning query: '{query[:80]}'")
    t0 = time.time()

    try:
        # ── PRIMARY: Gemini-based planning (SpaceGPT approach) ──
        plan = _call_gemini_planner(query, history)

        rag_query    = plan.get("rag_query", query)
        search_query = plan.get("search_query", f"geology {query}")
        is_geology   = not plan.get("is_out_of_scope", False)

        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Gemini plan done [{elapsed}ms]: is_geology={is_geology}")
        print(f"  rag_query:    {rag_query[:80]}")
        print(f"  search_query: {search_query[:80]}")

        return {
            **state,
            "rag_query":        rag_query,
            "search_query":     search_query,
            "is_geology":       is_geology,
            "embedding_score":  0.90 if is_geology else 0.10,
            "_query_embedding": None,  # will embed in retriever_node
        }

    except Exception as exc:
        # ── FALLBACK: keyword check (free, zero API calls) ──────
        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Gemini planner failed [{elapsed}ms]: {exc}")
        print("[QueryNode] Falling back to keyword check")

        is_geology = _keyword_fast_path(query)
        return {
            **state,
            "rag_query":        f"geology {query}",
            "search_query":     f"geology {query}",
            "is_geology":       is_geology,
            "embedding_score":  0.85 if is_geology else 0.20,
            "_query_embedding": None,
        }