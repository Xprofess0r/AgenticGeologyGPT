"""
main.py  (FIXED)

Fixes applied:
  1. agent_endpoint changed from sync `def` → async `async def`
     → FastAPI requires async endpoints when calling any blocking I/O
     → But LangGraph is sync, so we use run_in_executor to avoid blocking event loop
  2. run_agent wrapped in asyncio executor for non-blocking FastAPI integration
  3. Added startup health check logging
  4. Better error responses with specific error types
"""

import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import time

from graph import run_agent

# Thread pool for running sync LangGraph in async FastAPI
_executor = ThreadPoolExecutor(max_workers=4)

app = FastAPI(
    title="GeologyGPT Python Agent",
    description="LangGraph geology agent with RAG, web search, and Gemini",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role:    str = Field(..., description="'user' or 'assistant'")
    content: str


class AgentRequest(BaseModel):
    query:   str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryMessage] = Field(default_factory=list)


class AgentResponse(BaseModel):
    answer:          str
    sources:         list[dict]
    embedding_score: float
    is_geology:      bool
    rag_count:       int
    web_count:       int
    decision_reason: str
    latency_ms:      int


# ── Startup ───────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Log startup env check."""
    checks = {
        "GEMINI_API_KEY":    bool(os.environ.get("GEMINI_API_KEY")),
        "COHERE_API_KEY":    bool(os.environ.get("COHERE_API_KEY")),
        "PINECONE_API_KEY":  bool(os.environ.get("PINECONE_API_KEY")),
        "TAVILY_API_KEY":    bool(os.environ.get("TAVILY_API_KEY")),
    }
    print("\n" + "="*50)
    print("GeologyGPT Python Agent starting up")
    for key, present in checks.items():
        status = "✓" if present else "✗ MISSING"
        print(f"  {key}: {status}")
    print("="*50 + "\n")


# ── Routes ────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {
        "status":  "GeologyGPT Python Agent 🪨",
        "version": "1.1.0",
        "graph":   "QueryNode → RetrieverNode → WebSearchNode → DecisionNode → Answer/Block",
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/agent", response_model=AgentResponse)
async def agent_endpoint(request: AgentRequest):
    """
    Main agent endpoint — called by Node.js chat controller.
    FIXED: async def + ThreadPoolExecutor for sync LangGraph compatibility.
    """
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    history = [{"role": m.role, "content": m.content} for m in request.history]

    t0 = time.time()

    try:
        # FIXED: Run sync LangGraph in thread pool — doesn't block FastAPI event loop
        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor,
            lambda: run_agent(query=query, history=history)
        )
    except Exception as exc:
        print(f"[main] Agent error: {exc}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(exc)}")

    latency_ms = int((time.time() - t0) * 1000)

    return AgentResponse(
        answer          = result["answer"],
        sources         = result["sources"],
        embedding_score = result["embedding_score"],
        is_geology      = result["is_geology"],
        rag_count       = result["rag_count"],
        web_count       = result["web_count"],
        decision_reason = result["decision_reason"],
        latency_ms      = latency_ms,
    )


# ── Dev runner ────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_AGENT_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
