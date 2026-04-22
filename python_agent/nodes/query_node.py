"""
nodes/query_node.py

QueryNode — Node 1 of the LangGraph pipeline.

Fast-path: keyword check → if geology keyword found, skip Cohere embed entirely.
Slow-path: Cohere embed → cosine similarity vs geology reference.

Keyword fast-path saves 1-2s per request when query is clearly geology.
"""

import time
from graph_state import AgentState

SIMILARITY_THRESHOLD = 0.40   # for slow-path Cohere embed

_GEO_KEYWORDS = {
    # ── Core disciplines ─────────────────────────────────────
    "geolog", "petrol", "minerolog", "litholog", "paleontol", "stratigraph",
    "sedimentolog", "geomorpholog", "hydrogeol", "geophys", "geochem",
    "volcanolog", "seismolog", "tecton", "structur", "geotecton",

    # ── Rocks (all major types) ───────────────────────────────
    "rock", "stone", "mineral", "crystal", "gem", "ore",
    "igneous", "metamorph", "sediment", "strata", "stratum",
    "basalt", "granite", "rhyolite", "andesite", "diorite", "gabbro",
    "obsidian", "pumice", "scoria", "tuff", "peridotite", "dunite",
    "limestone", "sandstone", "shale", "mudstone", "siltstone",
    "conglomerate", "breccia", "chalk", "flint", "chert", "coal",
    "evaporite", "turbidite", "flysch", "marl",
    "slate", "phyllite", "schist", "gneiss", "marble", "quartzite",
    "hornfels", "eclogite", "amphibolite", "greenschist",
    "fossil", "amber", "coal", "peat",

    # ── Minerals (all major classes) ─────────────────────────
    "quartz", "feldspar", "mica", "calcite", "dolomite", "olivine",
    "pyroxene", "amphibole", "magnetite", "hematite", "pyrite",
    "halite", "gypsum", "fluorite", "apatite", "topaz", "corundum",
    "zircon", "garnet", "talc", "kaolin", "smectite", "chlorite",
    "biotite", "muscovite", "orthoclase", "plagioclase", "albite",
    "anorthite", "augite", "hornblende", "actinolite", "tremolite",
    "tourmaline", "beryl", "spinel", "andalusite", "kyanite",

    # ── Mineral properties ────────────────────────────────────
    "mohs", "hardness", "luster", "lustre", "streak", "cleavage",
    "fracture", "specific gravity", "crystal system", "crystal habit",
    "tenacity", "transparency", "birefringence", "pleochroism",

    # ── Geological processes ──────────────────────────────────
    "earthquake", "seismic", "fault", "fold", "volcani", "eruption",
    "erosion", "weathering", "depositi", "subduct", "orogen",
    "accretion", "collision", "rifting", "spreading",
    "magma", "lava", "ash", "tephra", "caldera", "vent", "dike", "sill",
    "tsunami", "liquefaction", "landslide", "sinkhole", "karst",
    "isostasy", "isostatic", "rebound",
    "diagenesis", "compaction", "cementation", "lithification",
    "metamorphism", "partial melting", "crystallization", "differentiation",
    "exfoliation", "laterite", "caliche", "pedol",

    # ── Stratigraphy / time ───────────────────────────────────
    "formation", "member", "group", "supergroup", "horizon",
    "unconformity", "disconformity", "angular", "sequence",
    "precambrian", "archean", "proterozoic",
    "paleozoic", "cambrian", "ordovician", "silurian", "devonian",
    "carboniferous", "permian",
    "mesozoic", "triassic", "jurassic", "cretaceous",
    "cenozoic", "paleogene", "neogene", "quaternary",
    "pleistocene", "holocene", "miocene", "oligocene", "eocene",

    # ── Earth structure ───────────────────────────────────────
    "mantle", "crust", "lithosphere", "asthenosphere", "core",
    "plate", "rift", "trench", "hotspot", "mid-ocean",
    "batholith", "pluton", "intrusion", "extrusion",
    "moho", "mohorovic", "gutenberg", "discontinuity",

    # ── Geophysics / seismics ─────────────────────────────────
    "seismic unit", "seismic facies", "seismic reflection",
    "seismic wave", "p-wave", "s-wave", "refraction", "seismic section",
    "amplitude", "impedance", "acoustic", "velocity model",
    "borehole", "well log", "wireline", "gamma ray", "sonic log",
    "magnetic anomaly", "gravity anomaly", "aeromagnetic",
    "geoid", "geothermal", "heat flow",

    # ── Hydrogeology / water ──────────────────────────────────
    "aquifer", "groundwater", "spring", "geyser", "hot spring",
    "porosity", "permeability", "transmissivity", "hydraulic",
    "water table", "vadose", "phreatic",

    # ── Petrology ─────────────────────────────────────────────
    "clast", "grain", "texture", "fabric", "matrix", "cement",
    "foliation", "lineation", "schistosity", "jointing",
    "banding", "lamination", "bedding", "cross-bedding",
    "pore", "void ratio", "confining pressure",

    # ── Petroleum geology ─────────────────────────────────────
    "petroleum", "oil", "gas", "hydrocarbon", "reservoir",
    "source rock", "trap", "seal", "cap rock", "migration",
    "kerogen", "maturation", "vitrinite",

    # ── Glacial / fluvial / coastal ───────────────────────────
    "glacier", "glacial", "glaciation", "moraine", "drumlin", "esker",
    "outwash", "kettle", "fjord", "cirque", "arête",
    "fluvial", "alluvial", "meander", "oxbow", "floodplain", "delta",
    "coastal", "shoreline", "beach", "dune", "longshore",

    # ── Geomorphology ────────────────────────────────────────
    "topograph", "terrain", "slope", "valley", "canyon", "basin",
    "plateau", "escarpment", "ridge", "mountain", "hill", "plain",
    "peneplain", "inselberg", "mesa", "butte",

    # ── Soil / regolith ──────────────────────────────────────
    "soil", "pedol", "regolith", "saprolite", "weathering profile",
    "soil horizon", "clay", "silt", "sand", "gravel",

    # ── Field / analytical methods ────────────────────────────
    "outcrop", "field map", "core sample", "drill", "survey",
    "thin section", "hand specimen", "strike", "dip", "bearing",
    "x-ray diffraction", "xrd", "xrf", "sem", "tem", "eds",
    "geochemical analysis", "isotope", "radiometric", "dating",
    "u-pb", "rb-sr", "sm-nd", "ar-ar",
}


