import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Trash2, Mountain, Brain } from "lucide-react";
import ChatMessage from "../components/ChatMessage";
import AgentLoadingIndicator from "../components/AgentLoadingIndicator";
import { useChat } from "../hooks/useChat";

const SUGGESTIONS = [
  "What are types of underground mining?",
  "Use of remote sensing in mineral exploration",
  "How do earthquakes form along fault lines?",
  "Difference between igneous and metamorphic rocks",
  "What minerals are found in granite?",
  "Latest research on plate tectonics",
];

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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <h1 className="chat-title">
            <Brain size={16} color="var(--accent)" style={{ marginRight: 7, flexShrink: 0 }} />
            Agentic Chat
          </h1>
          <p className="chat-subtitle">RAG · Web search · Self-correction</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="clear-btn">
            <Trash2 size={13} />
            <span className="clear-btn-label">Clear</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <EmptyState onSuggest={sendMessage} />
        ) : (
          <div className="message-list">
            {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
            {isLoading && <AgentLoadingIndicator step={loadingStep} />}
            {error && <div className="error-banner"><strong>⚠ Error:</strong> {error}</div>}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="input-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about rocks, minerals, tectonics…"
            rows={1}
            className="chat-textarea"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="send-btn"
          >
            <Send size={16} strokeWidth={2.2} />
          </button>
        </div>
        <p className="input-hint">↵ Send · ⇧↵ New line</p>
      </div>
    </div>
  );
}

function EmptyState({ onSuggest }) {
  return (
    <div className="empty-state">
      <div className="empty-glow" />
      <div className="empty-icon">
        <Mountain size={36} color="var(--accent)" strokeWidth={1} />
      </div>
      <h2 className="empty-title">Ask Dr. Terra</h2>
      <p className="empty-desc">
        Powered by an agentic pipeline — Dr. Terra searches your notes,
        browses the web, and gives expert geology answers.
      </p>
      <div className="agent-badges">
        {["Query Analysis", "RAG Retrieval", "Web Search", "Expert Answer"].map((b) => (
          <span key={b} className="agent-badge">{b}</span>
        ))}
      </div>
      <div className="sugg-grid">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="sugg-btn" onClick={() => onSuggest(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
