"""
services/embedding_service.py  (v5 — Gemini embeddings, Cohere dropped)

WHY SWITCH FROM COHERE TO GEMINI:
  - Cohere free tier: 100 calls/min → quota exhausts immediately on PDF upload
  - gemini-embedding-001: 1500 RPM free tier, same API key as chat
  - No new API key, no new bill, no new SDK — just a different endpoint
  - Dimension: 1024 (matching your existing Pinecone index DIMENSION=1024)

SpaceGPT uses: GoogleGenAIEmbedding via LlamaIndex (models/embedding-001)
We use:        Direct REST to gemini-embedding-001 (same underlying model)
               outputDimensionality: 1024 matches existing Pinecone index
"""

import os
import time
import httpx
import math

BASE_URL       = "https://generativelanguage.googleapis.com/v1beta"
EMBED_MODEL    = "gemini-embedding-001"   # 1024-dim, matches your Pinecone index
OUTPUT_DIM     = 1024                      # Must match PINECONE index dimension

# Simple rate limiter — Gemini embedding: 1500 RPM free tier
_last_embed_time: float = 0.0
_MIN_EMBED_INTERVAL    = 0.05  # 50ms = max 20 req/s, well under 1500 RPM


def _rate_limit():
    global _last_embed_time
    elapsed = time.time() - _last_embed_time
    if elapsed < _MIN_EMBED_INTERVAL:
        time.sleep(_MIN_EMBED_INTERVAL - elapsed)
    _last_embed_time = time.time()


def embed_query(text: str) -> list[float]:
    """Embed a single query string. task_type=RETRIEVAL_QUERY."""
    return _embed(text, "RETRIEVAL_QUERY")


def embed_document(text: str) -> list[float]:
    """Embed a single document chunk. task_type=RETRIEVAL_DOCUMENT."""
    return _embed(text, "RETRIEVAL_DOCUMENT")


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of document chunks with progress logging."""
    embeddings = []
    for i, text in enumerate(texts):
        if i > 0 and i % 10 == 0:
            print(f"[EmbedService] Progress: {i}/{len(texts)} chunks embedded")
            time.sleep(1.0)  # 1s pause every 10 to be safe
        embeddings.append(embed_document(text))
    return embeddings


def _embed(text: str, task_type: str) -> list[float]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    _rate_limit()

    url = f"{BASE_URL}/models/{EMBED_MODEL}:embedContent?key={api_key}"
    payload = {
        "model":   f"models/{EMBED_MODEL}",
        "content": {"parts": [{"text": text[:8000]}]},
        "taskType": task_type,
        "outputDimensionality": OUTPUT_DIM,
    }

    MAX_RETRIES = 3
    for attempt in range(MAX_RETRIES):
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, json=payload)

            if resp.status_code == 429:
                wait = 5 * (2 ** attempt)
                print(f"[EmbedService] Rate limited — waiting {wait}s")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data   = resp.json()
            values = data.get("embedding", {}).get("values", [])
            if not values:
                raise ValueError("Empty embedding returned")
            return values

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            print(f"[EmbedService] Network error attempt {attempt+1}: {exc}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(3)
                continue
            raise

    raise RuntimeError(f"Embedding failed after {MAX_RETRIES} attempts")


# ── Cosine similarity (for reference / debugging) ─────────────
def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)