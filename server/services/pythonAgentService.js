/**
 * pythonAgentService.js  (v5)
 *
 * Thin HTTP client from Node.js → Python LangGraph agent.
 * Updated to pass back rag_query and search_query for UI display.
 */

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || "http://localhost:8000";
const AGENT_ENDPOINT   = `${PYTHON_AGENT_URL}/agent`;
const TIMEOUT_MS       = 120_000;

export async function callPythonAgent(query, history = []) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(AGENT_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ query, history }),
      signal:  controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Python agent HTTP ${response.status}: ${errText.slice(0, 300)}`);
    }

    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Python agent timed out after 120s");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function isPythonAgentHealthy() {
  try {
    const resp = await fetch(`${PYTHON_AGENT_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}