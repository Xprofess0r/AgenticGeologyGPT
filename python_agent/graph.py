"""
graph.py — LangGraph agent pipeline.

Flow:
  query_node → retriever_node → web_search_node → decision_node
    → answer_node (geology)
    → block_node  (off-topic)

Timing logged at graph level so you can see total breakdown.
"""

import time
from langgraph.graph import StateGraph, END

from graph_state            import AgentState
from nodes.query_node       import query_node
from nodes.retriever_node   import retriever_node
from nodes.web_search_node  import web_search_node
from nodes.decision_node    import decision_node, route_after_decision
from nodes.answer_node      import answer_node
from nodes.block_node       import block_node


def build_graph():
    g = StateGraph(AgentState)

    g.add_node("query_node",      query_node)
    g.add_node("retriever_node",  retriever_node)
    g.add_node("web_search_node", web_search_node)
    g.add_node("decision_node",   decision_node)
    g.add_node("answer_node",     answer_node)
    g.add_node("block_node",      block_node)

    g.set_entry_point("query_node")
    g.add_edge("query_node",      "retriever_node")
    g.add_edge("retriever_node",  "web_search_node")
    g.add_edge("web_search_node", "decision_node")

    g.add_conditional_edges(
        "decision_node",
        route_after_decision,
        {"answer_node": "answer_node", "block_node": "block_node"},
    )

    g.add_edge("answer_node", END)
    g.add_edge("block_node",  END)

    return g.compile()


compiled_graph = build_graph()


def run_agent(query: str, history: list[dict] | None = None) -> dict:
    """Synchronous agent runner — called from main.py via ThreadPoolExecutor."""
    t_start = time.time()

    initial_state: AgentState = {
        "query":            query,
        "history":          history or [],
        "embedding_score":  0.0,
        "is_geology":       False,
        "rag_results":      [],
        "web_results":      [],
        "final_answer":     "",
        "sources":          [],
        "_query_embedding": None,
        "_decision_reason": "",
    }

    print(f"\n{'='*60}")
    print(f"[Graph] Query: '{query[:80]}'")
    print(f"{'='*60}")

    try:
        final_state = compiled_graph.invoke(initial_state)
    except Exception as exc:
        import traceback
        print(f"[Graph] FATAL: {exc}")
        traceback.print_exc()
        return {
            "answer":          "⚠️ Agent encountered an error. Please try again.",
            "sources":         [],
            "embedding_score": 0.0,
            "is_geology":      False,
            "rag_count":       0,
            "web_count":       0,
            "decision_reason": f"error: {exc}",
        }

    elapsed = round((time.time() - t_start) * 1000)
    is_geo  = final_state.get("is_geology", False)

    print(f"[Graph] Done — is_geology={is_geo}, total={elapsed}ms")
    print(f"{'='*60}\n")

    return {
        "answer":          final_state.get("final_answer",     ""),
        "sources":         final_state.get("sources",          []),
        "embedding_score": final_state.get("embedding_score",  0.0),
        "is_geology":      is_geo,
        "rag_count":       len(final_state.get("rag_results",  [])),
        "web_count":       len(final_state.get("web_results",  [])),
        "decision_reason": final_state.get("_decision_reason", ""),
    }