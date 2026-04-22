"""
services/pinecone_service.py

Pinecone retrieval service.
Queries the same index used by Node.js ingest pipeline.
topK=8, returns top 3 chunks with score > 0.5.
"""

import os
from pinecone import Pinecone

_pc: Pinecone | None = None
_index = None


def _get_index():
    global _pc, _index
    if _index is not None:
        return _index

    api_key = os.environ.get("PINECONE_API_KEY")
    index_name = os.environ.get("PINECONE_INDEX_NAME", "geologygpt")

    if not api_key:
        raise RuntimeError("PINECONE_API_KEY not set")

    _pc = Pinecone(api_key=api_key)
    _index = _pc.Index(index_name)
    return _index


def query_pinecone(
    query_vector: list[float],
    top_k: int = 8,
    score_threshold: float = 0.5,
    return_top: int = 3,
) -> list[dict]:
    """
    Query Pinecone and return filtered, ranked chunks.

    Args:
        query_vector: Query embedding vector.
        top_k: Number of candidates to retrieve from Pinecone.
        score_threshold: Minimum cosine score to keep.
        return_top: Number of final chunks to return.

    Returns:
        List of dicts: {text, source, chunk_index, score}
    """
    try:
        index = _get_index()
        result = index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True,
        )

        matches = result.get("matches", [])

        # Filter by score threshold
        filtered = [
            {
                "text": m["metadata"].get("text", ""),
                "source": m["metadata"].get("source", "unknown"),
                "chunk_index": int(m["metadata"].get("chunkIndex", 0)),
                "score": round(float(m["score"]), 4),
            }
            for m in matches
            if m.get("score", 0) >= score_threshold
        ]

        # Sort descending by score (Pinecone already does this, but be safe)
        filtered.sort(key=lambda x: x["score"], reverse=True)

        return filtered[:return_top]

    except Exception as exc:
        print(f"[PineconeService] query failed: {exc}")
        return []
