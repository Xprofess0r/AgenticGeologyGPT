"""
main.py

FastAPI entry point for the GeologyGPT Python agent.
Exposes POST /agent — called by the Node.js API layer.

Usage:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
from dotenv import load_dotenv

# Load .env before importing anything that reads env vars
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import time

from graph import run_agent

# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(
    title="GeologyGPT Python Agent",
    description="LangGraph-based geology agent with semantic guard, RAG, and web search",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Restrict in production to Node.js origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ────────────────────────────────

class HistoryMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class AgentRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryMessage] = Field(default_factory=list)


class SourceItem(BaseModel):
    type: str                    # "document" or "web"
    label: str
    preview: str
    score: float
    url: str | None = None
    chunk_index: int | None = None


class AgentResponse(BaseModel):
    answer: str
    sources: list[dict]
    embedding_score: float
    is_geology: bool
    rag_count: int
    web_count: int
    decision_reason: str
    latency_ms: int


# ── Routes ────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {
        "status": "GeologyGPT Python Agent 🪨",
        "version": "1.0.0",
        "graph": "LangGraph (QueryNode → RetrieverNode → WebSearchNode → DecisionNode → Answer/Block)",
    }


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/agent", response_model=AgentResponse)
async def agent_endpoint(request: AgentRequest):
    """
    Main agent endpoint — called by Node.js chat controller.

    Accepts:
        { "query": "...", "history": [{role, content}, ...] }

    Returns:
        { "answer": "...", "sources": [...], ... }
    """
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    history = [{"role": m.role, "content": m.content} for m in request.history]

    t0 = time.time()
    try:
        result = await run_agent(query=query, history=history)
    except Exception as exc:
        print(f"[main] Agent error: {exc}")
        raise HTTPException(status_code=500, detail=f"Agent failed: {str(exc)}")

    latency_ms = int((time.time() - t0) * 1000)

    return AgentResponse(
        answer=result["answer"],
        sources=result["sources"],
        embedding_score=result["embedding_score"],
        is_geology=result["is_geology"],
        rag_count=result["rag_count"],
        web_count=result["web_count"],
        decision_reason=result["decision_reason"],
        latency_ms=latency_ms,
    )


# ── Dev runner ────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_AGENT_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
