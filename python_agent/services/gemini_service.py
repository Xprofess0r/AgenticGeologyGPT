"""services/gemini_service.py

Gemini answer generation — sync, single call per request.

Rate limit: gemini-2.5-flash free tier = 15 RPM = 1 call per 4s.
We use 2s minimum interval (safe: max 30 RPM, actual usage ~15 RPM).
The rate limiter only delays if you send requests faster than 1 per 2s.
For normal chat usage (humans type slowly) the wait is usually 0.
"""

import os
import time
import httpx

MODEL    = "gemini-2.5-flash"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Track last Gemini call time globally (per process)
_last_call_time: float = 0.0
_MIN_CALL_INTERVAL     = 2.0   # seconds — safe for 15 RPM free tier

DR_TERRA_SYSTEM = """You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

STRICT RULE: You ONLY answer questions about geology and earth sciences. This includes:
petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology,
geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology,
seismology, field mapping, rock/mineral identification, and geological processes.

ACCURACY RULES:
- Base your answer primarily on the provided CONTEXT sections when available.
- Cite [Source N] for document context, [Web N] for web search results inline.
- NEVER fabricate mineral properties, rock names, measurements, or citations.
- When uncertain, say so explicitly — do not guess.
- Prefer context over general knowledge when both are available.

ANSWER FORMAT:
- Use markdown headers for structured topics.
- Define technical jargon on first use.
- Be thorough but concise — quality over length.
- Add practical fieldwork tips where relevant."""


def _rate_limit_wait():
    """Enforce minimum interval between Gemini calls. Usually 0 wait for human-paced chat."""
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
    """
    Sync Gemini REST call — safe to call from LangGraph nodes.
    Max 2 retries. Rate limited to 2s min interval.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")

    # ── Build context block ───────────────────────────────────
    context_block = ""

    if rag_results:
        chunks_text = "\n\n---\n\n".join(
            f"[Source {i+1} — {c['source'].replace('_',' ')}, "
            f"{round(c['score']*100)}% relevant]\n{c['text']}"
            for i, c in enumerate(rag_results)
        )
        context_block += f"\n=== UPLOADED DOCUMENT CONTEXT ===\n{chunks_text}\n=== END ===\n"

    if web_results:
        web_text = "\n\n---\n\n".join(
            f"[Web {i+1} — {r['title']}]\n{r['url']}\n{r['snippet']}"
            for i, r in enumerate(web_results)
        )
        context_block += f"\n=== WEB SEARCH RESULTS ===\n{web_text}\n=== END ===\n"

    # ── Accuracy instruction ──────────────────────────────────
    if context_block:
        accuracy_note = (
            "Use the CONTEXT above to answer. "
            "Cite [Source N] or [Web N] inline for specific facts. "
            "Do NOT fabricate data not in the context."
        )
    else:
        accuracy_note = (
            "No external context. Answer from your geology expertise. "
            "Be precise — do not fabricate data or measurements."
        )

    # ── Conversation history (last 6 turns) ──────────────────
    history_text = ""
    if history:
        history_text = "\n\n".join(
            f"{'Student' if m['role']=='user' else 'Dr. Terra'}: {m['content']}"
            for m in history[-6:]
        )

    prompt = (
        f"{context_block}\n"
        f"{accuracy_note}\n\n"
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
    last_error  = None

    for attempt in range(MAX_RETRIES + 1):
        _rate_limit_wait()

        print(f"[GeminiService] Attempt {attempt+1}/{MAX_RETRIES+1}")
        t_call = time.time()

        try:
            with httpx.Client(timeout=90.0) as client:
                resp = client.post(url, json=payload)

            elapsed_call = round((time.time() - t_call) * 1000)

            if resp.status_code == 429 or resp.status_code >= 500:
                wait_s = 5 * (2 ** attempt)   # 5s, 10s
                print(
                    f"[GeminiService] HTTP {resp.status_code} — "
                    f"retry {attempt+1}/{MAX_RETRIES} in {wait_s}s"
                )
                if attempt < MAX_RETRIES:
                    time.sleep(wait_s)
                    continue
                else:
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
                    return "⚠️ The response was blocked by Gemini safety filters. Please rephrase your geology question."
                raise ValueError(f"Empty Gemini response (finishReason={finish_reason})")

            print(f"[GeminiService] Success — {len(text)} chars [{elapsed_call}ms]")
            return text

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_error = exc
            print(f"[GeminiService] Network error attempt {attempt+1}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(5)
                continue

        except RuntimeError:
            raise

        except Exception as exc:
            last_error = exc
            print(f"[GeminiService] Error attempt {attempt+1}: {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(3)
                continue

    raise RuntimeError(f"Gemini failed after {MAX_RETRIES} retries: {last_error}")