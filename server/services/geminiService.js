/**
 * geminiService.js  (v3.1)
 *
 * Changes from v3:
 *  - Uses REST endpoint directly: https://generativelanguage.googleapis.com/v1beta/models
 *  - Model: gemini-2.5-flash
 *  - Geology topic guard built-in (isGeologyQuery)
 *  - Reduced to MAX 1 Gemini call per user request from callGemini()
 *  - Rate limiter bumped to 2s minTime (safer for free tier)
 */
import dotenv from "dotenv";
dotenv.config();
import { geminiLimiter } from "../utils/rateLimiter.js";

const MODEL    = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 2;
const BASE_DELAY  = 3000; // 3s base, 6s on second retry

// ── Geology topic guard — pure keyword check, zero API calls ──

const GEOLOGY_KEYWORDS = [
  // Core geology
  "geolog", "rock", "mineral", "stone", "crystal", "gem", "ore",
  "fossil", "sediment", "strat", "litholog", "petrol", "magma", "lava",
  // Processes
  "tectonic", "earthquake", "seismic", "fault", "fold", "volcani",
  "erosion", "weathering", "depositi", "metamorph", "igneous",
  // Landforms & water
  "mountain", "canyon", "basin", "aquifer", "groundwater", "hydro",
  "river", "glacier", "soil", "terrain", "topograph",
  // Science branches
  "geomorph", "geophys", "geochem", "paleontol", "minerolog",
  "structural", "stratigraphy", "sedimentolog", "petrogr",
  // Field work
  "field map", "outcrop", "core sample", "drill", "borehole", "survey",
  "thin section", "hand specimen", "rock cycle",
  // Earth science
  "plate", "mantle", "crust", "lithosphere", "asthenosphere",
  "subduct", "rift", "orogen", "batholith", "dike", "sill", "pluton",
  "clast", "grain size", "porosity", "permeability",
  // Common geology terms
  "quartz", "feldspar", "mica", "calcite", "dolomite", "basalt",
  "granite", "limestone", "sandstone", "shale", "slate", "marble",
  "gneiss", "schist", "obsidian", "pumice", "flint", "chalk",
  "coal", "oil", "petroleum", "hydrocarbon", "reservoir",
  "mohs", "hardness", "cleavage", "fracture", "luster",
  // Generic science overlap allowed
  "earth", "soil", "land", "terrain", "map", "formation",
];

/**
 * Fast keyword check — no API call needed.
 * Returns true if query is geology-related.
 */
export function isGeologyQuery(query) {
  const lower = query.toLowerCase();
  return GEOLOGY_KEYWORDS.some((kw) => lower.includes(kw));
}

export const OFF_TOPIC_REPLY =
  "🪨 I'm Dr. Terra, a geology-specialized AI assistant. I can only answer questions related to **geology, earth sciences, mineralogy, petrology, tectonics, hydrogeology, geomorphology, and related earth science topics**.\n\nPlease ask me something geology-related — I'd love to help!";

// ── Core REST call ────────────────────────────────────────────

/**
 * callGemini — single Gemini REST call with retry + rate limit.
 *
 * @param {string} prompt
 * @param {string} systemInstruction
 * @param {object} options  { maxOutputTokens, temperature }
 * @param {number} attempt  (internal — do not pass)
 */
export async function callGemini(prompt, systemInstruction = "", options = {}, attempt = 0) {
  const {
    maxOutputTokens = 1800,
    temperature     = 0.65,
  } = options;

  const url = `${BASE_URL}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
      err?.status === 429 ||
      err?.status === 503 ||
      err?.status === 500 ||
      err?.message?.includes("overloaded") ||
      err?.message?.includes("quota") ||
      err?.message?.includes("RESOURCE_EXHAUSTED");

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempt); // 3s, 6s
      console.warn(`[Gemini] Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms — ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return callGemini(prompt, systemInstruction, options, attempt + 1);
    }

    console.error(`[Gemini] Failed after ${attempt} retries:`, err.message);
    throw err;
  }
}

// ── System prompts ────────────────────────────────────────────

export const DR_TERRA_SYSTEM = `You are Dr. Terra, an expert geology professor and field geologist with 25 years of experience.

STRICT RULE: You ONLY answer questions about geology and earth sciences. This includes:
petrology, mineralogy, structural geology, tectonics, stratigraphy, sedimentology,
geomorphology, geophysics, hydrogeology, paleontology, geochemistry, volcanology,
seismology, field mapping, rock/mineral identification, and geological processes.

If ANY part of a question is outside these domains, respond ONLY with:
"🪨 I can only answer geology and earth science questions. Please ask me something related to rocks, minerals, tectonics, or earth sciences."

When answering geology questions:
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
- Always distinguish between established science and active research debates`;

export const NOTES_EXPLAINER_SYSTEM = `You are Dr. Terra, a geology expert.
STRICT RULE: Only process geology and earth science content.
If the text is not about geology, reply: "🪨 This content doesn't appear to be geology-related. Please paste geology notes, papers, or textbook excerpts."

For geology content:
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
      `Please explain and simplify the following geology notes:\n\n${text}`,
      NOTES_EXPLAINER_SYSTEM,
      { maxOutputTokens: 2000 }
    );
  } catch {
    return "⚠️ Could not process notes right now. Please try again shortly.";
  }
}
