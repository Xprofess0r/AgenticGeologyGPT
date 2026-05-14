"""
nodes/query_node.py  (v8 — FINAL)

ROOT CAUSES FIXED:

1. "Compiler design" was passing because:
   - No keyword match (correct)
   - Gemini planner was called with prompt "is_out_of_scope = true ONLY if..."
   - Gemini said is_out_of_scope=false for compiler design (too lenient)
   → FIX: Planner prompt is now strict geology-only. If no keyword → DEFAULT BLOCK.
     Planner can only CONFIRM geology, not override a block.

2. "Groundwater pollution" was not getting web search because:
   - Keyword "groundwater" matched → is_geology=True ✓ (correct)
   - But web_search_node was still being skipped (fixed in separate file)

ARCHITECTURE (final, clean):
  - Keyword match → PASS immediately, set good search queries
  - No keyword match → BLOCK immediately (no Gemini call wasted)
  - Gemini planner ONLY runs for keyword-matched queries to improve search queries
  - Result: 0 wasted Gemini calls on off-topic queries
"""

import os
import json
import time
import re
import httpx
from graph_state import AgentState

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# ── Comprehensive geology keyword set ─────────────────────────
_GEO_KEYWORDS = {
    # Core disciplines
    "geolog", "petrol", "minerolog", "litholog", "paleontol", "stratigraph",
    "sedimentolog", "geomorpholog", "hydrogeol", "geophys", "geochem",
    "volcanolog", "seismolog", "tecton", "geotecton",
    # Rocks (all types)
    "rock", "ore", "igneous", "metamorph", "sediment", "strata", "stratum",
    "basalt", "granite", "rhyolite", "andesite", "diorite", "gabbro",
    "obsidian", "pumice", "limestone", "sandstone", "shale", "mudstone",
    "conglomerate", "breccia", "chalk", "flint", "chert", "coal",
    "slate", "phyllite", "schist", "gneiss", "marble", "quartzite",
    "hornfels", "eclogite", "fossil",
    # Minerals
    "mineral", "crystal", "gem", "quartz", "feldspar", "mica", "calcite",
    "dolomite", "olivine", "pyroxene", "amphibole", "magnetite", "hematite",
    "pyrite", "halite", "gypsum", "fluorite", "apatite", "topaz", "corundum",
    "zircon", "garnet", "talc", "kaolin", "tourmaline", "beryl",
    "mohs", "luster", "lustre", "streak",
    # Earth processes
    "earthquake", "seismic", "fault", "fold", "volcani", "eruption",
    "erosion", "weathering", "depositi", "subduct", "orogen",
    "magma", "lava", "ash", "tephra", "caldera", "vent", "dike", "sill",
    "tsunami", "liquefaction", "landslide", "sinkhole", "karst",
    "isostasy", "diagenesis", "compaction", "lithification", "metamorphism",
    # Earth structure
    "mantle", "crust", "lithosphere", "asthenosphere",
    "plate", "rift", "trench", "hotspot", "batholith", "pluton", "moho",
    # Stratigraphy
    "formation", "unconformity", "precambrian", "cambrian", "ordovician",
    "silurian", "devonian", "carboniferous", "permian", "triassic",
    "jurassic", "cretaceous", "paleogene", "neogene", "quaternary",
    "pleistocene", "holocene",
    # Geophysics/seismics
    "seismic wave", "p-wave", "s-wave", "refraction", "impedance",
    "borehole", "well log", "wireline", "gamma ray", "gravity anomaly",
    "magnetic anomaly", "geothermal",
    # Hydrogeology (IMPORTANT: "groundwater", "aquifer" must be here)
    "aquifer", "groundwater", "spring", "geyser", "porosity", "permeability",
    "transmissivity", "water table", "vadose", "phreatic", "contamina",
    "pollut",  # groundwater pollution, contamination
    # Petroleum
    "petroleum", "oil well", "gas field", "hydrocarbon", "reservoir rock",
    "source rock", "kerogen",
    # Glacial
    "glacier", "glacial", "glaciation", "moraine", "drumlin", "esker",
    "fluvial", "alluvial", "meander", "floodplain", "delta",
    # Geomorphology
    "canyon", "escarpment", "peneplain", "mesa", "butte",
    # Mining / exploration (Image 1 context)
    "mining", "mine", "excavat", "open pit", "underground mine",
    "mineral exploration", "remote sensing geology", "geophysical survey",
    # Field methods
    "outcrop", "core sample", "thin section", "strike", "dip",
    "isotope", "radiometric",
}