def _keyword_check(query: str) -> bool:
    """Fast keyword check — returns True if query is geology-related."""
    lower = query.lower()
    return any(kw in lower for kw in _GEO_KEYWORDS)


def query_node(state: AgentState) -> AgentState:
    query = state["query"]
    print(f"[QueryNode] Processing: '{query[:80]}'")
    t0 = time.time()

    # ── Fast path: keyword → skip Cohere entirely ─────────────
    if _keyword_check(query):
        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Keyword match → PASS (no embed needed) [{elapsed}ms]")
        return {
            **state,
            "embedding_score":  0.92,   # synthetic high score
            "is_geology":       True,
            "_query_embedding": None,   # retriever will embed for Pinecone
        }

    # ── Slow path: Cohere embed for borderline queries ─────────
    print("[QueryNode] No keyword match — running Cohere embed")
    try:
        from services.embedding_service import (
            embed_query,
            get_geology_reference_embedding,
            cosine_similarity,
        )

        query_embedding = embed_query(query)
        ref_embedding   = list(get_geology_reference_embedding())
        score           = round(cosine_similarity(query_embedding, ref_embedding), 4)
        is_geology      = score >= SIMILARITY_THRESHOLD
        elapsed         = round((time.time() - t0) * 1000)

        print(
            f"[QueryNode] Cohere similarity={score:.4f} "
            f"(threshold={SIMILARITY_THRESHOLD}) → embedding_geology={is_geology} [{elapsed}ms]"
        )

        return {
            **state,
            "embedding_score":  score,
            "is_geology":       is_geology,
            "_query_embedding": query_embedding,
        }

    except Exception as exc:
        elapsed = round((time.time() - t0) * 1000)
        print(f"[QueryNode] Cohere failed [{elapsed}ms]: {exc}")
        return {
            **state,
            "embedding_score":  0.0,
            "is_geology":       False,
            "_query_embedding": None,
        }