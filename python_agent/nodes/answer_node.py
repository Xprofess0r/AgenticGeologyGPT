import asyncio
from services.gemini_service import generate_answer
from graph_state import AgentState

# CHANGE: Define as an async function
async def answer_node(state: AgentState) -> dict:
    """
    Generate answer using Gemini with all available context.
    Uses native async/await to respect the global rate limit lock.
    """
    query = state["query"]
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])
    history = state.get("history", [])

    # PROFESSIONAL FIX: Force a 4-second gap before the FINAL answer call.
    # This gives the QueryNode (embedding) time to 'clear' the 15 RPM limit.
    print(f"[AnswerNode] Pausing 4s for Free Tier quota...")
    await asyncio.sleep(4) 

    print(f"[AnswerNode] Generating answer (rag={len(rag_results)}, web={len(web_results)})")

    try:
        # CHANGE: Await the service directly (no asyncio.run)
        answer = await generate_answer(
            query=query,
            rag_results=rag_results,
            web_results=web_results,
            history=history,
        )

    except Exception as exc:
        print(f"[AnswerNode] Gemini call failed: {exc}")
        answer = "⚠️ Dr. Terra is temporarily unavailable due to high traffic. Please try again in a moment."

    # ── Build sources list ─────────────────────────────────────
    doc_sources = [
        {
            "type": "document",
            "label": c["source"].replace("_", " ").removesuffix(".pdf"),
            "preview": c["text"][:130] + "…",
            "score": c["score"],
            "chunk_index": c.get("chunk_index", 0),
        }
        for c in rag_results
    ]

    web_sources = [
        {
            "type": "web",
            "label": r["title"],
            "url": r["url"],
            "preview": r["snippet"][:130] + "…",
            "score": r.get("score", 0.7),
        }
        for r in web_results
    ]

    sources = doc_sources + web_sources
    print(f"[AnswerNode] Done — {len(answer)} chars, {len(sources)} sources")

    # IMPORTANT: In LangGraph, nodes return the UPDATED state keys
    return {"final_answer": answer, "sources": sources}