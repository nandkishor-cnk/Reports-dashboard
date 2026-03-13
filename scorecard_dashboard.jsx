import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./src/lib/supabase";
import { format, addDays } from "date-fns";

// ─── Week reference ───────────────────────────────────────────
const QUARTER_START = new Date("2026-01-01T00:00:00Z");
const WEEKS = Array.from({ length: 13 }, (_, i) => {
  const start = addDays(QUARTER_START, i * 7);
  const end = addDays(start, 6);
  return {
    label: `Wk ${i + 1}`,
    dateRange: `${format(start, "MMM d")} – ${format(end, "MMM d")}`,
    dateValue: format(start, "yyyy-MM-dd"),
  };
});

// ─── Category accent colors (light mode) ─────────────────────
const CATEGORY_COLORS = {
  "MARKETING PERFORMANCE": { accent: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  "SALES PERFORMANCE":     { accent: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  "SALES — EDWIN":         { accent: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  "TOTAL SALES":           { accent: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
};
const DEFAULT_COLOR = { accent: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE" };

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || DEFAULT_COLOR;
}

// ─── Light mode cell coloring ─────────────────────────────────
function getCellStyle(value, target) {
  if (value === "" || value === null || value === undefined) return { color: "#D1D5DB", fontWeight: 400 };
  if (target === "" || target === null || target === undefined) return { color: "#374151", fontWeight: 500 };
  return Number(value) >= Number(target)
    ? { color: "#059669", fontWeight: 700, background: "#ECFDF5" }
    : { color: "#DC2626", fontWeight: 700, background: "#FEF2F2" };
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyState({ onAddMetric }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 40px", color: "#9CA3AF" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151", marginBottom: 8 }}>No metrics configured yet</div>
      <div style={{ fontSize: 14, marginBottom: 24 }}>Add your first metric to start tracking performance</div>
      <button onClick={onAddMetric} style={{
        background: "#4F46E5", border: "none", borderRadius: 12, color: "white",
        padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
        boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
      }}>
        <span style={{ fontSize: 18 }}>+</span> Add First Metric
      </button>
    </div>
  );
}

// ─── Set Targets Modal ────────────────────────────────────────
function SetTargetsModal({ onClose, metricsConfig, onSave }) {
  const [targets, setTargets] = useState(() => {
    const t = {};
    metricsConfig.forEach(m => { t[m.id] = m.target_value ?? ""; });
    return t;
  });
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const g = {};
    metricsConfig.forEach(m => {
      if (!g[m.category]) g[m.category] = [];
      g[m.category].push(m);
    });
    return g;
  }, [metricsConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(targets);
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", background: "#FFFFFF", borderRadius: 20, border: "1px solid #E8EAF0", boxShadow: "0 24px 60px rgba(0,0,0,0.14)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1a1d2e" }}>Set Targets</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF" }}>Define weekly targets for each metric</p>
          </div>
          <button onClick={onClose} style={{ background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, color: "#6B7280", cursor: "pointer", fontSize: 18, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([category, metrics]) => {
            const color = getCategoryColor(category);
            return (
              <div key={category}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: color.accent, display: "inline-block" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: color.accent, textTransform: "uppercase" }}>{category}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {metrics.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", border: "1px solid #F3F4F6" }}>
                      <span style={{ flex: 1, fontSize: 13, color: "#374151", fontWeight: 500 }}>{m.metric_name}</span>
                      <input
                        type="number"
                        value={targets[m.id] ?? ""}
                        onChange={e => setTargets(t => ({ ...t, [m.id]: e.target.value }))}
                        placeholder="—"
                        style={{ width: 100, background: "#FFFFFF", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", color: "#7C3AED", fontSize: 13, fontWeight: 700, textAlign: "right", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, paddingTop: 4, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "none", color: "#6B7280", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#4F46E5", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(79,70,229,0.3)" }}>
              {saving ? "Saving…" : "Save Targets"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function ScorecardDashboard() {
  const [metricsConfig, setMetricsConfig] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [editableData, setEditableData] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: configData }, { data: weekData }] = await Promise.all([
      supabase.from("scorecard_metrics_config").select("*").order("display_order", { ascending: true }),
      supabase.from("scorecard_weekly_data").select("*"),
    ]);

    const config = configData || [];
    const week = weekData || [];

    setMetricsConfig(config);
    setWeeklyData(week);

    const initData = {};
    week.forEach(w => {
      if (!initData[w.metric_id]) initData[w.metric_id] = {};
      initData[w.metric_id][w.week_start_date] = w.value ?? "";
    });
    setEditableData(initData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel("scorecard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "scorecard_metrics_config" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "scorecard_weekly_data" }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchData]);

  // Group metrics by category
  const groupedMetrics = useMemo(() => {
    const groups = {};
    metricsConfig.forEach(m => {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    });
    return groups;
  }, [metricsConfig]);

  const handleSaveTargets = async (targets) => {
    const updates = metricsConfig.map(m => ({
      id: m.id, category: m.category, owner: m.owner,
      metric_name: m.metric_name, display_order: m.display_order,
      target_value: targets[m.id] === "" || targets[m.id] === undefined ? null : Number(targets[m.id]),
    }));
    await supabase.from("scorecard_metrics_config").upsert(updates);
    await fetchData();
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Sync failed with status: ${res.status}`);
      }
      await fetchData(); // Refresh data from Supabase DB after sync completes
      alert("Data refresh completed successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to refresh data: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const downloadCSV = () => {
    const rows = [["Category", "Owner", "Metric", "Target", ...WEEKS.map(w => w.label)]];
    Object.entries(groupedMetrics).forEach(([category, metrics]) => {
      metrics.forEach(m => {
        const row = [category, m.owner, m.metric_name, m.target_value ?? ""];
        WEEKS.forEach(w => row.push(editableData[m.id]?.[w.dateValue] ?? ""));
        rows.push(row);
      });
    });
    const csvStr = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvStr], { type: "text/csv" }));
    a.download = "Scorecard_Export.csv";
    a.click();
  };

  if (loading && metricsConfig.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "#9CA3AF" }}>
          <svg style={{ width: 32, height: 32, animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span style={{ fontSize: 14 }}>Loading Scorecard…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const btnBase = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Header ────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>Company Scorecard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Weekly performance tracking — Q1 FY2026 (13 weeks)
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleManualSync} disabled={syncing} style={{ ...btnBase, border: "1.5px solid #E5E7EB", background: "#FFFFFF", color: syncing ? "#9CA3AF" : "#374151" }}>
            {syncing ? "↻ Syncing..." : "↻ Refresh Data"}
          </button>
          <button onClick={downloadCSV} style={{ ...btnBase, border: "1.5px solid #E5E7EB", background: "#FFFFFF", color: "#374151" }}>
            ↓ Export CSV
          </button>
          <button onClick={() => setShowTargetModal(true)} style={{ ...btnBase, border: "none", background: "#4F46E5", color: "white", fontWeight: 700, boxShadow: "0 4px 14px rgba(79,70,229,0.25)" }}>
            ◎ Set Targets
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: "auto", borderRadius: 16, border: "1px solid #E8EAF0", background: "#FFFFFF", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
        {metricsConfig.length === 0 ? (
          <EmptyState onAddMetric={() => setShowAddModal(true)} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200, fontFamily: "inherit" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6", background: "#FAFBFC" }}>
                <th style={{ ...thStyle, width: 240, textAlign: "left", position: "sticky", left: 0, zIndex: 10, background: "#FAFBFC", borderRight: "1px solid #F3F4F6", color: "#374151" }}>
                  METRIC
                </th>
                <th style={{ ...thStyle, width: 100, borderRight: "1px solid #F3F4F6" }}>OWNER</th>
                <th style={{ ...thStyle, width: 100, borderRight: "1px solid #F3F4F6" }}>TARGET</th>
                {WEEKS.map(w => (
                  <th key={w.label} style={{ ...thStyle, minWidth: 76, borderRight: "1px solid #F9FAFB" }}>
                    <div style={{ color: "#1a1d2e", fontWeight: 700 }}>{w.label}</div>
                    <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 400, marginTop: 2, letterSpacing: "normal" }}>{w.dateRange}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedMetrics).map(([category, metrics]) => {
                const color = getCategoryColor(category);
                return (
                  <React.Fragment key={`group-${category}`}>
                    {/* Category header */}
                    <tr>
                      <td colSpan={3 + WEEKS.length} style={{
                        padding: "10px 20px",
                        background: color.bg,
                        borderTop: `2px solid ${color.border}`,
                        borderBottom: `1px solid ${color.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color.accent, display: "inline-block", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: color.accent, textTransform: "uppercase" }}>
                            {category}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Metric rows */}
                    {metrics.map((m, mi) => {
                      const isEven = mi % 2 === 0;
                      const tgt = m.target_value ?? "";
                      return (
                        <tr key={m.id} style={{ background: isEven ? "#FFFFFF" : "#FAFBFC", borderBottom: "1px solid #F9FAFB" }}>
                          <td style={{
                            ...tdStyle, textAlign: "left", fontWeight: 600, color: "#1a1d2e",
                            position: "sticky", left: 0, zIndex: 5,
                            background: isEven ? "#FFFFFF" : "#FAFBFC",
                            borderRight: "1px solid #F3F4F6"
                          }}>
                            {m.metric_name}
                          </td>
                          <td style={{ ...tdStyle, color: "#6B7280", fontSize: 11, borderRight: "1px solid #F3F4F6" }}>
                            {m.owner}
                          </td>
                          <td style={{ ...tdStyle, borderRight: "1px solid #F3F4F6", background: "#F9FAFB" }}>
                            <span style={{ color: "#7C3AED", fontWeight: 700, fontSize: 12 }}>
                              {m.target_value ?? "—"}
                            </span>
                          </td>
                          {WEEKS.map(w => {
                            const val = editableData[m.id]?.[w.dateValue] ?? "";
                            const cs = getCellStyle(val, tgt);
                            return (
                              <td key={w.label} style={{ ...tdStyle, borderRight: "1px solid #F9FAFB", ...(cs.background ? { background: cs.background } : {}) }}>
                                <span style={{ fontSize: 12, fontWeight: cs.fontWeight, color: cs.color }}>
                                  {val !== "" ? val : "·"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showTargetModal && (
        <SetTargetsModal
          onClose={() => setShowTargetModal(false)}
          metricsConfig={metricsConfig}
          onSave={handleSaveTargets}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Shared styles (light mode) ───────────────────────────────
const thStyle = {
  padding: "12px 14px",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "#9CA3AF",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 14px",
  fontSize: 12,
  textAlign: "center",
  whiteSpace: "nowrap",
  color: "#374151",
};

