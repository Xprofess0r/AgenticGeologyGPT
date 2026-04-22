"""
services/embedding_service.py  (FIXED v2)

Bugs fixed in this version:
  1. Geology reference text EXPANDED with seismic/stratigraphic terminology.
     The old reference scored "seismic units" at only 0.35 because
     "seismic units / seismic facies / sequence stratigraphy" were absent.
  2. Reference is still cached via @lru_cache — computed once per process.
  3. Cohere v5 (ClientV2) and v4 (Client) both handled.
"""

import os
import math
from functools import lru_cache

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    api_key = os.environ.get("COHERE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("COHERE_API_KEY not set in environment")

    import cohere
    try:
        # cohere v5
        _client = cohere.ClientV2(api_key=api_key)
    except AttributeError:
        # cohere v4 fallback
        _client = cohere.Client(api_key=api_key)
    return _client


def embed_query(text: str) -> list[float]:
    """Embed a query string using Cohere (search_query input_type)."""
    client = _get_client()
    try:
        # cohere v5
        response = client.embed(
            texts=[text[:8000]],
            model="embed-english-v3.0",
            input_type="search_query",
            embedding_types=["float"],
        )
        return list(response.embeddings.float_[0])
    except AttributeError:
        # cohere v4
        response = client.embed(
            texts=[text[:8000]],
            model="embed-english-v3.0",
            input_type="search_query",
        )
        return list(response.embeddings[0])


# ── EXPANDED geology reference ────────────────────────────────
# Old reference lacked seismic/stratigraphic terms causing low scores
# for queries like "seismic units", "seismic facies", "systems tracts".

_GEO_REFERENCE = (
    # Core earth sciences
    "geology earth science rocks minerals tectonics fossils stratigraphy "
    "geomorphology paleontology sedimentology petrology volcanology "
    "seismology hydrogeology geochemistry structural geology "
    "igneous metamorphic sedimentary lithosphere mantle crust earthquake fault "
    # Seismic interpretation — ADDED (was missing; caused 0.35 scores)
    "seismic units seismic facies seismic stratigraphy seismic sequence "
    "seismic reflection seismic section seismic horizon seismic profile "
    "seismic interpretation seismic attributes acoustic impedance reflector "
    "two-way travel time p-wave s-wave seismic wave velocity "
    "sequence stratigraphy systems tract depositional sequence "
    "unconformity onlap offlap toplap downlap clinoform truncation "
    "transgressive regressive highstand lowstand "
    # Subsurface / reservoir
    "borehole core sample subsurface reservoir formation well log "
    "porosity permeability fluid saturation caprock trap "
    # Structural
    "anticline syncline fold thrust fault normal fault strike-slip "
    "plate tectonics subduction orogeny convergent divergent "
    "batholith pluton intrusion extrusion dike sill "
    # Rock types / mineralogy
    "granite basalt limestone sandstone shale slate marble gneiss "
    "quartz feldspar calcite dolomite obsidian pumice coal petroleum "
    "crystal cleavage hardness luster fracture mohs scale "
    # Geomorphology / surface
    "erosion weathering deposition soil terrain canyon valley delta "
    "glacier fluvial aeolian coastal karst geomorphic process"
)


@lru_cache(maxsize=1)
def get_geology_reference_embedding() -> tuple:
    """
    Returns geology reference embedding as a cached tuple.
    Computed once per process start.
    """
    client = _get_client()
    try:
        # cohere v5
        response = client.embed(
            texts=[_GEO_REFERENCE],
            model="embed-english-v3.0",
            input_type="search_document",
            embedding_types=["float"],
        )
        return tuple(response.embeddings.float_[0])
    except AttributeError:
        # cohere v4
        response = client.embed(
            texts=[_GEO_REFERENCE],
            model="embed-english-v3.0",
            input_type="search_document",
        )
        return tuple(response.embeddings[0])


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Fast cosine similarity without numpy."""
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)
