/**
 * geminiService.js  (v5)
 *
 * CHANGES:
 *  - Model default: gemini-2.5-flash (matches SpaceGPT)
 *  - DR_TERRA_SYSTEM: removed hard "STRICT RULE" blocking — was causing
 *    Gemini to refuse borderline geology questions like "what is a DEM?"
 *  - NOTES_EXPLAINER_SYSTEM: same softening
 *  - callGemini: unchanged — already working
 */

import dotenv from "dotenv";
dotenv.config();
import { geminiLimiter } from "../utils/rateLimiter.js";

const MODEL    = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 2;
const BASE_DELAY  = 3000;

export async function callGemini(prompt, systemInstruction = "", options = {}, attempt = 0) {
  const { maxOutputTokens = 1800, temperature = 0.6 } = options;

  const url  = `${BASE_URL}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    contents:         [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens, temperature },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  try {
    const response = await geminiLimiter.schedule(() =>
      fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const err     = new Error(`Gemini HTTP ${response.status}: ${errText.slice(0, 200)}`);
      err.status    = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from Gemini");
    return text;

  } catch (err) {
    const retryable =
      err?.status === 429 || err?.status === 503 || err?.status === 500 ||
      err?.message?.includes("overloaded") || err?.message?.includes("quota") ||
      err?.message?.includes("RESOURCE_EXHAUSTED");

    if (retryable && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempt);
      console.warn(`[Gemini] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      return callGemini(prompt, systemInstruction, options, attempt + 1);
    }
    throw err;
  }
}

// ── System prompts ────────────────────────────────────────────

export const DR_TERRA_SYSTEM = `You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

You specialise in: petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology, geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology, seismology, field mapping, rock/mineral identification, GIS for geology, borehole analysis, and seismic interpretation.

When answering:
- Be precise and use correct terminology (define jargon on first use)
- When CONTEXT is provided, cite [Source N] for documents, [Web N] for web results inline
- NEVER fabricate mineral properties, rock names, measurements, or citations
- When uncertain, say so explicitly — do not guess
- Use markdown headers for structured answers
- Be enthusiastic and encouraging for students
- Add practical fieldwork tips where relevant`;

export const NOTES_EXPLAINER_SYSTEM = `You are Dr. Terra, a geology expert and science communicator.

For the provided geology notes or text:
1. Summarise key concepts clearly
2. Explain technical terms in plain language
3. Identify the most important takeaways (3-5 points)
4. Add a "Why this matters" section with real-world context
5. Suggest 3 follow-up topics worth exploring
Format with clear markdown sections.`;

// ── Legacy helpers (used by Node.js fallback graph) ──────────

export async function getChatCompletion(messages, ragContext = null) {
  try {
    const history = messages
      .map((m) => `${m.role === "user" ? "Student" : "Dr. Terra"}: ${m.content}`)
      .join("\n\n");

    let prompt = history;
    if (ragContext?.length > 0) {
      const ctx = ragContext
        .map((c, i) => `[Source ${i + 1}: ${c.source}]\n${c.text}`)
        .join("\n\n---\n\n");
      prompt = `=== CONTEXT ===\n${ctx}\n=== END ===\n\n${history}`;
    }

    return await callGemini(prompt, DR_TERRA_SYSTEM);
  } catch {
    return "⚠️ Dr. Terra is temporarily unavailable. Please try again in a moment.";
  }
}

export async function getNotesExplanation(text) {
  try {
    return await callGemini(
      `Please explain and simplify the following notes:\n\n${text}`,
      NOTES_EXPLAINER_SYSTEM,
      { maxOutputTokens: 2000 }
    );
  } catch {
    return "⚠️ Could not process notes. Please try again.";
  }
}