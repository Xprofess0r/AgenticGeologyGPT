import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mountain, User, BookOpen, Globe, ChevronDown, ChevronRight, Activity } from "lucide-react";

export default function ChatMessage({ message }) {
  const isUser    = message.role === "user";
  const docSources = (!isUser && message.sources?.filter(s => s.type === "document")) || [];
  const webSources = (!isUser && message.sources?.filter(s => s.type === "web"))      || [];

  return (
    <div className={`msg-row ${isUser ? "msg-row--user" : ""}`}>
      <div className={`msg-avatar ${isUser ? "msg-avatar--user" : "msg-avatar--ai"}`}>
        {isUser
          ? <User size={13} color="var(--text-secondary)" strokeWidth={1.8} />
          : <Mountain size={13} color="#c8a84b" strokeWidth={1.5} />
        }
      </div>

      <div className={`msg-bubble ${isUser ? "msg-bubble--user" : "msg-bubble--ai"}`}>
        {isUser ? (
          message.content
        ) : (
          <>
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>

            <ConfidenceBadge score={message.confidence} evaluation={message.evaluation} />

            {docSources.length > 0 && (
              <div className="sources-block">
                <div className="sources-header">
                  <BookOpen size={10} color="var(--text-muted)" />
                  <span className="sources-label">From your notes</span>
                </div>
                {docSources.map((s, i) => (
                  <div key={i} className="source-chip">
                    <div className="chip-top">
                      <span className="chip-name">{s.label}</span>
                      <span className="chip-score">{Math.round(s.score * 100)}%</span>
                    </div>
                    <p className="chip-preview">{s.preview}</p>
                  </div>
                ))}
              </div>
            )}

            {webSources.length > 0 && (
              <div className="sources-block">
                <div className="sources-header">
                  <Globe size={10} color="var(--text-muted)" />
                  <span className="sources-label">Web search</span>
                </div>
                {webSources.map((s, i) => (
                  <div key={i} className="web-chip">
                    <div className="chip-top">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="chip-link">
                        {s.label}
                      </a>
                    </div>
                    <p className="chip-preview">{s.preview}</p>
                  </div>
                ))}
              </div>
            )}

            <AgentTrace steps={message.steps} route={message.route} runId={message.runId} />
          </>
        )}
      </div>
    </div>
  );
}

function ConfidenceBadge({ score, evaluation }) {
  if (score == null) return null;
  const pct   = Math.round(score * 100);
  const color = pct >= 70 ? "#4a8c5a" : pct >= 45 ? "#c8a84b" : "#c05a4a";
  const label = pct >= 70 ? "High" : pct >= 45 ? "Medium" : "Low";
  return (
    <div className="confidence-badge" style={{ borderColor: color + "40" }}>
      <div className="confidence-bar" style={{ width: `${pct}%`, background: color }} />
      <span className="confidence-label" style={{ color }}>{label} confidence · {pct}%</span>
      {evaluation && (
        <span className="confidence-eval">
          Relevancy {Math.round((evaluation.answerRelevancy || 0) * 100)}%
          {evaluation.contextPrecision > 0 && ` · Precision ${Math.round(evaluation.contextPrecision * 100)}%`}
        </span>
      )}
    </div>
  );
}

function AgentTrace({ steps, route, runId }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  const nodeColors = {
    queryAnalyzer: "#c8a84b", retriever: "#4a8c5a",
    webSearch: "#2d6b9c", reasoning: "#7a5c9c", selfCorrector: "#9c5c5c",
  };
  return (
    <div className="agent-trace">
      <button className="trace-toggle" onClick={() => setOpen(o => !o)}>
        <Activity size={10} />
        <span>Agent trace</span>
        {route && (
          <span className="trace-route" style={{ color: "#c8a84b", borderColor: "#c8a84b50" }}>
            {route}
          </span>
        )}
        {runId && <span className="trace-run">#{runId}</span>}
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>
      {open && (
        <div className="trace-body">
          {steps.map((step, i) => (
            <div key={i} className="trace-step">
              <div className="trace-dot" style={{ background: nodeColors[step.node] || "var(--border-strong)" }} />
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: nodeColors[step.node] || "var(--text-muted)", marginRight: 6 }}>
                  {step.node}
                </span>
                <span>{step.detail}</span>
              </div>
              <span style={{ marginLeft: "auto", fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", flexShrink: 0 }}>{step.ts}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