# ── Explicit non-geology blocklist — these MUST be blocked even if
#    a geology keyword somehow appears in the same sentence ─────
_NONGEOLOGY_SIGNALS = {
    "machine learning", "deep learning", "neural network", "artificial intelligence",
    "compiler", "programming language", "algorithm", "data structure",
    "python code", "javascript", "software engineer", "web development",
    "react", "node.js", "database", "sql", "api endpoint",
    "stock market", "cryptocurrency", "investment", "trading",
    "recipe", "cooking", "food", "restaurant",
    "movie", "film", "music", "song", "lyrics",
    "sports", "football", "cricket", "basketball",
    "medicine", "disease", "hospital", "drug",
    "history", "politics", "government", "election",
    "math problem", "calculus", "linear algebra",
    "astronomy", "space", "planet", "galaxy", "star",  # NOT geology
    "biology", "chemistry formula", "physics equation",
}


def _is_geology(query: str) -> bool:
    """
    Two-stage check:
    1. If query contains any NON-geology signal → BLOCK immediately
    2. If query contains a geology keyword → PASS
    3. Otherwise → BLOCK
    """
    lower = query.lower()

    # Stage 1: Hard block on clear non-geology topics
    for signal in _NONGEOLOGY_SIGNALS:
        if signal in lower:
            print(f"[QueryNode] Non-geology signal detected: '{signal}'")
            return False

    # Stage 2: Must have at least one geology keyword
    for kw in _GEO_KEYWORDS:
        if kw in lower:
            return True

    return False


def _parse_gemini_json(raw: str) -> dict:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip()).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Cannot parse JSON: {text[:200]}")


def _generate_search_queries(query: str, history: list[dict]) -> tuple[str, str]:
    """
    Use Gemini to generate optimised RAG and web search queries.
    Only called AFTER geology is confirmed — purely for query quality.
    Falls back to raw query on any error.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return query, f"geology {query}"

    system = (
        "You are a search query optimizer for a geology AI system. "
        "The user query is CONFIRMED to be about geology. "
        "Generate optimized search queries. "
        "Return ONLY valid JSON (no markdown, no explanation):\n"
        '{"rag_query": "geology-specific keywords for vector DB search", '
        '"search_query": "precise web search query for geology information"}'
    )

    history_text = ""
    if history:
        history_text = "\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-4:]
        )

    prompt = f"{history_text}\n\nUser query: {query}\n\nReturn JSON only."

    url = f"{BASE_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {"maxOutputTokens": 150, "temperature": 0.1},
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()

        data = resp.json()
        raw  = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        plan         = _parse_gemini_json(raw)
        rag_query    = plan.get("rag_query",    query) or query
        search_query = plan.get("search_query", f"geology {query}") or f"geology {query}"
        return rag_query, search_query

    except Exception as exc:
        print(f"[QueryNode] Query optimizer failed (using defaults): {exc}")
        return query, f"geology {query}"


def query_node(state: AgentState) -> AgentState:
    query   = state["query"]
    history = state.get("history", [])

    print(f"[QueryNode] Processing: '{query[:80]}'")
    t0 = time.time()

    # ── GEOLOGY GATE (keyword + blocklist, 0ms, 0 API calls) ──
    geology_confirmed = _is_geology(query)
    elapsed = round((time.time() - t0) * 1000)

    if not geology_confirmed:
        print(f"[QueryNode] BLOCKED — not geology [{elapsed}ms]")
        return {
            **state,
            "rag_query":        query,
            "search_query":     query,
            "is_geology":       False,
            "embedding_score":  0.0,
            "_query_embedding": None,
        }

    print(f"[QueryNode] PASS — geology confirmed [{elapsed}ms]")

    # ── Geology confirmed — generate optimised search queries ──
    rag_query, search_query = _generate_search_queries(query, history)
    elapsed = round((time.time() - t0) * 1000)
    print(f"[QueryNode] Search queries ready [{elapsed}ms]")
    print(f"  rag_query:    {rag_query[:80]}")
    print(f"  search_query: {search_query[:80]}")

    return {
        **state,
        "rag_query":        rag_query,
        "search_query":     search_query,
        "is_geology":       True,
        "embedding_score":  0.92,
        "_query_embedding": None,
    }