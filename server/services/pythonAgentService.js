/**
 * services/pythonAgentService.js
 *
 * Thin HTTP client that forwards chat queries to the Python LangGraph agent.
 * Node.js remains the API layer; Python handles all agent orchestration.
 *
 * Environment variable required:
 *   PYTHON_AGENT_URL=http://localhost:8000   (default)
 */

const PYTHON_AGENT_URL =
  process.env.PYTHON_AGENT_URL || "http://localhost:8000";

const AGENT_ENDPOINT = `${PYTHON_AGENT_URL}/agent`;
const TIMEOUT_MS     = 120_000; // 2 min — Gemini can be slow on first call

/**
 * Call the Python LangGraph agent.
 *
 * @param {string}   query    - User's latest query
 * @param {Array}    history  - Full message history [{role, content}]
 * @returns {Promise<{answer, sources, embedding_score, is_geology, rag_count, web_count, decision_reason, latency_ms}>}
 */
export async function callPythonAgent(query, history = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(AGENT_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ query, history }),
      signal:  controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Python agent HTTP ${response.status}: ${errText.slice(0, 300)}`
      );
    }

    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Python agent timed out after 120s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Health-check the Python agent.
 * @returns {Promise<boolean>}
 */
export async function isPythonAgentHealthy() {
  try {
    const resp = await fetch(`${PYTHON_AGENT_URL}/health`, { method: "GET" });
    return resp.ok;
  } catch {
    return false;
  }
}
