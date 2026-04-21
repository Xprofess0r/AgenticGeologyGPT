/**
 * logger.js
 * LangSmith-style observability logger.
 * Writes structured JSON logs to /logs/agent_runs.jsonl
 * Each line = one complete agent run (newline-delimited JSON).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR   = path.join(__dirname, "../logs");
const LOG_FILE  = path.join(LOG_DIR, "agent_runs.jsonl");

// Ensure log dir exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export function createRunLogger(runId, query, sessionId = "default") {
  const startTime = Date.now();

  const run = {
    runId,
    sessionId,
    query,
    timestamp: new Date().toISOString(),
    steps: [],
    toolCalls: [],
    retrievedChunks: [],
    webResults: [],
    finalAnswer: null,
    confidence: null,
    evaluation: null,
    durationMs: null,
    route: null,
  };

  return {
    logStep(node, detail) {
      run.steps.push({ node, detail, ts: Date.now() - startTime });
    },
    logToolCall(tool, input, output) {
      run.toolCalls.push({ tool, input, output: String(output).slice(0, 300), ts: Date.now() - startTime });
    },
    logChunks(chunks) {
      run.retrievedChunks = chunks.map((c) => ({
        source: c.source,
        score: c.score,
        preview: c.text?.slice(0, 150),
      }));
    },
    logWebResults(results) {
      run.webResults = results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet?.slice(0, 200),
      }));
    },
    setRoute(route) {
      run.route = route;
    },
    setAnswer(answer, confidence) {
      run.finalAnswer = answer?.slice(0, 500);
      run.confidence  = confidence;
    },
    setEvaluation(evaluation) {
      run.evaluation = evaluation;
    },
    flush() {
      run.durationMs = Date.now() - startTime;
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(run) + "\n", "utf8");
      } catch (e) {
        console.error("[Logger] Failed to write log:", e.message);
      }
      return run;
    },
  };
}

// Read last N runs (for a /api/logs endpoint)
export function readRecentLogs(n = 20) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const lines = fs.readFileSync(LOG_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .slice(-n)
      .map((l) => JSON.parse(l));
    return lines.reverse();
  } catch {
    return [];
  }
}
