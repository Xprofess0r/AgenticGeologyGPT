"""
services/gemini_service.py  (v6 — FIXED)

Key fix in generate_answer():
  The prompt now EXPLICITLY instructs Gemini to use web results even when
  RAG notes don't cover the topic. Previously Gemini would say
  "not found in your notes" and stop — ignoring web results entirely.
"""

import os
import time
import httpx

MODEL    = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_last_call_time: float = 0.0
_MIN_CALL_INTERVAL     = 2.0

DR_TERRA_SYSTEM = """You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

You specialize in: petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology,
geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology, seismology,
field mapping, rock/mineral identification, GIS for geology, borehole analysis, seismic interpretation,
remote sensing for geology, mineral exploration, geohazards.

ANSWER PRIORITY (follow this order):
1. If WEB SEARCH RESULTS are provided → use them as primary source for answering
2. If UPLOADED DOCUMENT CONTEXT is provided and relevant → cite it with [Source N]
3. If neither covers the topic → answer from your own geology expertise

CRITICAL RULES:
- NEVER say "not found in notes" and stop. Always give a complete answer.
- If notes don't cover the topic but web results do → answer from web results, cite [Web N]
- If neither notes nor web cover it → answer from your 25 years of geology expertise
- NEVER refuse to answer a geology question just because uploaded notes don't mention it
- Cite [Source N] for document chunks, [Web N] for web results, inline
- Use markdown headers for multi-part answers
- Define technical terms on first use"""


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

    # ── Build context sections ────────────────────────────────
    context_block = ""

    if web_results:
        web_text = "\n\n---\n\n".join(
            f"[Web {i+1} — {r['title']}]\nURL: {r['url']}\n{r['snippet']}"
            for i, r in enumerate(web_results)
        )
        # Web results come FIRST — they are often more relevant than uploaded notes
        context_block += f"\n=== WEB SEARCH RESULTS (use these to answer) ===\n{web_text}\n=== END WEB ===\n"

    if rag_results:
        chunks_text = "\n\n---\n\n".join(
            f"[Source {i+1} — {c['source'].replace('_',' ')}, "
            f"{round(c.get('score',0)*100)}% match]\n{c['text']}"
            for i, c in enumerate(rag_results)
        )
        context_block += f"\n=== UPLOADED NOTES CONTEXT ===\n{chunks_text}\n=== END NOTES ===\n"

    # ── Explicit instruction based on what context we have ────
    if web_results and rag_results:
        instruction = (
            "Web search results AND uploaded notes are provided above.\n"
            "Answer primarily from the web results. Supplement with notes if relevant.\n"
            "Cite [Web N] and [Source N] inline."
        )
    elif web_results:
        instruction = (
            "Web search results are provided above. Use them to give a complete answer.\n"
            "Cite [Web N] inline for specific facts."
        )
    elif rag_results:
        instruction = (
            "Uploaded notes are provided above. Use them if relevant.\n"
            "If the notes don't cover this specific topic, answer from your geology expertise.\n"
            "Do NOT say 'not found in notes' — always provide a complete answer."
        )
    else:
        instruction = (
            "No external context available. Answer from your 25 years of geology expertise.\n"
            "Be thorough and accurate."
        )

    # ── Conversation history ───────────────────────────────────
    history_text = ""
    if history:
        history_text = "\n\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-6:]
        )

    prompt = (
        f"{context_block}\n"
        f"{instruction}\n\n"
        f"{history_text}\n\n"
        f"Student: {query}\n"
        f"Dr. Terra:"
    ).strip()

    url = f"{BASE_URL}/{MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": DR_TERRA_SYSTEM}]},
        "generationConfig": {
            "maxOutputTokens": 1800,
            "temperature":     0.6,
        },
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
                    return "⚠️ Response blocked by safety filters. Please rephrase your geology question."
                raise ValueError(f"Empty Gemini response (finishReason={finish_reason})")

            print(f"[GeminiService] Success — {len(text)} chars [{elapsed}ms]")
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
