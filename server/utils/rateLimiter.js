/**
 * rateLimiter.js  (v5)
 *
 * Gemini 2.5-flash free tier: 15 RPM = ~1 req/4s
 * We use 2s minTime → max 30 RPM actual → safe buffer.
 * In practice human-paced chat means wait is usually 0.
 */

import Bottleneck from "bottleneck";

export const geminiLimiter = new Bottleneck({
  minTime:                  2000,
  maxConcurrent:            1,
  reservoir:                5,
  reservoirRefreshAmount:   5,
  reservoirRefreshInterval: 30000,
});

export const embeddingLimiter = new Bottleneck({
  minTime:       50,   // 50ms = max 20 req/s, Gemini embed allows 1500 RPM
  maxConcurrent: 2,
});