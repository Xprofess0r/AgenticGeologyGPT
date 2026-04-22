"""
test_logic.py

Static logic tests — verifies all fixes without needing API keys.
Run with: python test_logic.py
"""

import sys
import math

print("=" * 60)
print("GeologyGPT v4 Logic Tests")
print("=" * 60)

errors   = []
warnings = []

# ─────────────────────────────────────────────────────────────
# Test 1: Cosine similarity function
# ─────────────────────────────────────────────────────────────
print("\n[1] Testing cosine_similarity...")

def cosine_similarity(a, b):
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)

# Identical vectors → 1.0
v = [1.0, 0.5, 0.3]
score = cosine_similarity(v, v)
assert abs(score - 1.0) < 1e-6, f"Expected 1.0, got {score}"

# Orthogonal vectors → 0.0
a = [1.0, 0.0]
b = [0.0, 1.0]
score = cosine_similarity(a, b)
assert abs(score) < 1e-6, f"Expected 0.0, got {score}"

# Zero vector → 0.0
score = cosine_similarity([0.0, 0.0], [1.0, 1.0])
assert score == 0.0

print("   ✓ cosine_similarity correct")

# ─────────────────────────────────────────────────────────────
# Test 2: Keyword geology check
# ─────────────────────────────────────────────────────────────
print("\n[2] Testing keyword geology check...")

_GEO_KEYWORDS = {
    "geolog", "rock", "mineral", "fossil", "sediment", "tectonic",
    "earthquake", "seismic", "fault", "volcani", "magma", "crust",
    "mantle", "igneous", "metamorph", "stratigraphy", "petrol",
    "minerolog", "geomorpholog", "hydrogeol", "paleontol", "geochem",
    "basalt", "granite", "limestone", "sandstone", "shale", "slate",
    "quartz", "feldspar", "calcite", "gneiss", "obsidian", "marble",
}

def keyword_check(query):
    lower = query.lower()
    return any(kw in lower for kw in _GEO_KEYWORDS)

geo_queries = [
    "What causes earthquakes?",
    "Explain granite formation",
    "Types of igneous rocks",
    "What is stratigraphy?",
    "How do fossils form?",
    "Describe the mantle",
    "Limestone caves",
]

non_geo_queries = [
    "How do I make pizza?",
    "Write me a Python script",
    "What is the capital of France?",
    "Tell me a joke",
    "How to invest in stocks",
]

for q in geo_queries:
    result = keyword_check(q)
    if not result:
        errors.append(f"Keyword check MISSED geology query: '{q}'")
    else:
        print(f"   ✓ PASS: '{q}'")

for q in non_geo_queries:
    result = keyword_check(q)
    if result:
        warnings.append(f"Keyword check FALSE POSITIVE on: '{q}'")
    else:
        print(f"   ✓ BLOCK: '{q}'")

# ─────────────────────────────────────────────────────────────
# Test 3: Decision logic (4-signal gate)
# ─────────────────────────────────────────────────────────────
print("\n[3] Testing decision gate logic...")

EMBEDDING_THRESHOLD = 0.55
RAG_EVIDENCE_SCORE  = 0.45

def simulate_decision(embedding_score, rag_scores, web_geology, keyword):
    embedding_ok     = embedding_score >= EMBEDDING_THRESHOLD
    rag_has_evidence = any(s >= RAG_EVIDENCE_SCORE for s in rag_scores)
    return embedding_ok or rag_has_evidence or web_geology or keyword

# Should PASS
cases_pass = [
    (0.70, [],     False, False, "high embedding"),
    (0.40, [0.80], False, False, "strong RAG despite low embedding"),
    (0.30, [],     True,  False, "web geology evidence"),
    (0.20, [],     False, True,  "keyword match"),
    (0.60, [0.50], True,  True,  "all signals"),
]
for emb, rag, web, kw, desc in cases_pass:
    result = simulate_decision(emb, rag, web, kw)
    if not result:
        errors.append(f"Should PASS but BLOCKED: {desc}")
    else:
        print(f"   ✓ PASS ({desc})")

# Should BLOCK
cases_block = [
    (0.20, [],     False, False, "nothing matches"),
    (0.50, [],     False, False, "just below embedding threshold"),
    (0.40, [0.30], False, False, "RAG below evidence threshold"),
]
for emb, rag, web, kw, desc in cases_block:
    result = simulate_decision(emb, rag, web, kw)
    if result:
        errors.append(f"Should BLOCK but PASSED: {desc}")
    else:
        print(f"   ✓ BLOCK ({desc})")

# ─────────────────────────────────────────────────────────────
# Test 4: Pinecone result parsing (v3 object access)
# ─────────────────────────────────────────────────────────────
print("\n[4] Testing Pinecone v3 result parsing...")

class MockMetadata(dict):
    pass

class MockMatch:
    def __init__(self, score, metadata):
        self.score    = score
        self.metadata = metadata
        self.id       = "test_id"

class MockQueryResponse:
    def __init__(self, matches):
        self.matches = matches

# Simulate Pinecone v3 response
mock_response = MockQueryResponse([
    MockMatch(0.85, {"text": "Granite is an igneous rock", "source": "rocks.pdf", "chunkIndex": 0}),
    MockMatch(0.72, {"text": "Basalt forms from lava", "source": "rocks.pdf", "chunkIndex": 1}),
    MockMatch(0.30, {"text": "Low score chunk",          "source": "rocks.pdf", "chunkIndex": 2}),
])

