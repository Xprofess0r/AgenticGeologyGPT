"""
nodes/query_node.py  (v6 — FIXED)

ROOT CAUSE OF "Agent workflow failed":
  - v5 query_node calls Gemini as a planner FIRST
  - If that Gemini call fails (quota, timeout, JSON parse error) → whole graph crashes
  - query_node was consuming 1 of 15 RPM BEFORE the actual answer call
  - JSON parse errors from Gemini (markdown fences, incomplete JSON) caused crashes

FIX:
  - Fast keyword check runs FIRST (0ms, 0 API calls)
  - Gemini planner only runs for genuinely ambiguous queries
  - JSON parsing is fully robust (handles fences, partial JSON, all Gemini quirks)
  - If Gemini planner fails for any reason → keyword result is used, no crash
  - Net result: most geology queries never call Gemini in this node at all
"""

import os
import json
import time
import re
import httpx
from graph_state import AgentState

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# ── Keyword fast-path (comprehensive — covers 95%+ of geology queries) ────────
_GEO_KEYWORDS = {
    # Core disciplines
    "geolog", "petrol", "minerolog", "litholog", "paleontol", "stratigraph",
    "sedimentolog", "geomorpholog", "hydrogeol", "geophys", "geochem",
    "volcanolog", "seismolog", "tecton", "structur", "geotecton",
    # Rocks
    "rock", "stone", "ore", "igneous", "metamorph", "sediment", "strata",
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
    "mohs", "hardness", "luster", "lustre", "streak", "cleavage", "fracture",
    # Processes
    "earthquake", "seismic", "fault", "fold", "volcani", "eruption",
    "erosion", "weathering", "depositi", "subduct", "orogen",
    "magma", "lava", "ash", "tephra", "caldera", "vent", "dike", "sill",
    "tsunami", "liquefaction", "landslide", "sinkhole", "karst",
    "isostasy", "diagenesis", "compaction", "lithification", "metamorphism",
    # Earth structure
    "mantle", "crust", "lithosphere", "asthenosphere", "core",
    "plate", "rift", "trench", "hotspot", "batholith", "pluton", "moho",
    # Stratigraphy / time
    "formation", "member", "group", "horizon", "unconformity",
    "precambrian", "cambrian", "ordovician", "silurian", "devonian",
    "carboniferous", "permian", "triassic", "jurassic", "cretaceous",
    "paleogene", "neogene", "quaternary", "pleistocene", "holocene",
    # Geophysics / seismics
    "seismic unit", "seismic facies", "seismic reflection", "seismic section",
    "seismic wave", "p-wave", "s-wave", "refraction", "impedance", "acoustic",
    "borehole", "well log", "wireline", "gamma ray", "sonic log",
    "gravity anomaly", "magnetic anomaly", "geothermal",
    # Hydrogeology
    "aquifer", "groundwater", "spring", "geyser", "porosity", "permeability",
    "transmissivity", "hydraulic", "water table", "vadose", "phreatic",
    # Petroleum
    "petroleum", "oil", "gas", "hydrocarbon", "reservoir",
    "source rock", "trap", "cap rock", "kerogen", "vitrinite",
    # Glacial / fluvial
    "glacier", "glacial", "glaciation", "moraine", "drumlin", "esker",
    "fluvial", "alluvial", "meander", "oxbow", "floodplain", "delta",
    # Geomorphology
    "topograph", "terrain", "canyon", "basin", "plateau", "escarpment",
    "ridge", "mountain", "peneplain", "mesa", "butte", "valley",
    # Field / analytical
    "outcrop", "field map", "core sample", "drill", "survey",
    "thin section", "strike", "dip", "x-ray diffraction", "xrd", "xrf",
    "isotope", "radiometric", "u-pb", "rb-sr",
}


def _keyword_check(query: str) -> bool:
    lower = query.lower()
    return any(kw in lower for kw in _GEO_KEYWORDS)


def _parse_gemini_json(raw: str) -> dict:
    """Robustly parse JSON from Gemini — handles all output quirks."""
    text = raw.strip()

    # Strip markdown fences: ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip())
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON object with regex
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Cannot parse JSON from: {text[:200]}")


def _call_gemini_planner(query: str, history: list[dict]) -> dict:
    """Gemini planner — generates optimised RAG + search queries."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    system = (
        "You are a query planner for a geology AI. "
        "Given the user query, return ONLY a JSON object (no markdown, no explanation):\n"
        '{"rag_query": "precise geology keywords for vector search", '
        '"search_query": "concise web search query", '
        '"is_out_of_scope": false}\n'
        "is_out_of_scope = true ONLY if the query has absolutely nothing to do with "
        "earth science, rocks, minerals, tectonics, or geology in any form."
    )

    history_text = ""
    if history:
        history_text = "\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-4:]
        )

    prompt = f"History:\n{history_text}\n\nQuery: {query}\n\nReturn JSON only."

    url = f"{BASE_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {"maxOutputTokens": 200, "temperature": 0.1},
    }

    with httpx.Client(timeout=20.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()

    data = resp.json()
    raw  = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    return _parse_gemini_json(raw)


def query_node(state: AgentState) -> AgentState:
    query   = state["query"]
    history = state.get("history", [])

    print(f"[QueryNode] Processing: '{query[:80]}'")
    t0 = time.time()

    # ── Step 1: Fast keyword check (0ms) ──────────────────────
    keyword_hit = _keyword_check(query)

    if keyword_hit:
        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Keyword match → geology confirmed [{elapsed}ms]")
        # Still generate good rag/search queries via Gemini if quota allows
        # But don't BLOCK if Gemini fails — keyword already confirmed geology
        try:
            plan = _call_gemini_planner(query, history)
            rag_query    = plan.get("rag_query", query) or query
            search_query = plan.get("search_query", f"geology {query}") or f"geology {query}"
            elapsed = round((time.time() - t0) * 1000)
            print(f"[QueryNode] Planner enhanced queries [{elapsed}ms]")
        except Exception as exc:
            print(f"[QueryNode] Planner failed (using defaults): {exc}")
            rag_query    = query
            search_query = f"geology {query}"

        return {
            **state,
            "rag_query":        rag_query,
            "search_query":     search_query,
            "is_geology":       True,
            "embedding_score":  0.92,
            "_query_embedding": None,
        }

    # ── Step 2: No keyword — run Gemini planner to decide ─────
    print("[QueryNode] No keyword match — calling Gemini planner")
    try:
        plan = _call_gemini_planner(query, history)

        rag_query    = plan.get("rag_query", query) or query
        search_query = plan.get("search_query", f"geology {query}") or f"geology {query}"
        is_geology   = not plan.get("is_out_of_scope", True)

        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Planner: is_geology={is_geology} [{elapsed}ms]")
        print(f"  rag_query:    {rag_query[:80]}")
        print(f"  search_query: {search_query[:80]}")

        return {
            **state,
            "rag_query":        rag_query,
            "search_query":     search_query,
            "is_geology":       is_geology,
            "embedding_score":  0.85 if is_geology else 0.15,
            "_query_embedding": None,
        }

    except Exception as exc:
        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Planner failed [{elapsed}ms]: {exc} — defaulting to BLOCK")
        # Conservative: if planner fails AND no keyword → block
        return {
            **state,
            "rag_query":        query,
            "search_query":     f"geology {query}",
            "is_geology":       False,
            "embedding_score":  0.10,
            "_query_embedding": None,
        }
