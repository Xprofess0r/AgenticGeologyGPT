import { useState, useCallback, useRef } from "react";
import { sendChatMessage, resetSession } from "../services/api";

// Agent step labels shown in UI while loading
const STEP_LABELS = {
  queryAnalyzer: "🔍 Analyzing query…",
  retriever:     "📚 Searching your documents…",
  webSearch:     "🌐 Searching the web…",
  reasoning:     "🧠 Thinking…",
  selfCorrector: "✅ Validating answer…",
  default:       "⚙️ Processing…",
};

export function useChat() {
  const [messages, setMessages]     = useState([]);
  const [isLoading, setIsLoading]   = useState(false);
  const [loadingStep, setLoadingStep] = useState(null);
  const [error, setError]           = useState(null);
  const stepTimerRef = useRef(null);

  // Simulate step progression for UX (real steps come in response)
  const simulateSteps = useCallback((route) => {
    const steps = ["queryAnalyzer", "retriever"];
    if (route === "web" || route === "parallel") steps.push("webSearch");
    steps.push("reasoning", "selfCorrector");

    let i = 0;
    setLoadingStep(STEP_LABELS[steps[0]]);

    stepTimerRef.current = setInterval(() => {
      i++;
      if (i < steps.length) {
        setLoadingStep(STEP_LABELS[steps[i]] || STEP_LABELS.default);
      } else {
        clearInterval(stepTimerRef.current);
      }
    }, 1800);
  }, []);

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || isLoading) return;

    const userMsg  = { role: "user", content: userText.trim() };
    const nextMsgs = [...messages, userMsg];

    setMessages(nextMsgs);
    setIsLoading(true);
    setLoadingStep(STEP_LABELS.queryAnalyzer);
    setError(null);

    // Start step simulation (will be overridden by real route when available)
    simulateSteps("parallel");

    try {
      const result = await sendChatMessage(nextMsgs);

      clearInterval(stepTimerRef.current);
      setLoadingStep(null);

      setMessages([
        ...nextMsgs,
        {
          role:       "assistant",
          content:    result.reply,
          sources:    result.sources    || [],
          confidence: result.confidence ?? null,
          route:      result.route      || null,
          evaluation: result.evaluation || null,
          steps:      result.steps      || [],
          runId:      result.runId      || null,
        },
      ]);
    } catch (err) {
      clearInterval(stepTimerRef.current);
      setLoadingStep(null);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, simulateSteps]);

  const clearChat = useCallback(async () => {
    clearInterval(stepTimerRef.current);
    setMessages([]);
    setError(null);
    setLoadingStep(null);
    await resetSession().catch(() => {}); // best-effort
  }, []);

  return { messages, isLoading, loadingStep, error, sendMessage, clearChat };
}
