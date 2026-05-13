"""
services/gemini_service.py  (v7 — DEFINITIVE FIX)

ROOT CAUSE of "skipping web search" even when web_results exist:
  The prompt put RAG notes FIRST and said "base your answer on context".
  Gemini read the seismic notes, found no mining content, said "not found"
  and STOPPED — never reading the web results that were also in the prompt.

FIX:
  1. Web results appear FIRST in the prompt
  2. Explicit fallback chain: Web → Notes → Own expertise
  3. Hard rule in system prompt: NEVER say "not in my notes" and stop
  4. If TAVILY_API_KEY is missing → warn clearly in logs (not silent)
"""

import os
import time
import httpx

MODEL    = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_last_call_time: float = 0.0
_MIN_CALL_INTERVAL     = 2.0   # seconds — safe for 15 RPM free tier

DR_TERRA_SYSTEM = """You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

You are an expert in: petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology, geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology, seismology, field mapping, rock identification, mineral exploration, mining geology, economic geology, remote sensing for geology, borehole analysis, seismic interpretation.

=== CRITICAL ANSWER RULES — FOLLOW THESE EXACTLY ===

RULE 1 — ANSWER PRIORITY (always follow this order):
  a) If WEB SEARCH RESULTS are provided → answer FROM them as the PRIMARY source
  b) If UPLOADED NOTES are provided and relevant → supplement with [Source N] citations
  c) If neither covers the topic → answer from your 25 years of geology expertise

RULE 2 — NEVER do these:
  ✗ NEVER say "the notes don't cover this topic" and stop
  ✗ NEVER say "not found in provided context" and stop  
  ✗ NEVER say "you would need to consult other resources"
  ✗ NEVER refuse to answer a geology question
  ✓ ALWAYS give a complete, expert answer using whatever sources are available

RULE 3 — CITATIONS:
  - Cite web results inline as [Web 1], [Web 2] etc.
  - Cite uploaded notes inline as [Source 1], [Source 2] etc.
  - If answering from your own knowledge, no citation needed

RULE 4 — FORMAT:
  - Use markdown headers (##) for multi-part answers
  - Define technical terms on first use
  - Be thorough but concise
  - Add practical field tips where relevant"""


def _rate_limit():
    global _last_call_time
    elapsed = time.time() - _last_call_time
    if elapsed < _MIN_CALL_INTERVAL:
        wait = _MIN_CALL_INTERVAL - elapsed
        print(f"[GeminiService] Rate limit — waiting {wait:.1f}s")
        time.sleep(wait)
    _last_call_time = time.time()


def generate_answer(
    query: str,
    rag_results: list[dict],
    web_results: list[dict],
    history: list[dict] | None = None,
) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    # Log clearly so you can debug from Render logs
    print(f"[GeminiService] Building prompt — web={len(web_results)}, rag={len(rag_results)}")
    if not web_results:
        tavily_key = os.environ.get("TAVILY_API_KEY", "").strip()
        if not tavily_key:
            print("[GeminiService] ⚠️  TAVILY_API_KEY is NOT SET — web search disabled!")
        else:
            print("[GeminiService] ℹ️  Web search ran but returned 0 results")

    # ── Build context — WEB FIRST ─────────────────────────────
    context_block = ""

    if web_results:
        web_text = "\n\n---\n\n".join(
            f"[Web {i+1}] {r['title']}\nURL: {r['url']}\n{r['snippet']}"
            for i, r in enumerate(web_results)
        )
        context_block += (
            "\n=== WEB SEARCH RESULTS — USE THESE TO ANSWER ===\n"
            f"{web_text}"
            "\n=== END WEB RESULTS ===\n\n"
        )

    if rag_results:
        chunks_text = "\n\n---\n\n".join(
            f"[Source {i+1}] {c['source'].replace('_',' ')} ({round(c.get('score',0)*100)}% match)\n{c['text']}"
            for i, c in enumerate(rag_results)
        )
        context_block += (
            "\n=== UPLOADED NOTES (supplementary) ===\n"
            f"{chunks_text}"
            "\n=== END NOTES ===\n\n"
        )

    # ── Instruction based on available context ────────────────
    if web_results and rag_results:
        instruction = (
            "Both web search results and uploaded notes are available above.\n"
            "Answer PRIMARILY from the web results [Web N].\n"
            "Use the uploaded notes [Source N] only to add extra depth.\n"
            "Give a complete, detailed answer."
        )
    elif web_results:
        instruction = (
            "Web search results are available above.\n"
            "Answer from these results, citing [Web N] inline.\n"
            "Give a complete, detailed answer."
        )
    elif rag_results:
        instruction = (
            "Uploaded notes are available above — use them if relevant.\n"
            "If the notes don't cover this specific topic, "
            "answer from your own 25 years of geology expertise.\n"
            "Do NOT say 'not in my notes' — always give a complete answer."
        )
    else:
        instruction = (
            "No external context available.\n"
            "Answer from your 25 years of geology expertise.\n"
            "Be thorough, accurate, and cite well-known geological principles."
        )

    # ── Conversation history ──────────────────────────────────
    history_text = ""
    if history:
        history_text = "\n\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-6:]
        )

    prompt = (
        f"{context_block}"
        f"{instruction}\n\n"
        f"{history_text}\n\n"
        f"Student: {query}\n"
        f"Dr. Terra:"
    ).strip()

    url = f"{BASE_URL}/{MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": DR_TERRA_SYSTEM}]},
        "generationConfig": {"maxOutputTokens": 1800, "temperature": 0.6},
    }

    MAX_RETRIES = 2
    for attempt in range(MAX_RETRIES + 1):
        _rate_limit()
        print(f"[GeminiService] Attempt {attempt+1}/{MAX_RETRIES+1}")
        t0 = time.time()

        try:
            with httpx.Client(timeout=90.0) as client:
                resp = client.post(url, json=payload)

            elapsed = round((time.time() - t0) * 1000)

            if resp.status_code in (429, 500, 503):
                wait = 5 * (2 ** attempt)
                print(f"[GeminiService] HTTP {resp.status_code} — retry in {wait}s")
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
                    continue
                raise RuntimeError(f"Gemini HTTP {resp.status_code} after retries")

            resp.raise_for_status()
            data       = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("No candidates in response")

            finish_reason = candidates[0].get("finishReason", "UNKNOWN")
            text = (
                candidates[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )

            if not text:
                if finish_reason == "SAFETY":
                    return "⚠️ Response blocked by safety filters. Please rephrase."
                raise ValueError(f"Empty response (finishReason={finish_reason})")

            print(f"[GeminiService] ✓ {len(text)} chars [{elapsed}ms]")
            return text

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            print(f"[GeminiService] Network error attempt {attempt+1}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(5)
                continue

        except RuntimeError:
            raise

        except Exception as exc:
            print(f"[GeminiService] Error attempt {attempt+1}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(3)
                continue

    raise RuntimeError(f"Gemini failed after {MAX_RETRIES} retries")
