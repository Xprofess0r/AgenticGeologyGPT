"""
services/gemini_service.py

Gemini answer generation service.
Single call per request — injects RAG + web context.
Uses strict system prompt to prevent hallucination.
"""

import os
import httpx
import time
import asyncio
import google.generativeai as genai

MODEL = "gemini-1.5-flash"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

DR_TERRA_SYSTEM = """You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

STRICT RULE: You ONLY answer questions about geology and earth sciences. This includes:
petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology,
geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology,
seismology, field mapping, rock/mineral identification, and geological processes.

ACCURACY RULES:
- Base your answer STRICTLY on the provided CONTEXT sections below.
- If no context is provided, use your geology expertise but clearly state it.
- Cite [Source N] for document context, [Web N] for web results.
- NEVER fabricate mineral properties, rock names, measurements, or citations.
- When uncertain, say so explicitly — do not guess.
- Prefer context over general knowledge when both are available.

ANSWER FORMAT:
- Use markdown headers for complex topics.
- Define technical jargon on first use.
- Be thorough but concise — aim for quality over length.
- Add practical fieldwork tips where relevant."""

gemini_lock = asyncio.Lock()

async def generate_answer(
    query: str,
    rag_results: list[dict],
    web_results: list[dict],
    history: list[dict] | None = None,
) -> str: 
    async with gemini_lock:

     await asyncio.sleep(5)
     api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    
    """
    Generate a final answer using Gemini.

    Args:
        query: The user's query.
        rag_results: Retrieved RAG chunks [{text, source, score, ...}].
        web_results: Web search results [{title, url, snippet, ...}].
        history: Conversation history [{role, content}, ...].

    Returns:
        Generated answer string.
    """
    
    

    # ── Build context block ───────────────────────────────────
    context_block = ""

    if rag_results:
        chunks_text = "\n\n---\n\n".join(
            f"[Source {i + 1} — {c['source'].replace('_', ' ')}, "
            f"{round(c['score'] * 100)}% relevant]\n{c['text']}"
            for i, c in enumerate(rag_results)
        )
        context_block += f"\n=== UPLOADED DOCUMENT CONTEXT ===\n{chunks_text}\n=== END ===\n"

    if web_results:
        web_text = "\n\n---\n\n".join(
            f"[Web {i + 1} — {r['title']}]\n{r['url']}\n{r['snippet']}"
            for i, r in enumerate(web_results)
        )
        context_block += f"\n=== WEB SEARCH RESULTS ===\n{web_text}\n=== END ===\n"

    # ── Accuracy instruction ──────────────────────────────────
    if context_block:
        accuracy_note = (
            "IMPORTANT: Base your answer primarily on the CONTEXT provided above.\n"
            "Cite [Source N] or [Web N] inline when using specific facts.\n"
            "Do NOT fabricate data not present in the context."
        )
    else:
        accuracy_note = (
            "No external context provided. Answer from your geology expertise.\n"
            "Be precise — do not fabricate data, properties, or measurements."
        )

    # ── Conversation history (last 6 turns) ──────────────────
    history_text = ""
    if history:
        turns = history[-6:]
        history_text = "\n\n".join(
            f"{'Student' if m['role'] == 'user' else 'Dr. Terra'}: {m['content']}"
            for m in turns
        )

    # ── Final prompt ──────────────────────────────────────────
    prompt = (
        f"{context_block}\n"
        f"{accuracy_note}\n\n"
        f"{history_text}\n\n"
        f"Student: {query}"
    ).strip()

    # ── Gemini REST call ──────────────────────────────────────
    url = f"{BASE_URL}/{MODEL}:generateContent?key={api_key}"

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": DR_TERRA_SYSTEM}]},
        "generationConfig": {
            "topP": 0.8,
            "maxOutputTokens": 1024,
            "temperature": 0.4,
        },
    }

    # PROFESSIONAL FIX 2: Better retry logic and handling
    async with httpx.AsyncClient(timeout=120.0) as client:
        # We use a 5-attempt jittered backoff
        for attempt in range(5):
            try:
                url = f"{BASE_URL}/{MODEL}:generateContent?key={api_key}"
                resp = await client.post(url, json=payload)

                if resp.status_code == 429:
                    
                    wait_time = 15 + (attempt * 10) 
                    print(f"[Gemini] Quota Exhausted. Global Lock Active for {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue

                resp.raise_for_status()
                data = resp.json()
                
                return data["candidates"][0]["content"]["parts"][0]["text"]

            except Exception as e:
                if attempt == 4:
                    return "System is currently overwhelmed. Please try again in 60 seconds."
                await asyncio.sleep(2)