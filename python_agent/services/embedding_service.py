"""
services/embedding_service.py (Gemini version — FINAL)

✔ Uses Gemini text-embedding-004
✔ No SDK (avoids auth + version issues)
✔ Matches Node embeddingService.js
✔ Supports query + document embeddings
✔ Includes geology domain similarity
"""

import os
import requests
from functools import lru_cache
import math
import time

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set")

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "gemini-embedding-001"


# ── Core embedding function ──────────────────────────────────

def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    """
    task_type:
      - RETRIEVAL_QUERY (for user query)
      - RETRIEVAL_DOCUMENT (for chunks / reference)
    """

    url = f"{BASE_URL}/models/{MODEL}:embedContent?key={GEMINI_API_KEY}"
    payload = {
        "model": f"models/{MODEL}",
        "content": {
            "parts": [{"text": text[:8000]}]
        },
        "taskType": task_type,
        "outputDimensionality": 768
    }
    
   # Add a simple retry for the 429 errors you are seeing
    # FIX 429: Simple backoff retry
    for attempt in range(3):
        response = requests.post(url, json=payload)
        if response.status_code == 429:
            time.sleep(2 ** attempt) 
            continue
        if response.status_code != 200:
            raise RuntimeError(f"Gemini error: {response.text[:200]}")
        break

    return response.json().get("embedding", {}).get("values")

    response = requests.post(url, json=payload)

    if response.status_code != 200:
        raise RuntimeError(f"Gemini embedding error: {response.text[:200]}")

    data = response.json()

    values = data.get("embedding", {}).get("values")

    if not values:
        raise RuntimeError("Empty embedding returned from Gemini")

    return values


# ── Query embedding ──────────────────────────────────────────

def embed_query(text: str) -> list[float]:
    return embed_text(text, "RETRIEVAL_QUERY")


# ── Reference embedding (for domain filtering) ────────────────

_GEO_REFERENCE = (
    "geology earth science rocks minerals tectonics fossils stratigraphy "
    "geomorphology paleontology GIS sedimentology petrology volcanology "
    "seismology hydrogeology geochemistry structural geology plate tectonics "
    "igneous metamorphic sedimentary lithosphere mantle crust earthquake fault"
)


@lru_cache(maxsize=1)
def get_geology_reference_embedding() -> tuple[float, ...]:
    vec = embed_text(_GEO_REFERENCE, "RETRIEVAL_DOCUMENT")
    return tuple(vec)


# ── Cosine similarity ─────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return dot / (mag_a * mag_b)