"""
services/gemini_service.py  (v8 — FINAL)

Changes:
  - System prompt REMOVED the "answer from web if not geology" fallback
    This was allowing off-topic answers to sneak through to Gemini
  - DR_TERRA_SYSTEM is now geology-locked — if somehow a non-geology query
    reaches Gemini, it will refuse politely
  - Web results → Notes → Own expertise chain preserved for geology questions
  - Groundwater pollution fix: web results truly appear first and are used
"""

import os
import time
import httpx

MODEL    = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_last_call_time: float = 0.0
_MIN_CALL_INTERVAL     = 2.0

DR_TERRA_SYSTEM = """You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

YOUR ONLY DOMAIN: Geology and earth sciences. This includes petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology, geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology, seismology, rock/mineral identification, mineral exploration, mining geology, groundwater, geohazards, and all related earth science topics.

IF the question is NOT about geology or earth sciences, respond ONLY with:
"🪨 I can only answer geology questions. Please ask about rocks, minerals, earth processes, or related earth science topics."

=== FOR GEOLOGY QUESTIONS — FOLLOW THESE RULES ===

ANSWER PRIORITY (always follow this order):
  1. WEB SEARCH RESULTS (marked === WEB SEARCH RESULTS ===) → use as PRIMARY source, cite [Web N]
  2. UPLOADED NOTES (marked === UPLOADED NOTES ===) → use to supplement, cite [Source N]
  3. Neither available → answer from your 25 years of geology expertise directly

CRITICAL RULES:
  ✗ NEVER say "not found in notes" and stop — always continue with web results or own knowledge
  ✗ NEVER say "the documents don't cover this" and stop
  ✓ ALWAYS give a complete, expert geology answer
  ✓ When web results exist, USE THEM — they are the primary source
  ✓ Cite [Web N] inline when using web results
  ✓ Cite [Source N] inline when using uploaded notes

FORMAT:
  - Use ## headers for multi-part answers
  - Define technical terms on first use
  - Add practical field tips where relevant
  - Be thorough but concise"""


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

    print(f"[GeminiService] Building prompt — web={len(web_results)}, rag={len(rag_results)}")

    # Log TAVILY status clearly for debugging
    if not web_results:
        tavily = os.environ.get("TAVILY_API_KEY", "").strip()
        if not tavily:
            print("[GeminiService] ⚠️  TAVILY_API_KEY NOT SET — add it on Render!")
        else:
            print("[GeminiService] ℹ️  Tavily key present but returned 0 results")

    # ── Build context — WEB FIRST ─────────────────────────────
    context_block = ""

    if web_results:
        web_text = "\n\n---\n\n".join(
            f"[Web {i+1}] {r['title']}\nURL: {r['url']}\n{r['snippet']}"
            for i, r in enumerate(web_results)
        )
        context_block += (
            "\n=== WEB SEARCH RESULTS — PRIMARY SOURCE, USE THESE TO ANSWER ===\n"
            f"{web_text}\n"
            "=== END WEB RESULTS ===\n\n"
        )

    if rag_results:
        chunks_text = "\n\n---\n\n".join(
            f"[Source {i+1}] {c['source'].replace('_', ' ')} "
            f"({round(c.get('score', 0) * 100)}% match)\n{c['text']}"
            for i, c in enumerate(rag_results)
        )
        context_block += (
            "\n=== UPLOADED NOTES — SUPPLEMENTARY ===\n"
            f"{chunks_text}\n"
            "=== END NOTES ===\n\n"
        )

    # ── Build explicit instruction ─────────────────────────────
    if web_results and rag_results:
        instruction = (
            "Web search results AND uploaded notes are provided.\n"
            "Answer PRIMARILY from web results [Web N].\n"
            "Supplement with notes [Source N] if they add relevant detail.\n"
            "Give a complete, thorough answer."
        )
    elif web_results:
        instruction = (
            "Web search results are provided above.\n"
            "Answer from these results, citing [Web N] inline.\n"
            "Give a complete, thorough answer."
        )
    elif rag_results:
        instruction = (
            "Uploaded notes are provided above.\n"
            "Use them if they cover the topic, citing [Source N] inline.\n"
            "If the notes don't cover this specific topic, answer from your "
            "25 years of geology expertise directly — do NOT say 'not in notes'."
        )
    else:
        instruction = (
            "No external context. Answer from your 25 years of geology expertise.\n"
            "Be thorough and accurate."
        )

    # ── Conversation history ──────────────────────────────────
    history_text = ""
    if history:
        history_text = "\n\n".join(
            f"{'Student' if m['role'] == 'user' else 'Dr. Terra'}: {m['content']}"
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
                raise ValueError("No candidates in Gemini response")

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