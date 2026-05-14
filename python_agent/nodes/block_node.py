"""
nodes/block_node.py  (v8)

Returns a friendly, clear off-topic message.
"""

from graph_state import AgentState

OFF_TOPIC_REPLY = (
    "🪨 I'm **Dr. Terra**, a geology-specialized AI assistant.\n\n"
    "I can only answer questions about **geology and earth sciences**, including:\n"
    "- Rocks, minerals, and their properties\n"
    "- Plate tectonics, earthquakes, and volcanoes\n"
    "- Stratigraphy, sedimentology, and paleontology\n"
    "- Hydrogeology, groundwater, and aquifers\n"
    "- Geophysics, seismics, and remote sensing\n"
    "- Mineral exploration and mining geology\n"
    "- Geomorphology and earth surface processes\n\n"
    "Please ask me a geology question — I'd love to help! 🌍"
)


def block_node(state: AgentState) -> AgentState:
    query  = state.get("query", "")
    reason = state.get("_decision_reason", "non-geology")
    print(f"[BlockNode] Blocking: '{query[:60]}' — {reason}")
    return {**state, "final_answer": OFF_TOPIC_REPLY, "sources": []}