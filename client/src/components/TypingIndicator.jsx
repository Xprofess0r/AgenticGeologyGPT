import React from "react";
import { Mountain } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.avatar}>
        <Mountain size={14} color="#c8a84b" strokeWidth={1.5} />
      </div>
      <div style={styles.bubble}>
        <div style={styles.dotsWrapper}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                ...styles.dot,
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
        <span style={styles.label}>Dr. Terra is thinking…</span>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    padding: "8px 0",
    animation: "fadeUp 0.3s var(--ease) both",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #1a2a18, #223320)",
    border: "1px solid var(--border-strong)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "0 12px 12px 12px",
    padding: "10px 16px",
  },
  dotsWrapper: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  dot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--accent)",
    animation: "pulse 1.2s infinite ease-in-out",
  },
  label: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    fontStyle: "italic",
  },
};
