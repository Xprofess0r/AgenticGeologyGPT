/**
 * webSearch.js — Node 3
 *
 * Web search tool node.
 * Uses Tavily API (free tier available at tavily.com).
 * Falls back to SerpAPI if TAVILY_API_KEY not set but SERPAPI_KEY is.
 * Returns empty array if neither key is configured — chat still works.
 */

export async function webSearchNode(state) {
  const { query, needsWeb, logger } = state;

  if (!needsWeb) {
    logger.logStep("webSearch", "Skipped — web search not needed");
    return { ...state, webResults: [] };
  }

  logger.logStep("webSearch", `Searching web for: "${query.slice(0, 60)}"`);

  try {
    let results = [];

    if (process.env.TAVILY_API_KEY) {
      results = await searchTavily(query);
      logger.logToolCall("tavily_search", query, `${results.length} results`);
    } else if (process.env.SERPAPI_KEY) {
      results = await searchSerpAPI(query);
      logger.logToolCall("serpapi_search", query, `${results.length} results`);
    } else {
      logger.logStep("webSearch", "No search API key configured — skipping web search");
      return { ...state, webResults: [] };
    }

    logger.logWebResults(results);
    logger.logStep("webSearch", `Got ${results.length} web results`);
    return { ...state, webResults: results };

  } catch (err) {
    console.error("[webSearch] Error:", err.message);
    logger.logStep("webSearch", `Web search failed: ${err.message}`);
    return { ...state, webResults: [] };
  }
}

// ── Tavily implementation ─────────────────────────────────────

async function searchTavily(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: `geology ${query}`,
      search_depth: "basic",
      include_answer: true,
      max_results: 4,
    }),
  });

  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return (data.results || []).map((r) => ({
    title:   r.title   || "Untitled",
    url:     r.url     || "",
    snippet: r.content || r.snippet || "",
    score:   r.score   || 0,
  }));
}

// ── SerpAPI implementation ────────────────────────────────────

async function searchSerpAPI(query) {
  const params = new URLSearchParams({
    api_key: process.env.SERPAPI_KEY,
    q: `geology ${query}`,
    num: 4,
  });

  const res = await fetch(`https://serpapi.com/search?${params}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);

  const data = await res.json();
  return (data.organic_results || []).slice(0, 4).map((r) => ({
    title:   r.title   || "Untitled",
    url:     r.link    || "",
    snippet: r.snippet || "",
    score:   0.7,
  }));
}
