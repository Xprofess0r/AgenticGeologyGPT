"""
services/pinecone_service.py  (FIXED)

Fixes applied:
  1. result.get("matches", []) → result.matches  (Pinecone v3 returns object, not dict)
  2. m["metadata"] → m.metadata  (Match object attribute access)
  3. m["score"] → m.score
  4. Added safe attribute access with getattr fallbacks
  5. Package: requires 'pinecone' not 'pinecone-client'
"""

import os

_pc    = None
_index = None


def _get_index():
    global _pc, _index
    if _index is not None:
        return _index

    api_key    = os.environ.get("PINECONE_API_KEY", "").strip()
    index_name = os.environ.get("PINECONE_INDEX_NAME", "geologygpt").strip()

    if not api_key:
        raise RuntimeError("PINECONE_API_KEY not set in environment")

    from pinecone import Pinecone
    _pc    = Pinecone(api_key=api_key)
    _index = _pc.Index(index_name)
    print(f"[PineconeService] Connected to index '{index_name}'")
    return _index


def query_pinecone(
    query_vector: list[float],
    top_k: int = 8,
    score_threshold: float = 0.5,
    return_top: int = 3,
) -> list[dict]:
    """
    Query Pinecone and return filtered, ranked chunks.

    Returns:
        List of dicts: {text, source, chunk_index, score}
    """
    try:
        index  = _get_index()
        result = index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True,
        )

        # FIXED: Pinecone v3 returns QueryResponse object
        # result.matches is a list of ScoredVector objects (NOT a dict)
        raw_matches = result.matches  # ← was: result.get("matches", [])

        filtered = []
        for m in raw_matches:
            # FIXED: attribute access, not dict key access
            score    = float(getattr(m, "score", 0))
            metadata = getattr(m, "metadata", {}) or {}

            if score < score_threshold:
                continue

            filtered.append({
                "text":        metadata.get("text", ""),
                "source":      metadata.get("source", "unknown"),
                "chunk_index": int(metadata.get("chunkIndex", 0)),
                "score":       round(score, 4),
            })

        # Sort descending by score
        filtered.sort(key=lambda x: x["score"], reverse=True)
        results = filtered[:return_top]

        print(f"[PineconeService] {len(results)} chunks above threshold={score_threshold}")
        return results

    except RuntimeError:
        raise
    except Exception as exc:
        print(f"[PineconeService] query failed: {exc}")
        return []
