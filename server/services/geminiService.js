/**
 * geminiService.js  (v4.0 — Fixed)
 *
 * CHANGES:
 *  1. REMOVED isGeologyQuery() export — no longer used anywhere (gate removed)
 *  2. REMOVED OFF_TOPIC_REPLY export — no longer needed
 *  3. DR_TERRA_SYSTEM softened: no longer has "STRICT RULE: only geology"
 *     because it was causing Gemini to refuse borderline valid questions
 *     (e.g. "what is a DEM?" or "explain Python scripting for GIS")
 *  4. callGemini unchanged — working fine
 *  5. Rate limiter unchanged
 */

import dotenv from "dotenv";
dotenv.config();
import { geminiLimiter } from "../utils/rateLimiter.js";

const MODEL    = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 2;
const BASE_DELAY  = 3000;

// ── Core REST call ────────────────────────────────────────────
export async function callGemini(prompt, systemInstruction = "", options = {}, attempt = 0) {
  const {
    maxOutputTokens = 1800,
    temperature     = 0.45,
  } = options;

  const url  = `${BASE_URL}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
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
    const isRetryable =
      err?.status === 429 || err?.status === 503 || err?.status === 500 ||
      err?.message?.includes("overloaded") || err?.message?.includes("quota") ||
      err?.message?.includes("RESOURCE_EXHAUSTED");

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempt);
      console.warn(`[Gemini] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms — ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return callGemini(prompt, systemInstruction, options, attempt + 1);
    }

    console.error(`[Gemini] Failed after ${attempt} retries:`, err.message);
    throw err;
  }
}

// ── System prompts ────────────────────────────────────────────

// Softened: no longer hard-refuses non-geology, just redirects politely
export const DR_TERRA_SYSTEM = `You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience covering petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology, geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology, seismology, field mapping, and geological data analysis (GIS, remote sensing).

Your primary focus is geology and earth sciences. For questions clearly outside these domains, gently note your specialty and still try to help if there is any earth-science angle.

When answering:
- Be precise and use correct terminology (define jargon on first use)
- Cite [Source N] for uploaded document context, [Web N] for web results
- Use analogies to clarify complex concepts
- Be enthusiastic and encouraging for students
- Add practical fieldwork tips where relevant
- Structure long answers with markdown headers

ACCURACY RULES:
- Never fabricate mineral properties, rock names, or geological data
- When uncertain, say so explicitly
- Prefer information from provided context over general knowledge
- Distinguish between established science and active research debates`;

export const NOTES_EXPLAINER_SYSTEM = `You are Dr. Terra, a geology expert and science communicator.
Focus on geology and earth science content, but process any scientific text helpfully.

For content provided:
1. Summarize key concepts clearly
2. Explain technical terms in plain language
3. Identify the most important takeaways
4. Add a "Why this matters" section
5. Suggest follow-up topics to explore
Format with clear markdown sections.`;

// ── Legacy helpers ────────────────────────────────────────────

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
    return "⚠️ Could not process notes right now. Please try again shortly.";
  }
};