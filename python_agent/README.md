# GeologyGPT v4 — Hybrid Agent Architecture

## Architecture Overview

```
Browser (React)
    ↓ POST /api/chat
Node.js (Express)  ← API layer, PDF upload, session management
    ↓ POST /agent
Python (FastAPI)   ← LangGraph orchestration, semantic guard
    ↓
  ┌─────────────────────────────────────────────────┐
  │  LangGraph Pipeline                             │
  │                                                 │
  │  QueryNode → RetrieverNode → WebSearchNode      │
  │                                  ↓              │
  │              DecisionNode (hybrid guard)        │
  │             ↙                    ↘              │
  │        BlockNode             AnswerNode         │
  │    (off-topic reply)      (Gemini + context)    │
  └─────────────────────────────────────────────────┘
```

## Guard Logic (3-step hybrid)

**Only blocks if ALL THREE are true:**
1. Embedding similarity < 0.65 (vs geology reference text)
2. AND no Pinecone RAG results with score ≥ 0.5
3. AND no geology-relevant web search results

Examples:
| Query | Result |
|---|---|
| `"react js"` | ❌ Blocked — low embedding, no RAG, no geo-web |
| `"types of bivalves"` | ✅ Answered — web search confirms geology |
| `"earthquake causes"` | ✅ Answered — high embedding similarity |
| `"latest seismic research"` | ✅ Answered — web search fallback |
| `"pizza recipe"` | ❌ Blocked — all three signals fail |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- API keys: Gemini, Cohere, Pinecone, Tavily

---

## Step-by-Step Setup

### 1. Clone / extract the project

```bash
unzip AgenticGeologyGPT.zip
cd AgenticGeologyGPT-main
```

---

### 2. Set up Python agent

```bash
cd python_agent

# Create virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `python_agent/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
COHERE_API_KEY=your_cohere_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=geologygpt
TAVILY_API_KEY=your_tavily_api_key
PYTHON_AGENT_PORT=8000
```

Start the Python agent:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify it's running:
```bash
curl http://localhost:8000/health
# → {"ok": true}
```

---

### 3. Set up Node.js server

```bash
cd ../server

npm install

cp .env.example .env
```

Edit `server/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
COHERE_API_KEY=your_cohere_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=geologygpt
TAVILY_API_KEY=your_tavily_api_key
PYTHON_AGENT_URL=http://localhost:8000
ENABLE_NODEJS_FALLBACK=true
PORT=5000
CLIENT_URL=http://localhost:3000
```

Start the server:
```bash
npm run dev
# or: node index.js
```

---

### 4. Set up React client

```bash
cd ../client
npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## Running All Services (production-like)

Open 3 terminals:

**Terminal 1 — Python agent:**
```bash
cd python_agent
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Node.js API:**
```bash
cd server
node index.js
```

**Terminal 3 — React client:**
```bash
cd client
npm start
```

---

## API Reference

### POST /api/chat (Node.js)
```json
{
  "messages": [{"role": "user", "content": "What causes earthquakes?"}],
  "sessionId": "optional-session-id"
}
```

Response:
```json
{
  "reply": "Earthquakes are caused by...",
  "sources": [{"type": "web", "label": "USGS", "url": "..."}],
  "confidence": 0.8,
  "route": "python-agent",
  "evaluation": {
    "embeddingScore": 0.82,
    "isGeology": true,
    "ragCount": 2,
    "webCount": 1
  }
}
```

### POST /agent (Python — internal)
```json
{
  "query": "What causes earthquakes?",
  "history": []
}
```

Response:
```json
{
  "answer": "Earthquakes are caused by...",
  "sources": [...],
  "embedding_score": 0.82,
  "is_geology": true,
  "rag_count": 2,
  "web_count": 1,
  "decision_reason": "PASS — embedding=0.820≥0.65",
  "latency_ms": 1840
}
```

### GET /api/chat/agent-status (Node.js)
```json
{
  "pythonAgent": "online",
  "fallbackEnabled": true
}
```

---

## Project Structure

```
AgenticGeologyGPT-main/
├── client/                         # React frontend (unchanged)
├── server/                         # Node.js API layer
│   ├── controllers/
│   │   └── chatController.js       # ← UPDATED: routes to Python agent
│   ├── services/
│   │   └── pythonAgentService.js   # ← NEW: HTTP client for Python agent
│   ├── agents/                     # Node.js fallback graph (unchanged)
│   ├── routes/
│   │   └── chat.js                 # ← UPDATED: added /agent-status
│   └── .env.example                # ← UPDATED: added PYTHON_AGENT_URL
└── python_agent/                   # ← NEW: Python LangGraph agent
    ├── main.py                     # FastAPI app
    ├── graph.py                    # LangGraph graph definition
    ├── graph_state.py              # AgentState TypedDict
    ├── nodes/
    │   ├── query_node.py           # Embed query, compute geology score
    │   ├── retriever_node.py       # Pinecone RAG (topK=8, threshold=0.5)
    │   ├── web_search_node.py      # Tavily search (only if RAG weak)
    │   ├── decision_node.py        # Hybrid 3-signal guard
    │   ├── answer_node.py          # Gemini answer generation
    │   └── block_node.py           # Off-topic reply
    ├── services/
    │   ├── embedding_service.py    # Cohere embed-english-v3.0
    │   ├── pinecone_service.py     # Pinecone query
    │   ├── web_search_service.py   # Tavily search
    │   └── gemini_service.py       # Gemini REST (single call)
    ├── requirements.txt
    └── .env.example
```

---

## Troubleshooting

**Python agent not starting:**
```bash
# Check Python version (need 3.11+)
python3 --version

# Reinstall deps
pip install --upgrade -r requirements.txt
```

**`COHERE_API_KEY not set` error:**
- Ensure `python_agent/.env` exists and has your key
- The `.env` must be in the `python_agent/` directory (where you run uvicorn from)

**Pinecone index not found:**
- Check `PINECONE_INDEX_NAME` matches the index created when uploading PDFs via Node.js
- Default index name: `geologygpt`

**Web search not triggering:**
- Verify `TAVILY_API_KEY` is set in `python_agent/.env`
- Web search only triggers when RAG is weak (< 2 chunks with score < 0.6)

**Node.js can't reach Python agent:**
- Confirm Python agent is running: `curl http://localhost:8000/health`
- Check `PYTHON_AGENT_URL=http://localhost:8000` in `server/.env`
- Node.js will automatically fall back to its own graph if Python is unreachable
