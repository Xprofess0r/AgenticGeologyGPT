import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Trash2, Mountain, Brain } from "lucide-react";
import ChatMessage from "../components/ChatMessage";
import AgentLoadingIndicator from "../components/AgentLoadingIndicator";
import { useChat } from "../hooks/useChat";

const SUGGESTIONS = [
  "Explain the rock cycle in simple terms",
  "What minerals are found in granite?",
  "How do I identify rocks in the field?",
  "What causes earthquakes along fault lines?",
  "Difference between igneous and metamorphic rocks?",
  "Latest research on plate tectonics",
];

const ROUTE_LABELS = {
  rag:      { label: "Notes",    color: "#4a8c5a" },
  web:      { label: "Web",      color: "#2d6b9c" },
  parallel: { label: "RAG+Web",  color: "#7a5c9c" },
  direct:   { label: "Direct",   color: "#c8a84b" },
};

export default function ChatPage({ initialPrompt, onPromptConsumed }) {
  const { messages, isLoading, loadingStep, error, sendMessage, clearChat } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
      onPromptConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput("");
    inputRef.current?.focus();
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  // Last assistant message for route badge in header
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const routeInfo = lastAssistant?.route ? ROUTE_LABELS[lastAssistant.route] : null;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Brain size={16} color="var(--accent)" style={{ marginRight: 8 }} />
            Agentic Chat
          </h1>
          <p style={styles.subtitle}>
            Multi-step reasoning · RAG · Web search · Self-correction
          </p>
        </div>
        <div style={styles.headerRight}>
          {routeInfo && (
            <span style={{ ...styles.routePill, borderColor: routeInfo.color + "60", color: routeInfo.color }}>
              {routeInfo.label}
            </span>
          )}
          {messages.length > 0 && (
            <button onClick={clearChat} style={styles.clearBtn} title="Clear chat + session">
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesScroll}>
        {messages.length === 0 ? (
          <EmptyState onSuggest={sendMessage} />
        ) : (
          <div style={styles.messageList}>
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {isLoading && <AgentLoadingIndicator step={loadingStep} />}
            {error && <ErrorBanner message={error} />}
            <div ref={bottomRef} style={{ height: 1 }} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <div style={styles.inputRow}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about rocks, minerals, tectonics, latest research…"
            rows={1}
            style={styles.textarea}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              ...styles.sendBtn,
              opacity: !input.trim() || isLoading ? 0.35 : 1,
              cursor:  !input.trim() || isLoading ? "not-allowed" : "pointer",
            }}
          >
            <Send size={16} strokeWidth={2.2} />
          </button>
        </div>
        <p style={styles.hint}>⏎ Send · ⇧⏎ New line · Session memory active</p>
      </div>
    </div>
  );
}

function EmptyState({ onSuggest }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyGlow} />
      <div style={styles.emptyIconWrap}>
        <Mountain size={40} color="var(--accent)" strokeWidth={1} />
      </div>
      <h2 style={styles.emptyTitle}>Ask Dr. Terra</h2>
      <p style={styles.emptyText}>
        Powered by an agentic pipeline — Dr. Terra searches your notes,
        browses the web, and self-corrects to give you the best answer.
      </p>
      <div style={styles.agentBadges}>
        {["Query Analysis", "RAG Retrieval", "Web Search", "Self-Correction"].map((b) => (
          <span key={b} style={styles.agentBadge}>{b}</span>
        ))}
      </div>
      <div style={styles.suggGrid}>
        {SUGGESTIONS.map((s) => (
          <button key={s} style={styles.suggBtn} onClick={() => onSuggest(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={styles.error}>
      <span style={{ color: "var(--danger)", fontWeight: 600 }}>⚠ Error:</span> {message}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-base)", overflow: "hidden" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 28px 16px", borderBottom: "1px solid var(--border)",
    flexShrink: 0, background: "var(--bg-surface)",
  },
  title: {
    fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700,
    letterSpacing: "-0.02em", color: "var(--text-primary)",
    display: "flex", alignItems: "center",
  },
  subtitle: { fontSize: "11.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  routePill: {
    fontSize: "9.5px", fontFamily: "var(--font-mono)", padding: "2px 8px",
    borderRadius: "10px", border: "1px solid",
  },
  clearBtn: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "6px 13px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", color: "var(--text-muted)", fontSize: "12px",
    cursor: "pointer", fontFamily: "var(--font-body)",
  },
  messagesScroll: { flex: 1, overflowY: "auto" },
  messageList: { display: "flex", flexDirection: "column", gap: "18px", padding: "24px 28px" },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    minHeight: "100%", padding: "60px 24px 40px", textAlign: "center", position: "relative",
  },
  emptyGlow: {
    position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
    width: "300px", height: "300px",
    background: "radial-gradient(circle, rgba(200,168,75,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  emptyIconWrap: {
    width: "72px", height: "72px", borderRadius: "20px",
    background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "20px", boxShadow: "0 0 40px rgba(200,168,75,0.08)",
  },
  emptyTitle: {
    fontFamily: "var(--font-serif)", fontSize: "28px", fontStyle: "italic",
    color: "var(--text-secondary)", marginBottom: "12px", fontWeight: 400,
  },
  emptyText: { fontSize: "13.5px", color: "var(--text-muted)", maxWidth: "420px", lineHeight: "1.7", marginBottom: "16px" },
  agentBadges: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", marginBottom: "24px" },
  agentBadge: {
    fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--accent-dim)",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    padding: "3px 9px", borderRadius: "10px",
  },
  suggGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxWidth: "520px", width: "100%" },
  suggBtn: {
    padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "12.5px",
    cursor: "pointer", fontFamily: "var(--font-body)", lineHeight: "1.4", textAlign: "left",
  },
  error: {
    padding: "12px 16px", background: "rgba(192,90,74,0.08)", border: "1px solid rgba(192,90,74,0.3)",
    borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "13px",
  },
  inputArea: { flexShrink: 0, padding: "14px 28px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)" },
  inputRow: { display: "flex", gap: "10px", alignItems: "flex-end" },
  textarea: {
    flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13.5px",
    fontFamily: "var(--font-body)", padding: "11px 16px", resize: "none", outline: "none",
    lineHeight: "1.6", overflow: "hidden",
  },
  sendBtn: {
    width: "42px", height: "42px", flexShrink: 0, background: "var(--accent)", border: "none",
    borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center",
    color: "#0c0f0a",
  },
  hint: { fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "8px" },
};
