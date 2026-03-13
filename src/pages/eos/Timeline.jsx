import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";

const safeFmt = (dateStr) => {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" }); }
  catch { return dateStr; }
};

const STATUS_COLORS = {
  "Overdue":   { bg: "#FEF2F2",  color: "#DC2626", border: "#FECACA",  dot: "#DC2626"  },
  "Due Today": { bg: "#FFFBEB",  color: "#D97706", border: "#FDE68A",  dot: "#D97706"  },
  "Upcoming":  { bg: "#EEF2FF",  color: "#4F46E5", border: "#C7D2FE",  dot: "#4F46E5"  },
  "Scheduled": { bg: "#F5F3FF",  color: "#7C3AED", border: "#DDD6FE",  dot: "#7C3AED"  },
  "Done":      { bg: "#ECFDF5",  color: "#059669", border: "#A7F3D0",  dot: "#059669"  },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS["Scheduled"];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

export default function Timeline() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
    const ch = supabase.channel("timeline-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "eos_tasks" }, loadTasks)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function loadTasks() {
    setLoading(true);
    const { data } = await supabase.from("eos_tasks").select("*").order("deadline", { ascending: true });
    setTasks(data || []);
    setLoading(false);
  }

  function weekNum(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  }

  // Group by week
  const grouped = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const wk = t.deadline ? weekNum(t.deadline) : "No Deadline";
      if (!map[wk]) map[wk] = [];
      map[wk].push(t);
    });
    return Object.entries(map).sort((a, b) => {
      const ai = parseInt(a[0]) || 9999;
      const bi = parseInt(b[0]) || 9999;
      return ai - bi;
    });
  }, [tasks]);

  const AVATAR_COLORS = ["#EEF2FF", "#FEF3C7", "#ECFDF5", "#FFF1F2", "#F3E8FF", "#FFF7ED"];
  const AVATAR_TEXT   = ["#4F46E5", "#D97706", "#059669", "#E11D48", "#7C3AED", "#EA580C"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, background: "#EEF2FF", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>Weekly Timeline</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>{tasks.length} tasks grouped by week</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "60px 0", color: "#9CA3AF" }}>
          <svg style={{ animation: "spin 1s linear infinite" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          Loading timeline…
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
          No tasks yet. Create some tasks to populate the timeline.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div style={{
            position: "absolute", left: 27, top: 20, bottom: 20,
            width: 2, background: "linear-gradient(to bottom, #4F46E5, #C7D2FE)",
            borderRadius: 2, opacity: 0.3,
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {grouped.map(([week, weekTasks]) => (
              <div key={week} style={{ display: "flex", gap: 20 }}>
                {/* Week dot */}
                <div style={{
                  width: 54, height: 54, borderRadius: "50%", flexShrink: 0,
                  background: "#FFFFFF", border: "2.5px solid #4F46E5",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 0 4px #EEF2FF",
                  marginTop: 2, position: "relative", zIndex: 1,
                }}>
                  <span style={{ fontSize: 7, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>Week</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#4F46E5", lineHeight: 1.1 }}>{week}</span>
                </div>

                {/* Task cards */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {weekTasks.map((t, idx) => {
                    const s = STATUS_COLORS[t.status] || STATUS_COLORS["Scheduled"];
                    const aBg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    const aTxt = AVATAR_TEXT[idx % AVATAR_TEXT.length];
                    return (
                      <div
                        key={t.id}
                        style={{
                          background: "#FFFFFF", borderRadius: 12, border: "1.5px solid #E8EAF0",
                          padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                          transition: "all 0.15s",
                          borderLeft: `3px solid ${s.dot}`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.08)"; e.currentTarget.style.background = s.bg; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.background = "#FFFFFF"; }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1d2e", marginBottom: 8, lineHeight: 1.4 }}>
                              {t.task_name}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                              {/* Owner avatar */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: aBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: aTxt }}>
                                  {t.owner?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>{t.owner}</span>
                              </div>

                              {/* Deadline */}
                              <span style={{ fontSize: 11, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                {safeFmt(t.deadline)}
                              </span>

                              {/* Workstream */}
                              {t.workstream && (
                                <span style={{ fontSize: 10, background: "#F3F4F6", color: "#6B7280", borderRadius: 5, padding: "2px 7px", border: "1px solid #E5E7EB", fontWeight: 600 }}>
                                  {t.workstream}
                                </span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={t.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
