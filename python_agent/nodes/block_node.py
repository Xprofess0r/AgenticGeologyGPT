"""
nodes/block_node.py

BlockNode — Node 6 of the LangGraph pipeline.

Reached ONLY when DecisionNode determines the query is not geology-related
AND no supporting evidence was found in RAG or web results.

Returns the standard off-topic reply with empty sources.
"""

from graph_state import AgentState

OFF_TOPIC_REPLY = (
    "🪨 I'm Dr. Terra, a geology-specialized AI assistant. "
    "I can only answer questions related to **geology, earth sciences, mineralogy, "
    "petrology, tectonics, hydrogeology, geomorphology, paleontology, and related "
    "earth science topics**.\n\n"
    "Please ask me something geology-related — I'd love to help!"
)


def block_node(state: AgentState) -> AgentState:
    """Set final_answer to the off-topic reply and clear sources."""
    query = state.get("query", "")
    reason = state.get("_decision_reason", "non-geology query")

    print(f"[BlockNode] Blocking query: '{query[:60]}' — {reason}")

    return {
        **state,
        "final_answer": OFF_TOPIC_REPLY,
        "sources": [],
    }
