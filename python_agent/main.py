"""
main.py  (v6 — fixed for local + deployment)

Changes:
  - CORS origins from env var NODE_SERVER_URL + always allow localhost
  - asyncio.get_event_loop() deprecated warning fixed → use asyncio.get_running_loop()
  - Startup prints port clearly for Render logs
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

_executor = ThreadPoolExecutor(max_workers=4)

app = FastAPI(
    title="GeologyGPT Python Agent",
    version="1.2.0",
)

# CORS — allow Node.js server and localhost to call this
_node_url = os.environ.get("NODE_SERVER_URL", "")
_cors_origins = [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:8000",
    "*",  # For Render → Render internal calls; restrict after testing
]
if _node_url:
    _cors_origins.append(_node_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Python agent is internal — Node.js is the public gateway
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryMessage(BaseModel):
    role:    str = Field(...)
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


@app.on_event("startup")
async def startup_event():
    port = int(os.environ.get("PYTHON_AGENT_PORT", 8000))
    checks = {
        "GEMINI_API_KEY":   bool(os.environ.get("GEMINI_API_KEY")),
        "PINECONE_API_KEY": bool(os.environ.get("PINECONE_API_KEY")),
        "TAVILY_API_KEY":   bool(os.environ.get("TAVILY_API_KEY")),
    }
    print(f"\n{'='*50}")
    print(f"GeologyGPT Python Agent v1.2 — port {port}")
    for k, v in checks.items():
        print(f"  {k}: {'✓' if v else '✗ MISSING'}")
    print(f"{'='*50}\n")


@app.get("/")
def root():
    return {"status": "GeologyGPT Python Agent 🪨", "version": "1.2.0"}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/agent", response_model=AgentResponse)
async def agent_endpoint(request: AgentRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    history = [{"role": m.role, "content": m.content} for m in request.history]
    t0 = time.time()

    try:
        # Run sync LangGraph graph in thread pool — safe with async FastAPI
        loop   = asyncio.get_running_loop()   # fixed: get_event_loop is deprecated
        result = await loop.run_in_executor(
            _executor,
            lambda: run_agent(query=query, history=history)
        )
    except Exception as exc:
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_AGENT_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
