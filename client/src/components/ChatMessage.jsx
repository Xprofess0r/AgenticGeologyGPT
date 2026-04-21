import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mountain, User, BookOpen, Globe } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import AgentSteps from "./AgentSteps";

export default function ChatMessage({ message }) {
  const isUser    = message.role === "user";
  const hasSources = !isUser && message.sources && message.sources.length > 0;
  const docSources = hasSources ? message.sources.filter((s) => s.type === "document") : [];
  const webSources = hasSources ? message.sources.filter((s) => s.type === "web") : [];

  return (
    <div style={{ ...s.wrapper, flexDirection: isUser ? "row-reverse" : "row" }}>
      {/* Avatar */}
      <div style={isUser ? s.userAvatar : s.aiAvatar}>
        {isUser
          ? <User size={14} color="var(--text-secondary)" strokeWidth={1.8} />
          : <Mountain size={14} color="#c8a84b" strokeWidth={1.5} />
        }
      </div>

      {/* Bubble */}
      <div style={{ ...s.bubble, ...(isUser ? s.userBubble : s.aiBubble) }}>
        {isUser ? (
          <p style={s.userText}>{message.content}</p>
        ) : (
          <>
            {/* Answer */}
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Confidence */}
            <ConfidenceBadge score={message.confidence} evaluation={message.evaluation} />

            {/* Document sources */}
            {docSources.length > 0 && (
              <div style={s.sourcesBlock}>
                <div style={s.sourcesHeader}>
                  <BookOpen size={10} color="var(--text-muted)" />
                  <span style={s.sourcesLabel}>From your notes</span>
                </div>
                {docSources.map((src, i) => (
                  <div key={i} style={s.sourceChip}>
                    <div style={s.chipTop}>
                      <span style={s.chipFile}>
                        {src.label}
                      </span>
                      <span style={s.chipScore}>{Math.round(src.score * 100)}%</span>
                    </div>
                    <p style={s.chipPreview}>{src.preview}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Web sources */}
            {webSources.length > 0 && (
              <div style={s.sourcesBlock}>
                <div style={s.sourcesHeader}>
                  <Globe size={10} color="var(--text-muted)" />
                  <span style={s.sourcesLabel}>Web search</span>
                </div>
                {webSources.map((src, i) => (
                  <div key={i} style={s.webChip}>
                    <div style={s.chipTop}>
                      <a href={src.url} target="_blank" rel="noopener noreferrer" style={s.webTitle}>
                        {src.label}
                      </a>
                    </div>
                    <p style={s.chipPreview}>{src.preview}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Agent trace */}
            <AgentSteps steps={message.steps} route={message.route} runId={message.runId} />
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    display: "flex", gap: "12px", alignItems: "flex-start",
    animation: "fadeUp 0.35s var(--ease) both", maxWidth: "100%",
  },
  userAvatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  aiAvatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "linear-gradient(135deg, #1a2a18, #223320)",
    border: "1px solid var(--border-strong)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubble: {
    maxWidth: "calc(100% - 60px)", borderRadius: "12px",
    padding: "12px 16px", fontSize: "14px", lineHeight: "1.65",
  },
  userBubble: {
    background: "var(--bg-active)", border: "1px solid var(--border-strong)",
    borderTopRightRadius: "2px",
  },
  aiBubble: {
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderTopLeftRadius: "2px",
  },
  userText: { color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  sourcesBlock: { marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border)" },
  sourcesHeader: {
    display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px",
  },
  sourcesLabel: {
    fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  sourceChip: {
    background: "var(--bg-base)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", padding: "6px 10px", marginBottom: "4px",
    borderLeft: "2px solid var(--accent-dim)",
  },
  webChip: {
    background: "var(--bg-base)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", padding: "6px 10px", marginBottom: "4px",
    borderLeft: "2px solid #2d6b9c",
  },
  chipTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" },
  chipFile: {
    fontSize: "10.5px", color: "var(--accent)", fontFamily: "var(--font-mono)",
    fontWeight: 600, maxWidth: "78%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  webTitle: {
    fontSize: "10.5px", color: "#5a9fd4", fontFamily: "var(--font-mono)",
    fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap", textDecoration: "none",
  },
  chipScore: {
    fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)",
    background: "var(--bg-elevated)", padding: "1px 6px",
    borderRadius: "10px", border: "1px solid var(--border)",
  },
  chipPreview: { fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.45", fontStyle: "italic" },
};
