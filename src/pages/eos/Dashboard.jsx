import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      setLoading(true);
      const { data } = await supabase.from("eos_tasks").select("*");
      setTasks(data || []);
      setLoading(false);
    }
    fetchTasks();
  }, []);

  // Compute stats
  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === "Done").length,
    overdue: tasks.filter(t => t.status === "Overdue").length,
    upcoming: tasks.filter(t => t.status === "Upcoming" || t.status === "Due Today").length,
  };
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // Group by workstream
  const wsMap = {};
  tasks.forEach(t => {
    const ws = t.workstream || "Other";
    if (!wsMap[ws]) wsMap[ws] = { total: 0, done: 0, overdue: 0 };
    wsMap[ws].total++;
    if (t.status === "Done") wsMap[ws].done++;
    if (t.status === "Overdue") wsMap[ws].overdue++;
  });
  const workstreams = Object.entries(wsMap).sort((a, b) => b[1].total - a[1].total);

  const STAT_CARDS = [
    {
      label: "Total Tasks",
      value: stats.total,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/>
        </svg>
      ),
      accent: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE",
    },
    {
      label: "Completed",
      value: stats.done,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      accent: "#059669", bg: "#ECFDF5", border: "#A7F3D0",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
      accent: "#DC2626", bg: "#FEF2F2", border: "#FECACA",
    },
    {
      label: "Active / Due",
      value: stats.upcoming,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      accent: "#D97706", bg: "#FFFBEB", border: "#FDE68A",
    },
  ];

  const WS_COLORS = [
    { fill: "#4F46E5", track: "#EEF2FF" },
    { fill: "#059669", track: "#ECFDF5" },
    { fill: "#D97706", track: "#FFFBEB" },
    { fill: "#7C3AED", track: "#F5F3FF" },
    { fill: "#DC2626", track: "#FEF2F2" },
    { fill: "#0891B2", track: "#ECFEFF" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>EOS Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>Real-time operational overview across all workstreams</p>
        </div>
        {/* Overall progress ring */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#FFFFFF", border: "1px solid #E8EAF0", borderRadius: 14, padding: "12px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="21" fill="none" stroke="#F3F4F6" strokeWidth="5" />
            <circle cx="26" cy="26" r="21" fill="none" stroke="#4F46E5" strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 21 * pct / 100} ${2 * Math.PI * 21}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
            <text x="26" y="30" textAnchor="middle" fill="#1a1d2e" fontSize="12" fontWeight="800" fontFamily="Inter, sans-serif">{pct}%</text>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1d2e" }}>Overall Progress</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{stats.done} of {stats.total} complete</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {STAT_CARDS.map(({ label, value, icon, accent, bg, border }) => (
          <div key={label} style={{
            background: "#FFFFFF", borderRadius: 16, border: `1px solid ${border}`,
            padding: "20px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: 14,
            transition: "box-shadow 0.15s, transform 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "none"; }}
          >
            <div style={{ width: 44, height: 44, background: bg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#1a1d2e", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {loading ? "—" : value}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, fontWeight: 500 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Workstream breakdown */}
      <div style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8EAF0", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1d2e" }}>Workstream Breakdown</h3>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{workstreams.length} workstreams</span>
        </div>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF" }}>Loading…</div>
        ) : workstreams.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>No data yet. Add tasks to see workstream stats.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Workstream", "Progress", "Tasks", "Done", "Overdue"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #F3F4F6", textAlign: h === "Progress" ? "left" : (["Tasks","Done","Overdue"].includes(h) ? "center" : "left"), background: "#FAFBFC" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workstreams.map(([ws, d], i) => {
                const p = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                const { fill, track } = WS_COLORS[i % WS_COLORS.length];
                return (
                  <tr key={ws}
                    style={{ background: i % 2 === 0 ? "transparent" : "#FAFBFC" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#EEF2FF"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#FAFBFC"}
                  >
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#1a1d2e", borderBottom: "1px solid #F9FAFB" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: fill }} />
                        {ws}
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", borderBottom: "1px solid #F9FAFB", minWidth: 180 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 7, background: track, borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${p}%`, background: fill, borderRadius: 999, transition: "width 0.5s ease" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: fill, minWidth: 36, textAlign: "right" }}>{p}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: "#1a1d2e", textAlign: "center", borderBottom: "1px solid #F9FAFB" }}>{d.total}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: "#059669", textAlign: "center", borderBottom: "1px solid #F9FAFB" }}>{d.done}</td>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 700, color: d.overdue > 0 ? "#DC2626" : "#9CA3AF", textAlign: "center", borderBottom: "1px solid #F9FAFB" }}>{d.overdue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
