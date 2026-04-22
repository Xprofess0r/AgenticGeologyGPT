"""
nodes/answer_node.py  (v5 — SpaceGPT-aligned)

SpaceGPT pipeline:
  1. critique_node: filters & consolidates retrieved_docs + search_results
  2. writer_node:   generates final answer from filtered_context

We implement both steps here (one Gemini call = critique+write combined)
to save quota. For higher quality, they can be split.
"""

import time
from services.gemini_service import generate_answer
from graph_state import AgentState


def answer_node(state: AgentState) -> AgentState:
    query       = state["query"]
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])
    history     = state.get("history",     [])

    print(f"[AnswerNode] Generating answer (rag={len(rag_results)}, web={len(web_results)})")
    t0 = time.time()

    try:
        answer = generate_answer(
            query=query,
            rag_results=rag_results,
            web_results=web_results,
            history=history,
        )
    except Exception as exc:
        print(f"[AnswerNode] Gemini failed: {exc}")
        answer = (
            "⚠️ Dr. Terra is temporarily unavailable. "
            "Please check your GEMINI_API_KEY and try again."
        )

    elapsed = round((time.time() - t0) * 1000)

    # Build sources
    doc_sources = [
        {
            "type":        "document",
            "label":       c.get("source", "unknown").replace("_", " ").removesuffix(".pdf"),
            "preview":     (c.get("text", "")[:130]) + "…",
            "score":       c.get("score", 0.0),
            "chunk_index": c.get("chunk_index", 0),
        }
        for c in rag_results
    ]

    web_sources = [
        {
            "type":    "web",
            "label":   r.get("title",   "Web Result"),
            "url":     r.get("url",     ""),
            "preview": (r.get("snippet", "")[:130]) + "…",
            "score":   r.get("score",   0.7),
        }
        for r in web_results
    ]

    sources = doc_sources + web_sources
    print(f"[AnswerNode] Done — {len(answer)} chars, {len(sources)} sources [{elapsed}ms]")

    return {**state, "final_answer": answer, "sources": sources}