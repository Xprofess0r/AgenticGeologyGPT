"""
services/gemini_service.py  (v5)

Changes:
  - Model updated to gemini-2.5-flash (matches SpaceGPT)
  - Rate limiter: 2s min interval (safe for 15 RPM free tier)
  - DR_TERRA_SYSTEM: geology-focused but NOT blocking — allows natural answers
  - generate_answer: single clean Gemini call per request
"""

import os
import time
import httpx

MODEL    = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_last_call_time: float = 0.0
_MIN_CALL_INTERVAL     = 2.0  # 2s = safe for 15 RPM free tier

DR_TERRA_SYSTEM = """You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

You specialize in: petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology, geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology, seismology, field mapping, rock/mineral identification, GIS for geology, borehole analysis, seismic interpretation.

ANSWER RULES:
- When CONTEXT sections are provided, base your answer primarily on that context
- Cite [Source N] for document context, [Web N] for web search results inline
- NEVER fabricate mineral properties, rock names, measurements, or citations
- When uncertain, say so explicitly
- Use markdown headers for structured answers
- Define technical jargon on first use
- Be enthusiastic and encouraging for students
- Add practical fieldwork tips where relevant"""


def _rate_limit():
    global _last_call_time
    elapsed = time.time() - _last_call_time
    if elapsed < _MIN_CALL_INTERVAL:
        wait = _MIN_CALL_INTERVAL - elapsed
        print(f"[GeminiService] Rate limit pause {wait:.1f}s")
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

    # ── Build context block (SpaceGPT critique_node equivalent) ──
    context_block = ""

    if rag_results:
        chunks_text = "\n\n---\n\n".join(
            f"[Source {i+1} — {c['source'].replace('_',' ')}, "
            f"{round(c.get('score',0)*100)}% relevant]\n{c['text']}"
            for i, c in enumerate(rag_results)
        )
        context_block += f"\n=== UPLOADED DOCUMENT CONTEXT ===\n{chunks_text}\n=== END ===\n"

    if web_results:
        web_text = "\n\n---\n\n".join(
            f"[Web {i+1} — {r['title']}]\n{r['url']}\n{r['snippet']}"
            for i, r in enumerate(web_results)
        )
        context_block += f"\n=== WEB SEARCH RESULTS ===\n{web_text}\n=== END ===\n"

    # ── Accuracy instruction (SpaceGPT writer_node equivalent) ──
    if context_block:
        accuracy = (
            "Use the CONTEXT above to answer. "
            "Cite [Source N] or [Web N] inline for specific facts. "
            "Do NOT fabricate data not in the context."
        )
    else:
        accuracy = (
            "No external context available. Answer from your geology expertise. "
            "Be precise — do not fabricate data or measurements."
        )

    # ── Conversation history (last 6 turns) ───────────────────
    history_text = ""
    if history:
        history_text = "\n\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-6:]
        )

    prompt = (
        f"{context_block}\n"
        f"{accuracy}\n\n"
        f"{history_text}\n\n"
        f"Student: {query}"
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
                    return "⚠️ Response blocked by Gemini safety filters. Please rephrase your geology question."
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