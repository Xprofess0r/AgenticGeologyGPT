/**
 * rateLimiter.js  (v3.1)
 *
 * Gemini free tier limits (gemini-2.5-flash):
 *   - 10 RPM (requests per minute) = ~1 req/6s safe
 *   - 250,000 TPM (tokens per minute)
 *
 * We use 2s minTime (30 RPM ceiling) — conservative but doesn't
 * cause noticeable UX delay since we also cut calls from 3→1 per request.
 */

import Bottleneck from "bottleneck";

// Gemini: 1 req / 2s — respects free tier safely
export const geminiLimiter = new Bottleneck({
  minTime:       2000,
  maxConcurrent: 1,
  reservoir:     5,               // allow brief bursts of up to 5
  reservoirRefreshAmount:    5,
  reservoirRefreshInterval:  30000, // refill every 30s
});

// Embeddings: more lenient (OpenAI / Gemini embedding endpoint)
export const embeddingLimiter = new Bottleneck({
  minTime:       300,
  maxConcurrent: 2,
});
