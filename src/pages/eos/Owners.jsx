import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function Owners() {
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

  // Aggregate by owner
  const ownerMap = {};
  tasks.forEach(t => {
    const o = t.owner || "Unassigned";
    if (!ownerMap[o]) ownerMap[o] = { total: 0, done: 0, overdue: 0, upcoming: 0, tasks: [] };
    ownerMap[o].total++;
    if (t.status === "Done") ownerMap[o].done++;
    if (t.status === "Overdue") ownerMap[o].overdue++;
    if (t.status === "Upcoming" || t.status === "Due Today") ownerMap[o].upcoming++;
    ownerMap[o].tasks.push(t);
  });
  const owners = Object.entries(ownerMap).sort((a, b) => b[1].total - a[1].total);

  const AVATAR_COLORS = [
    ["#EEF2FF", "#4F46E5"], ["#FEF3C7", "#D97706"], ["#ECFDF5", "#059669"],
    ["#FFF1F2", "#E11D48"], ["#F3E8FF", "#7C3AED"], ["#FFF7ED", "#EA580C"],
  ];

  const STATUS_COLORS = {
    "Overdue":   "#DC2626",
    "Due Today": "#D97706",
    "Upcoming":  "#4F46E5",
    "Scheduled": "#7C3AED",
    "Done":      "#059669",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, background: "#EEF2FF", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>Owner Overview</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>{owners.length} active owners · {tasks.length} tasks total</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "60px 0", color: "#9CA3AF" }}>
          <svg style={{ animation: "spin 1s linear infinite" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          Loading…
        </div>
      ) : (
        <>
          {/* Owner cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {owners.map(([owner, data], idx) => {
              const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
              const [bgColor, textColor] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <div key={owner} style={{
                  background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8EAF0",
                  padding: "20px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  transition: "box-shadow 0.15s, transform 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: textColor, border: `2px solid ${textColor}22` }}>
                      {owner.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d2e" }}>{owner}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{data.total} tasks</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>Completion</span>
                      <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#F3F4F6", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #4F46E5, #059669)", borderRadius: 999, transition: "width 0.6s ease" }} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { label: "Done", val: data.done, color: "#059669", bg: "#ECFDF5" },
                      { label: "Active", val: data.upcoming, color: "#4F46E5", bg: "#EEF2FF" },
                      { label: "Overdue", val: data.overdue, color: "#DC2626", bg: "#FEF2F2" },
                    ].map(({ label, val, color, bg }) => (
                      <div key={label} style={{ flex: 1, background: bg, borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color }}>{val}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail table */}
          <div style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8EAF0", overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1d2e" }}>Task Assignment Detail</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Owner", "Task", "Workstream", "Status", "Deadline"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #F3F4F6", textAlign: "left", background: "#FAFBFC" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={t.id}
                    style={{ background: i % 2 === 0 ? "transparent" : "#FAFBFC" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#EEF2FF"}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#FAFBFC"}
                  >
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#1a1d2e", borderBottom: "1px solid #F9FAFB" }}>{t.owner}</td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#374151", borderBottom: "1px solid #F9FAFB", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.task_name}</td>
                    <td style={{ padding: "11px 16px", borderBottom: "1px solid #F9FAFB" }}>
                      <span style={{ background: "#F3F4F6", color: "#6B7280", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{t.workstream}</span>
                    </td>
                    <td style={{ padding: "11px 16px", borderBottom: "1px solid #F9FAFB" }}>
                      <span style={{ color: STATUS_COLORS[t.status] || "#6B7280", fontSize: 12, fontWeight: 600 }}>● {t.status}</span>
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#9CA3AF", borderBottom: "1px solid #F9FAFB" }}>{t.deadline || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
