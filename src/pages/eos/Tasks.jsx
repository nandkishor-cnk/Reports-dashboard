import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

// Light mode color tokens
const C = {
  bg: "#F5F6FA",
  card: "#FFFFFF",
  border: "#E8EAF0",
  text: "#1a1d2e",
  muted: "#6B7280",
  subtle: "#9CA3AF",
  indigo: "#4F46E5",
  indigoLight: "#EEF2FF",
  indigoBorder: "#C7D2FE",
};

const STATUS_MAP = {
  "Overdue":   { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  "Due Today": { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  "Upcoming":  { bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE" },
  "Scheduled": { bg: "#F5F3FF", color: "#7C3AED", border: "#DDD6FE" },
  "Done":      { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP["Scheduled"];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>{status}</span>
  );
}

const safeFmt = (dateStr) => {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); }
  catch { return dateStr; }
};
const safeDaysLeft = (dateStr) => {
  if (!dateStr) return null;
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(dateStr + "T00:00:00");
    return Math.round((due - today) / 86400000);
  } catch { return null; }
};
const todayStr = () => new Date().toISOString().split("T")[0];

const S = {
  page: { display: "flex", flexDirection: "column", gap: 24, fontFamily: "'Inter', system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" },
  subtitle: { margin: "4px 0 0", fontSize: 13, color: C.muted },
  actions: { display: "flex", alignItems: "center", gap: 10 },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "0 12px", height: 38 },
  searchIcon: { color: C.subtle, flexShrink: 0 },
  searchInput: { border: "none", outline: "none", background: "transparent", color: C.text, fontSize: 13, width: 180, fontFamily: "inherit" },
  addBtn: { display: "flex", alignItems: "center", gap: 6, background: C.indigo, border: "none", color: "white", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" },
  tableWrap: { background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px 16px", fontSize: 11, fontWeight: 700, color: C.subtle, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${C.border}`, background: "#FAFBFC", whiteSpace: "nowrap" },
  td: { padding: "13px 16px", fontSize: 13, color: C.muted, borderBottom: `1px solid #F3F4F6`, verticalAlign: "middle" },
  emptyRow: { textAlign: "center", padding: "60px 20px", color: C.subtle, fontSize: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" },
  modal: { width: "100%", maxWidth: 500, background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.12)" },
  modalTitle: { margin: "0 0 24px", fontSize: 18, fontWeight: 700, color: C.text },
  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" },
  select: { width: "100%", boxSizing: "border-box", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", appearance: "none" },
  saveBtn: { width: "100%", padding: "12px", background: C.indigo, border: "none", color: "white", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 },
  cancelBtn: { width: "100%", padding: "11px", background: "transparent", border: `1.5px solid ${C.border}`, color: C.muted, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginTop: 8 },
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const emptyForm = { task_name: "", workstream: "", owner: "", deadline: todayStr(), status: "Upcoming" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadTasks();
    const ch = supabase.channel("tasks-rt")
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

  function weekNum(deadline) {
    if (!deadline) return "—";
    const d = new Date(deadline);
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  }

  function openNew() { setCurrent(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(t) { setCurrent(t); setForm({ task_name: t.task_name, workstream: t.workstream, owner: t.owner, deadline: t.deadline, status: t.status }); setModalOpen(true); }

  async function handleSave(e) {
    e.preventDefault();
    let status = form.status;
    if (status !== "Done") {
      const d = safeDaysLeft(form.deadline);
      if (d !== null) {
        if (d < 0) status = "Overdue";
        else if (d === 0) status = "Due Today";
        else if (d <= 3) status = "Upcoming";
        else status = "Scheduled";
      }
    }
    const payload = { ...form, status };
    if (current) await supabase.from("eos_tasks").update(payload).eq("id", current.id);
    else await supabase.from("eos_tasks").insert([{ ...payload }]);
    setModalOpen(false);
    loadTasks();
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this task?")) return;
    await supabase.from("eos_tasks").delete().eq("id", id);
    loadTasks();
  }

  const filtered = tasks.filter(t =>
    t.task_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.workstream?.toLowerCase().includes(search.toLowerCase()) ||
    t.owner?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Master Task List</h1>
          <p style={S.subtitle}>{tasks.length} tasks tracked across all workstreams</p>
        </div>
        <div style={S.actions}>
          <div style={S.searchWrap}>
            <svg style={S.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={S.searchInput} placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button style={S.addBtn} onClick={openNew}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Task
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {["Task", "Workstream", "Owner", "Deadline", "Status", "Days Left", "Week #", ""].map(h => (
                <th key={h} style={{ ...S.th, textAlign: h === "" ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={S.emptyRow}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <svg style={{ animation: "spin 1s linear infinite" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.indigo} strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  Loading…
                </div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={S.emptyRow}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                No tasks found. Add your first task to get started.
              </td></tr>
            ) : filtered.map((t, i) => {
              const d = safeDaysLeft(t.deadline);
              const done = t.status === "Done";
              return (
                <tr key={t.id}
                  style={{ background: i % 2 === 0 ? "transparent" : "#FAFBFC", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.indigoLight}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "#FAFBFC"}
                >
                  <td style={{ ...S.td, color: done ? C.subtle : C.text, fontWeight: 500, textDecoration: done ? "line-through" : "none", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.task_name}
                  </td>
                  <td style={S.td}>
                    <span style={{ background: "#F3F4F6", color: "#374151", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{t.workstream}</span>
                  </td>
                  <td style={{ ...S.td, color: C.text, fontWeight: 500 }}>{t.owner}</td>
                  <td style={{ ...S.td, color: C.muted }}>{safeFmt(t.deadline)}</td>
                  <td style={S.td}><StatusBadge status={t.status} /></td>
                  <td style={{ ...S.td, color: done ? C.subtle : d === null ? C.subtle : d < 0 ? "#DC2626" : d <= 3 ? "#D97706" : "#059669", fontWeight: 600, textAlign: "right" }}>
                    {done ? "—" : d === null ? "—" : d < 0 ? `${Math.abs(d)}d late` : d === 0 ? "Today" : `${d}d`}
                  </td>
                  <td style={{ ...S.td, color: C.subtle, fontSize: 12 }}>W{weekNum(t.deadline)}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button onClick={() => openEdit(t)} title="Edit" style={{ background: "none", border: "none", color: C.subtle, cursor: "pointer", padding: 6, borderRadius: 8 }}
                        onMouseEnter={e => e.currentTarget.style.color = C.indigo}
                        onMouseLeave={e => e.currentTarget.style.color = C.subtle}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(t.id)} title="Delete" style={{ background: "none", border: "none", color: C.subtle, cursor: "pointer", padding: 6, borderRadius: 8 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#DC2626"}
                        onMouseLeave={e => e.currentTarget.style.color = C.subtle}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>{current ? "Edit Task" : "New Task"}</h3>
            <form onSubmit={handleSave}>
              {[
                { label: "Task Name", key: "task_name", type: "text", placeholder: "Enter task description…" },
                { label: "Workstream / Team", key: "workstream", type: "text", placeholder: "e.g. Sales, Marketing…" },
                { label: "Owner", key: "owner", type: "text", placeholder: "e.g. Adarsh" },
                { label: "Deadline", key: "deadline", type: "date" },
              ].map(({ label, key, type, placeholder }) => (
                <div style={S.field} key={key}>
                  <label style={S.label}>{label}</label>
                  <input
                    type={type}
                    style={S.input}
                    placeholder={placeholder}
                    value={form[key] || ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
              <div style={S.field}>
                <label style={S.label}>Status</label>
                <select style={S.select} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {["Overdue", "Due Today", "Upcoming", "Scheduled", "Done"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style={S.saveBtn}>{current ? "Save Changes" : "Create Task"}</button>
              <button type="button" style={S.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
