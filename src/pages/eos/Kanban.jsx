import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const safeFmt = (dateStr) => {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit" }); }
  catch { return dateStr; }
};

const COLUMNS = [
  { id: "Overdue",   label: "Overdue",   accent: "#DC2626", bg: "#FEF2F2",  border: "#FECACA",  dot: "#DC2626"  },
  { id: "Due Today", label: "Due Today", accent: "#D97706", bg: "#FFFBEB",  border: "#FDE68A",  dot: "#D97706"  },
  { id: "Upcoming",  label: "Upcoming",  accent: "#4F46E5", bg: "#EEF2FF",  border: "#C7D2FE",  dot: "#4F46E5"  },
  { id: "Scheduled", label: "Scheduled", accent: "#7C3AED", bg: "#F5F3FF",  border: "#DDD6FE",  dot: "#7C3AED"  },
  { id: "Done",      label: "Done ✓",   accent: "#059669", bg: "#ECFDF5",  border: "#A7F3D0",  dot: "#059669"  },
];

export default function Kanban() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [overCol, setOverCol] = useState(null);

  useEffect(() => {
    loadTasks();
    const ch = supabase.channel("kanban-rt")
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

  async function moveTask(taskId, newStatus) {
    await supabase.from("eos_tasks").update({ status: newStatus }).eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  const byStatus = (colId) => tasks.filter(t => t.status === colId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, background: "#EEF2FF", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>Kanban Board</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>{tasks.length} tasks · drag cards to update status</p>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14, gap: 10 }}>
          <svg style={{ animation: "spin 1s linear infinite" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          Loading tasks…
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, flex: 1, minHeight: 0 }}>
          {COLUMNS.map(col => {
            const colTasks = byStatus(col.id);
            const isOver = overCol === col.id;
            return (
              <div
                key={col.id}
                style={{
                  display: "flex", flexDirection: "column", borderRadius: 14,
                  background: isOver ? col.bg : "#FFFFFF",
                  border: `1.5px solid ${isOver ? col.border : "#E8EAF0"}`,
                  overflow: "hidden", transition: "all 0.15s",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                }}
                onDragOver={e => { e.preventDefault(); setOverCol(col.id); }}
                onDragLeave={() => setOverCol(null)}
                onDrop={async e => {
                  e.preventDefault();
                  setOverCol(null);
                  if (dragging && dragging !== col.id) await moveTask(dragging, col.id);
                  setDragging(null);
                }}
              >
                {/* Column header */}
                <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: col.accent }}>{col.label}</span>
                  <span style={{ marginLeft: "auto", background: col.bg, color: col.accent, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700, border: `1px solid ${col.border}` }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Task cards */}
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {colTasks.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#D1D5DB", fontSize: 12, fontStyle: "italic", padding: "20px 0" }}>
                      Drop here
                    </div>
                  ) : colTasks.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragging(t.id)}
                      onDragEnd={() => { setDragging(null); setOverCol(null); }}
                      style={{
                        background: "#FAFBFC",
                        border: "1.5px solid #F3F4F6",
                        borderRadius: 10,
                        padding: "12px",
                        cursor: "grab",
                        transition: "all 0.15s",
                        fontSize: 13,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        opacity: dragging === t.id ? 0.4 : 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.border = `1.5px solid ${col.border}`; e.currentTarget.style.background = col.bg; }}
                      onMouseLeave={e => { e.currentTarget.style.border = "1.5px solid #F3F4F6"; e.currentTarget.style.background = "#FAFBFC"; }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1d2e", lineHeight: 1.4, marginBottom: 10 }}>
                        {t.task_name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg, ${col.dot}33, ${col.dot})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: col.accent }}>
                          {t.owner?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>{t.owner}</span>
                        <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: "auto" }}>{safeFmt(t.deadline)}</span>
                      </div>
                      {t.workstream && (
                        <div style={{ marginTop: 2 }}>
                          <span style={{ fontSize: 10, background: "#F3F4F6", color: "#6B7280", borderRadius: 6, padding: "2px 8px", border: "1px solid #E5E7EB", fontWeight: 600 }}>
                            {t.workstream}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
