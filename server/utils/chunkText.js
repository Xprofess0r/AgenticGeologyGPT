/**
 * chunkText.js (UPGRADED for better RAG accuracy)
 * Improvements:
 * - Smarter cleaning
 * - Dynamic overlap handling
 * - Sentence-aware chunking (partial)
 */

const CHUNK_SIZE = 400;  // words per chunk
const OVERLAP    = 80;   // increased overlap for better context

export function chunkText(text, source = "unknown") {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/-\n/g, "") // fix broken words across lines
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    let end = Math.min(start + CHUNK_SIZE, words.length);

    // 🧠 Try to end at sentence boundary (improves meaning)
    if (end < words.length) {
      for (let i = end; i > start + 200; i--) {
        if (/[.!?]$/.test(words[i])) {
          end = i + 1;
          break;
        }
      }
    }

    const chunkWords = words.slice(start, end);
    const chunkStr = chunkWords.join(" ").trim();

    if (chunkStr.length > 50) {
      chunks.push({
        text: chunkStr,
        source,
        chunkIndex: chunks.length,
        wordCount: chunkWords.length,
      });
    }

    if (end >= words.length) break;

    // 🔥 Overlap logic (prevents context loss)
    start = Math.max(end - OVERLAP, start + 1);
  }

  return chunks;
}