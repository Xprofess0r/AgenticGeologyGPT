"""
nodes/block_node.py  (unchanged — correct as-is)

Only reached when ALL signals fail:
  embedding low + no RAG evidence + no geology web results + no keywords
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
    query  = state.get("query", "")
    reason = state.get("_decision_reason", "non-geology query")
    print(f"[BlockNode] Blocking: '{query[:60]}' — {reason}")
    return {**state, "final_answer": OFF_TOPIC_REPLY, "sources": []}
