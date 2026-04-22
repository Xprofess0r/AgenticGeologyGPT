# GeologyGPT v4 — Bug Fixes Summary

## Critical Bugs Fixed (blocked ALL responses)

### 1. `asyncio.run()` crash inside FastAPI
**File:** `nodes/answer_node.py`  
**Problem:** `generate_answer()` was `async def`. Calling it via `asyncio.run()` inside FastAPI's event loop throws `RuntimeError: This event loop is already running`.  
**Fix:** Made `generate_answer()` fully **sync** using `httpx.Client` (blocking). Removed all `asyncio.run()` calls.

### 2. Sync FastAPI endpoint blocking event loop
**File:** `main.py`  
**Problem:** `agent_endpoint` was `def` (sync). With the async Gemini call, the whole chain was broken.  
**Fix:** Changed to `async def` + `loop.run_in_executor(ThreadPoolExecutor)` to run sync LangGraph without blocking FastAPI.

### 3. Pinecone v3 dict vs object access
**File:** `services/pinecone_service.py`  
**Problem:** `result.get("matches", [])` returns nothing — Pinecone v3 returns an **object** (`QueryResponse`), not a dict.  
**Fix:** Changed to `result.matches`, `m.score`, `m.metadata` (attribute access).

### 4. Cohere v5 API breaking changes
**File:** `services/embedding_service.py`  
**Problem:** `cohere.Client()` removed in v5. `response.embeddings[0]` → must be `response.embeddings.float_[0]`.  
**Fix:** Use `cohere.ClientV2()` with `embedding_types=["float"]`. Fallback for v4.

### 5. Wrong pip package name
**File:** `requirements.txt`  
**Problem:** `pinecone-client` is the old deprecated package. Current package is `pinecone`.  
**Fix:** Changed to `pinecone==3.2.2`. Also removed unused `langchain*` packages.

## High Priority Fixes

### 6. No Gemini rate limiting
**File:** `services/gemini_service.py`  
**Fix:** Added `_rate_limit_wait()` enforcing 4s minimum between calls (≤15 RPM).

### 7. Geology guard too strict
**Files:** `nodes/decision_node.py`, `nodes/query_node.py`  
**Problem:** Threshold 0.65 blocked valid geology queries. Cohere v5 scores are slightly lower.  
**Fix:** Lowered to 0.55. Added keyword fallback as 4th signal so any geology keyword guarantees PASS.

### 8. `nest_asyncio` missing from requirements
**File:** `requirements.txt`  
**Fix:** Added `nest-asyncio==1.6.0` (though no longer needed after the async fix).

## How to Run

```bash
# 1. Install dependencies
cd python_agent
pip install -r requirements.txt

# 2. Copy and fill .env
cp .env.example .env

# 3. Start the agent
uvicorn main:app --host 0.0.0.0 --port 8000

# 4. Run logic tests (no API keys needed)
python test_logic.py

# 5. Test the endpoint
curl -X POST http://localhost:8000/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "What is granite?", "history": []}'
```

## Gemini Quota Management

- Free tier: 15 RPM (requests per minute)
- **This agent makes exactly 1 Gemini call per user query**
- Rate limiter enforces 4s gap between calls
- Off-topic queries (blocked) = 0 Gemini calls
- Retry on 429/503: waits 5s then 10s before giving up