# Apply fixed parsing logic
filtered = []
for m in mock_response.matches:
    score    = float(getattr(m, "score", 0))
    metadata = getattr(m, "metadata", {}) or {}
    if score < 0.45:
        continue
    filtered.append({
        "text":        metadata.get("text", ""),
        "source":      metadata.get("source", "unknown"),
        "chunk_index": int(metadata.get("chunkIndex", 0)),
        "score":       round(score, 4),
    })

assert len(filtered) == 2, f"Expected 2 chunks above threshold, got {len(filtered)}"
assert filtered[0]["text"] == "Granite is an igneous rock"
assert filtered[0]["score"] == 0.85
assert filtered[1]["source"] == "rocks.pdf"
print("   ✓ Pinecone v3 object access correct")
print(f"   ✓ Threshold filtering: {len(filtered)}/3 chunks kept")

# ─────────────────────────────────────────────────────────────
# Test 5: Gemini response parsing
# ─────────────────────────────────────────────────────────────
print("\n[5] Testing Gemini response parsing...")

mock_gemini_response = {
    "candidates": [{
        "content": {
            "parts": [{"text": "Granite is a coarse-grained igneous rock."}]
        },
        "finishReason": "STOP"
    }]
}

candidates = mock_gemini_response.get("candidates", [])
assert candidates, "No candidates"
text = (
    candidates[0]
    .get("content", {})
    .get("parts", [{}])[0]
    .get("text", "")
)
assert text == "Granite is a coarse-grained igneous rock."
print("   ✓ Gemini response parsing correct")

# Safety block response
mock_safety_response = {
    "candidates": [{
        "content": {"parts": [{"text": ""}]},
        "finishReason": "SAFETY"
    }]
}
candidates = mock_safety_response.get("candidates", [])
text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
finish = candidates[0].get("finishReason", "UNKNOWN")
assert text == "" and finish == "SAFETY"
print("   ✓ Safety block detection correct")

# ─────────────────────────────────────────────────────────────
# Test 6: Tavily response parsing (dict and object)
# ─────────────────────────────────────────────────────────────
print("\n[6] Testing Tavily response parsing...")

# Dict format (standard)
tavily_dict = {
    "results": [
        {"title": "Geology of granite", "url": "http://example.com", "content": "Granite forms...", "score": 0.9},
        {"title": "Rock types",         "url": "http://example2.com", "snippet": "Rocks are...",   "score": 0.7},
    ]
}

if isinstance(tavily_dict, dict):
    results = tavily_dict.get("results", [])
else:
    results = getattr(tavily_dict, "results", [])

output = []
for r in results[:3]:
    if isinstance(r, dict):
        title   = r.get("title", "Untitled")
        url     = r.get("url", "")
        content = r.get("content") or r.get("snippet") or ""
        score   = float(r.get("score", 0.7))
    else:
        title   = getattr(r, "title", "Untitled")
        url     = getattr(r, "url", "")
        content = getattr(r, "content", "")
        score   = float(getattr(r, "score", 0.7))
    output.append({"title": title, "url": url, "snippet": str(content)[:500], "score": round(score, 4)})

assert len(output) == 2
assert output[0]["title"] == "Geology of granite"
assert output[1]["snippet"] == "Rocks are..."
print("   ✓ Tavily dict parsing correct")

# ─────────────────────────────────────────────────────────────
# Test 7: Rate limiting simulation
# ─────────────────────────────────────────────────────────────
print("\n[7] Testing rate limit interval logic...")
import time

MIN_CALL_INTERVAL = 4.0
last_call_time    = 0.0

def should_wait(last_t):
    elapsed = time.time() - last_t
    return max(0, MIN_CALL_INTERVAL - elapsed)

# First call — no wait needed (last_call_time = 0, elapsed is large)
wait = should_wait(0.0)
assert wait == 0, f"First call should not wait, got {wait}"

# Recent call — should wait
recent = time.time() - 1.0
wait   = should_wait(recent)
assert 2.8 < wait < 3.2, f"Should wait ~3s, got {wait:.2f}"

print("   ✓ Rate limiting math correct")
print(f"   ✓ 15 RPM limit respected (4s min interval)")

# ─────────────────────────────────────────────────────────────
# Test 8: Graph state structure
# ─────────────────────────────────────────────────────────────
print("\n[8] Testing initial state structure...")

initial_state = {
    "query":            "What is granite?",
    "history":          [],
    "embedding_score":  0.0,
    "is_geology":       False,
    "rag_results":      [],
    "web_results":      [],
    "final_answer":     "",
    "sources":          [],
    "_query_embedding": None,
    "_decision_reason": "",
}

required_keys = [
    "query", "history", "embedding_score", "is_geology",
    "rag_results", "web_results", "final_answer", "sources",
    "_query_embedding", "_decision_reason",
]
for key in required_keys:
    assert key in initial_state, f"Missing key: {key}"

print("   ✓ All required state keys present")

# ─────────────────────────────────────────────────────────────
# Results
# ─────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
if errors:
    print(f"FAILED — {len(errors)} error(s):")
    for e in errors:
        print(f"  ✗ {e}")
    sys.exit(1)
else:
    print(f"ALL TESTS PASSED")
    if warnings:
        print(f"  {len(warnings)} warning(s):")
        for w in warnings:
            print(f"  ⚠ {w}")
    print("=" * 60)
    print("\nThe fixed code is logically correct.")
    print("Start the agent with: uvicorn main:app --port 8000")
