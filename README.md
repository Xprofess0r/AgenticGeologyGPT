# GeologyGPT v2 — RAG + Gemini

Production-ready geology AI with full RAG pipeline.

## Quick Start

### 1. Server setup
```bash
cd server
cp .env.example .env   # Fill in your API keys
npm install
npm run dev
```

### 2. Client setup
```bash
cd client
npm install
npm start
```

## API Keys needed

| Key | Where to get | Cost |
|-----|-------------|------|
| `GEMINI_API_KEY` | [ai.google.dev](https://ai.google.dev) | Free |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | ~$0.02/1M tokens (embeddings only) |
| `PINECONE_API_KEY` | [pinecone.io](https://pinecone.io) | Free tier |

### 100% Free Option
Set `USE_GEMINI_EMBEDDINGS=true` in `.env` and change `dimension: 768` in
`server/services/pineconeService.js` to use Gemini embeddings (no OpenAI needed).

## Architecture

```
PDF Upload → pdf-parse → chunkText → embeddings → Pinecone
                                                      ↓
User Query → embedding → Pinecone query → top-4 chunks
                                                      ↓
                              chunks + query → Gemini → response + sources
```

## New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | RAG + Gemini chat (returns `reply` + `sources`) |
| POST | `/api/explain` | Notes explainer (Gemini) |
| POST | `/api/upload` | PDF ingestion → Pinecone |
