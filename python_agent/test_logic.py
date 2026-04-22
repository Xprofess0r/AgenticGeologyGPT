"""
test_pipeline.py — Validate all services work before running the full server.
Run: python test_pipeline.py

Tests:
  1. Gemini API key + planner call
  2. Gemini embedding
  3. Pinecone connection
  4. Tavily web search (optional)
  5. Full agent graph (no PDF needed)
"""

import os, sys, time
from dotenv import load_dotenv
load_dotenv()

PASS = "✅"
FAIL = "❌"
SKIP = "⏭️"

results = []

def check(name, fn):
    try:
        result = fn()
        print(f"  {PASS} {name}: {result}")
        results.append((name, True))
    except Exception as e:
        print(f"  {FAIL} {name}: {e}")
        results.append((name, False))

print("\n" + "="*55)
print("GeologyGPT v5 — Pipeline Validation")
print("="*55)

# ── 1. Environment keys ───────────────────────────────────────
print("\n[1] Environment variables")
check("GEMINI_API_KEY",   lambda: "set" if os.environ.get("GEMINI_API_KEY") else (_ for _ in ()).throw(ValueError("NOT SET")))
check("PINECONE_API_KEY", lambda: "set" if os.environ.get("PINECONE_API_KEY") else (_ for _ in ()).throw(ValueError("NOT SET")))
check("TAVILY_API_KEY",   lambda: "set (optional)" if os.environ.get("TAVILY_API_KEY") else "not set (web search disabled)")

# ── 2. Gemini planner call ────────────────────────────────────
print("\n[2] Gemini planner (query_node)")
def test_planner():
    from nodes.query_node import _call_gemini_planner
    plan = _call_gemini_planner("What minerals are found in granite?", [])
    assert "rag_query" in plan, "Missing rag_query"
    assert "is_out_of_scope" in plan, "Missing is_out_of_scope"
    assert plan["is_out_of_scope"] == False, "Granite question wrongly flagged as out-of-scope"
    return f"rag_query='{plan['rag_query'][:50]}'"
check("Gemini planner", test_planner)

# ── 3. Gemini embedding ───────────────────────────────────────
print("\n[3] Gemini embedding (embedding_service)")
def test_embedding():
    from services.embedding_service import embed_query
    vec = embed_query("granite mineral composition")
    assert len(vec) == 1024, f"Expected 1024-dim, got {len(vec)}"
    return f"dim={len(vec)}, first={vec[0]:.4f}"
check("Gemini embed", test_embedding)

# ── 4. Pinecone connection ────────────────────────────────────
print("\n[4] Pinecone connection (pinecone_service)")
def test_pinecone():
    from services.pinecone_service import _get_index
    idx = _get_index()
    stats = idx.describe_index_stats()
    return f"vectors={stats.total_vector_count}"
check("Pinecone connect", test_pinecone)

# ── 5. Tavily web search ──────────────────────────────────────
print("\n[5] Tavily web search (optional)")
if os.environ.get("TAVILY_API_KEY"):
    def test_tavily():
        from services.web_search_service import search_web
        results = search_web("granite rock composition geology", max_results=2)
        return f"{len(results)} results"
    check("Tavily search", test_tavily)
else:
    print(f"  {SKIP} Tavily: TAVILY_API_KEY not set — skipping")

# ── 6. Full agent graph ───────────────────────────────────────
print("\n[6] Full agent graph (no PDF)")
def test_graph():
    from graph import run_agent
    result = run_agent("What is igneous rock?", history=[])
    assert result["is_geology"] == True, "Igneous rock query was blocked!"
    assert len(result["answer"]) > 50, "Answer too short"
    return f"is_geology={result['is_geology']}, answer_len={len(result['answer'])}, rag={result['rag_count']}, web={result['web_count']}"
check("Full agent graph", test_graph)

# ── Summary ───────────────────────────────────────────────────
print("\n" + "="*55)
passed = sum(1 for _, ok in results if ok)
total  = len(results)
print(f"Results: {passed}/{total} passed")

if passed == total:
    print("🎉 All checks passed — server is ready to start!")
elif passed >= total - 1:
    print("⚠️  Minor issue — check the failed test above.")
else:
    print("🔴 Critical failures — fix the errors above before starting server.")
print("="*55 + "\n")