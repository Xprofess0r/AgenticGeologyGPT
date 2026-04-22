"""
services/pinecone_service.py  (v5)

No logic changes needed — pinecone v3 attribute access is already correct.
Dimension aligned to 1024 (gemini-embedding-001 default).
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
        raise RuntimeError("PINECONE_API_KEY not set")

    from pinecone import Pinecone
    _pc    = Pinecone(api_key=api_key)

    # Check if index exists
    existing = _pc.list_indexes()
    names = [idx.name for idx in existing]

    if index_name not in names:
        print(f"[PineconeService] Creating index '{index_name}' dim=1024 ...")
        from pinecone import ServerlessSpec
        _pc.create_index(
            name=index_name,
            dimension=1024,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        # Wait for ready
        import time
        for i in range(20):
            time.sleep(3)
            desc = _pc.describe_index(index_name)
            if getattr(desc.status, "ready", False):
                print(f"[PineconeService] Index '{index_name}' ready.")
                break
            print(f"[PineconeService] Waiting for index... ({i+1}/20)")

    _index = _pc.Index(index_name)
    print(f"[PineconeService] Connected to index '{index_name}'")
    return _index


def upsert_vectors(vectors: list[dict]) -> None:
    """Upsert list of {id, values, metadata} in batches of 100."""
    index = _get_index()
    BATCH = 100
    for i in range(0, len(vectors), BATCH):
        index.upsert(vectors=vectors[i:i+BATCH])
    print(f"[PineconeService] Upserted {len(vectors)} vectors")


def query_pinecone(
    query_vector: list[float],
    top_k: int = 8,
    score_threshold: float = 0.35,
    return_top: int = 5,
) -> list[dict]:
    """
    Query Pinecone, filter by threshold, return top results.
    Threshold 0.35 is appropriate for gemini-embedding-001 cosine scores.
    """
    try:
        index  = _get_index()
        result = index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True,
        )

        raw_matches = result.matches  # Pinecone v3: object not dict

        chunks = []
        for m in raw_matches:
            score    = float(getattr(m, "score", 0))
            metadata = getattr(m, "metadata", {}) or {}

            if score < score_threshold:
                continue

            chunks.append({
                "text":        metadata.get("text",        ""),
                "source":      metadata.get("source",      "unknown"),
                "chunk_index": int(metadata.get("chunkIndex", 0)),
                "score":       round(score, 4),
            })

        chunks.sort(key=lambda x: x["score"], reverse=True)
        results = chunks[:return_top]

        print(f"[PineconeService] {len(results)}/{len(raw_matches)} chunks above threshold={score_threshold}")
        return results

    except RuntimeError:
        raise
    except Exception as exc:
        print(f"[PineconeService] query failed: {exc}")
        return []


def delete_by_source(source: str) -> None:
    try:
        index = _get_index()
        index.delete(filter={"source": {"$eq": source}})
        print(f"[PineconeService] Deleted vectors for source: {source}")
    except Exception as exc:
        print(f"[PineconeService] delete_by_source error: {exc}")