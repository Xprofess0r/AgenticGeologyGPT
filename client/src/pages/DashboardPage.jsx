import React from "react";
import {
  Mountain,
  Layers,
  BookOpen,
  Waves,
  Compass,
  FlaskConical,
  Globe,
  Wind,
} from "lucide-react";

/* ── Data ───────────────────────────────────────────────────── */
const DISCIPLINES = [
  {
    icon: Mountain,
    label: "Petrology",
    desc: "Rock formation, classification & textures",
    color: "#4a7c52",
    topics: ["Igneous", "Sedimentary", "Metamorphic"],
  },
  {
    icon: Layers,
    label: "Stratigraphy",
    desc: "Layer sequences, dating & correlations",
    color: "#c8a84b",
    topics: ["Lithostratigraphy", "Biostratigraphy", "Chronostratigraphy"],
  },
  {
    icon: BookOpen,
    label: "Mineralogy",
    desc: "Crystal systems, optical & physical properties",
    color: "#2d6b5c",
    topics: ["Silicates", "Carbonates", "Sulfides"],
  },
  {
    icon: Waves,
    label: "Geophysics",
    desc: "Seismology, gravity & magnetic surveys",
    color: "#6b7c65",
    topics: ["Seismic", "Magnetic", "Gravity"],
  },
  {
    icon: Compass,
    label: "Structural Geology",
    desc: "Faults, folds & deformation mechanics",
    color: "#7a5c38",
    topics: ["Faults", "Folds", "Joints & Fractures"],
  },
  {
    icon: Globe,
    label: "Tectonics",
    desc: "Plate dynamics & tectonic environments",
    color: "#3a5c7a",
    topics: ["Convergent", "Divergent", "Transform"],
  },
  {
    icon: FlaskConical,
    label: "Geochemistry",
    desc: "Elemental cycling & isotope systems",
    color: "#7a3a5c",
    topics: ["Major Elements", "Trace Elements", "Isotopes"],
  },
  {
    icon: Wind,
    label: "Geomorphology",
    desc: "Landforms, erosion & surface processes",
    color: "#5c7a3a",
    topics: ["Fluvial", "Aeolian", "Glacial"],
  },
];

const STATS = [
  { label: "Disciplines Covered", value: "8", unit: "fields" },
  { label: "AI Model", value: "GPT-4o", unit: "powered" },
  { label: "Avg. Response", value: "< 3s", unit: "latency" },
  { label: "Context Window", value: "128k", unit: "tokens" },
];

/* ── Component ──────────────────────────────────────────────── */
export default function DashboardPage() {
  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>
            Geology knowledge base &amp; learning overview
          </p>
        </div>
      </div>

      <div style={styles.body}>
        {/* ── Stats row ── */}
        <div style={styles.statsRow}>
          {STATS.map(({ label, value, unit }) => (
            <div key={label} style={styles.statCard}>
              <div style={styles.statValue}>{value}</div>
              <div style={styles.statUnit}>{unit}</div>
              <div style={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Section title ── */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Geology Disciplines</span>
          <span style={styles.sectionNote}>
            All topics available in AI Chat
          </span>
        </div>

        {/* ── Discipline cards ── */}
        <div style={styles.grid}>
          {DISCIPLINES.map(({ icon: Icon, label, desc, color, topics }) => (
            <DisciplineCard
              key={label}
              Icon={Icon}
              label={label}
              desc={desc}
              color={color}
              topics={topics}
            />
          ))}
        </div>

        {/* ── Footer note ── */}
        <div style={styles.footerNote}>
          <span>
            💡 Use the <strong>AI Chat</strong> to ask questions about any
            discipline above. Use <strong>Notes Explainer</strong> to simplify
            complex readings.
          </span>
        </div>
      </div>
    </div>
  );
}

function DisciplineCard({ Icon, label, desc, color, topics }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div
          style={{
            ...styles.cardIcon,
            background: `${color}18`,
            border: `1px solid ${color}35`,
          }}
        >
          <Icon size={20} color={color} strokeWidth={1.5} />
        </div>
        <div>
          <div style={styles.cardLabel}>{label}</div>
          <div style={styles.cardDesc}>{desc}</div>
        </div>
      </div>
      <div style={styles.topicsRow}>
        {topics.map((t) => (
          <span key={t} style={styles.topicTag}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-base)",
    overflow: "hidden",
  },
  header: {
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
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  /* Stats */
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "14px",
  },
  statCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  statValue: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: 800,
    color: "var(--accent)",
    letterSpacing: "-0.03em",
  },
  statUnit: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    marginTop: "6px",
    fontWeight: 500,
  },
  /* Section header */
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.01em",
  },
  sectionNote: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
  },
  /* Discipline grid */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "14px",
  },
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    transition: "border-color 0.2s, background 0.2s",
  },
  cardTop: {
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
  },
  cardIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardLabel: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "13.5px",
    color: "var(--text-primary)",
    marginBottom: "3px",
  },
  cardDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: "1.5",
  },
  topicsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  topicTag: {
    fontSize: "10.5px",
    fontFamily: "var(--font-mono)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "20px",
    padding: "2px 9px",
    color: "var(--text-muted)",
    letterSpacing: "0.02em",
  },
  /* Footer */
  footerNote: {
    padding: "16px 20px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    fontSize: "12.5px",
    color: "var(--text-muted)",
    lineHeight: "1.6",
    borderLeft: "3px solid var(--accent-dim)",
  },
};
