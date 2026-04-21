/**
 * AgentLoadingIndicator.jsx
 * Replaces old TypingIndicator — shows current agent step with animated pulse.
 */

import React from "react";

export default function AgentLoadingIndicator({ step }) {
  const label = step || "⚙️ Processing…";

  return (
    <div style={s.wrapper}>
      <div style={s.avatarShell}>
        <div style={s.pulse} />
        <div style={s.avatar}>
          <span style={s.avatarDot} />
        </div>
      </div>
      <div style={s.bubble}>
        <div style={s.dotsRow}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ ...s.dot, animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
        <p style={s.stepLabel}>{label}</p>
      </div>
    </div>
  );
}

const s = {
  wrapper: { display: "flex", gap: "12px", alignItems: "flex-start" },
  avatarShell: { position: "relative", width: "32px", height: "32px", flexShrink: 0 },
  pulse: {
    position: "absolute", inset: "-3px", borderRadius: "50%",
    border: "1.5px solid var(--accent)", opacity: 0.4,
    animation: "pulse 1.5s infinite ease-in-out",
  },
  avatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "linear-gradient(135deg, #1a2a18, #223320)",
    border: "1px solid var(--border-strong)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  avatarDot: {
    display: "block", width: "8px", height: "8px", borderRadius: "50%",
    background: "var(--accent)", animation: "pulse 1.2s infinite ease-in-out",
  },
  bubble: {
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    borderRadius: "12px", borderTopLeftRadius: "2px",
    padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px",
  },
  dotsRow: { display: "flex", gap: "5px", alignItems: "center" },
  dot: {
    display: "inline-block", width: "7px", height: "7px", borderRadius: "50%",
    background: "var(--accent)", animation: "pulse 1.3s infinite ease-in-out",
  },
  stepLabel: {
    fontSize: "11.5px", color: "var(--text-muted)",
    fontFamily: "var(--font-mono)", fontStyle: "italic",
  },
};
