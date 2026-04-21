import React from "react";
import { Map, Layers, Navigation, Globe, Construction } from "lucide-react";

const PLANNED = [
  {
    icon: Map,
    title: "Formation Mapper",
    desc: "Visualise geological formations on interactive maps",
    color: "#4a7c52",
  },
  {
    icon: Layers,
    title: "Stratigraphic Column",
    desc: "Build and annotate stratigraphic columns from field data",
    color: "#c8a84b",
  },
  {
    icon: Navigation,
    title: "Field Data Logger",
    desc: "Log strike, dip, and lithology measurements from the field",
    color: "#2d6b5c",
  },
  {
    icon: Globe,
    title: "Tectonic Overlay",
    desc: "Overlay tectonic plate boundaries and seismic data",
    color: "#6b7c65",
  },
];

export default function GISPage() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>GIS Tools</h1>
          <p style={styles.subtitle}>
            Geospatial tools for field geology and mapping
          </p>
        </div>
        <div style={styles.comingSoonBadge}>
          <Construction size={12} />
          Under Development
        </div>
      </div>

      {/* Hero message */}
      <div style={styles.hero}>
        <div style={styles.heroIconWrap}>
          <Map size={44} color="var(--accent)" strokeWidth={1} />
        </div>
        <h2 style={styles.heroTitle}>GIS Suite Coming Soon</h2>
        <p style={styles.heroText}>
          Powerful geospatial tools tailored for geology students and field
          researchers. Planned for GeologyGPT v2.0.
        </p>
      </div>

      {/* Planned feature cards */}
      <div style={styles.grid}>
        {PLANNED.map(({ icon: Icon, title, desc, color }) => (
          <div key={title} style={styles.card}>
            <div
              style={{
                ...styles.cardIcon,
                background: `${color}18`,
                border: `1px solid ${color}35`,
              }}
            >
              <Icon size={20} color={color} strokeWidth={1.5} />
            </div>
            <div style={styles.cardTitle}>{title}</div>
            <div style={styles.cardDesc}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-base)",
    overflow: "hidden auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 28px 16px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    background: "var(--bg-surface)",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "11.5px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginTop: "2px",
  },
  comingSoonBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "20px",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--accent-dim)",
    letterSpacing: "0.04em",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px 36px",
    textAlign: "center",
    borderBottom: "1px solid var(--border)",
    background:
      "radial-gradient(ellipse at 50% 0%, rgba(200,168,75,0.04) 0%, transparent 70%)",
  },
  heroIconWrap: {
    width: "80px",
    height: "80px",
    borderRadius: "22px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },
  heroTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "26px",
    fontStyle: "italic",
    fontWeight: 400,
    color: "var(--text-secondary)",
    marginBottom: "12px",
  },
  heroText: {
    fontSize: "13.5px",
    color: "var(--text-muted)",
    maxWidth: "400px",
    lineHeight: "1.7",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "16px",
    padding: "28px",
  },
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    transition: "border-color 0.2s",
  },
  cardIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "14px",
    color: "var(--text-primary)",
  },
  cardDesc: {
    fontSize: "12.5px",
    color: "var(--text-muted)",
    lineHeight: "1.55",
  },
};
