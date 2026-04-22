"""
graph.py

LangGraph agent pipeline for GeologyGPT.

Graph flow:
  START
    → query_node        (embed query, compute geology similarity)
    → retriever_node    (Pinecone RAG, topK=8, threshold=0.5)
    → web_search_node   (Tavily, only if RAG weak/empty)
    → decision_node     (hybrid guard: embedding + RAG + web evidence)
    ├── answer_node     (Gemini answer generation, single call)
    └── block_node      (off-topic reply, zero API calls)
  END

Guard logic (only block if ALL three fail):
  1. embedding_score < 0.65
  2. AND no RAG evidence (no chunk score >= 0.5)
  3. AND no geology-relevant web results
"""

from langgraph.graph import StateGraph, END

from graph_state import AgentState
from nodes.query_node import query_node
from nodes.retriever_node import retriever_node
from nodes.web_search_node import web_search_node
from nodes.decision_node import decision_node, route_after_decision
from nodes.answer_node import answer_node
from nodes.block_node import block_node


def build_graph() -> StateGraph:
    """
    Construct and compile the LangGraph state machine.
    Returns a compiled graph ready to invoke.
    """
    graph = StateGraph(AgentState)

    # ── Register nodes ────────────────────────────────────────
    graph.add_node("query_node",      query_node)
    graph.add_node("retriever_node",  retriever_node)
    graph.add_node("web_search_node", web_search_node)
    graph.add_node("decision_node",   decision_node)
    graph.add_node("answer_node",     answer_node)
    graph.add_node("block_node",      block_node)

    # ── Define edges (sequential pipeline) ───────────────────
    graph.set_entry_point("query_node")
    graph.add_edge("query_node",      "retriever_node")
    graph.add_edge("retriever_node",  "web_search_node")
    graph.add_edge("web_search_node", "decision_node")

    # ── Conditional edge after decision ───────────────────────
    graph.add_conditional_edges(
        "decision_node",
        route_after_decision,
        {
            "answer_node": "answer_node",
            "block_node":  "block_node",
        },
    )

    # ── Terminal edges ────────────────────────────────────────
    graph.add_edge("answer_node", END)
    graph.add_edge("block_node",  END)

    return graph.compile()


# ── Module-level compiled graph (singleton) ───────────────────
# Compiled once at import time; reused across all requests.
compiled_graph = build_graph()


async def run_agent(query: str, history: list[dict] | None = None) -> dict:
    """
    Execute the agent graph synchronously.

    Args:
        query:   User's query string.
        history: Conversation history list [{role, content}].

    Returns:
        dict with keys: answer, sources, embedding_score, is_geology
    """
    initial_state: AgentState = {
        "query": query,
        "history": history or [],
        "embedding_score": 0.0,
        "is_geology": False,
        "rag_results": [],
        "web_results": [],
        "final_answer": "",
        "sources": [],
        "_query_embedding": None,
        "_decision_reason": "",
    }

    print(f"\n{'='*60}")
    print(f"[Graph] Starting agent — query: '{query[:80]}'")
    print(f"{'='*60}")

    final_state = await compiled_graph.ainvoke(initial_state)

    print(f"[Graph] Completed — is_geology={final_state.get('is_geology')}")
    print(f"{'='*60}\n")

    return {
        "answer":          final_state.get("final_answer", ""),
        "sources":         final_state.get("sources", []),
        "embedding_score": final_state.get("embedding_score", 0.0),
        "is_geology":      final_state.get("is_geology", False),
        "rag_count":       len(final_state.get("rag_results", [])),
        "web_count":       len(final_state.get("web_results", [])),
        "decision_reason": final_state.get("_decision_reason", ""),
    }
