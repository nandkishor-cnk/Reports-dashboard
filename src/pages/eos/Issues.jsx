import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, AlertCircle, CheckCircle2, CircleDashed } from 'lucide-react';

const PRIORITY_COLORS = {
  'High': '#EF4444',
  'Medium': '#F59E0B',
  'Low': '#10B981'
};

const STATUS_ICONS = {
  'Open': <AlertCircle size={16} color="#9CA3AF" />,
  'In Progress': <CircleDashed size={16} color="#3B82F6" />,
  'Solved': <CheckCircle2 size={16} color="#10B981" />
};

const WORKSTREAMS = ['Sales', 'Performance Marketing', 'Brand', 'L1 Team Lead', 'Operations'];

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newIssue, setNewIssue] = useState({
    issue_name: '',
    raised_by: '',
    workstream: 'Sales',
    priority: 'Medium',
    status: 'Open'
  });

  useEffect(() => {
    loadIssues();
    
    const channel = supabase.channel('issues-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eos_issues' }, () => {
        loadIssues();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadIssues() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('eos_issues')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Error loading issues:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddIssue = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { error } = await supabase.from('eos_issues').insert([newIssue]);
      if (error) throw error;
      
      setShowAddModal(false);
      setNewIssue({ issue_name: '', raised_by: '', workstream: 'Sales', priority: 'Medium', status: 'Open' });
      loadIssues();
    } catch (error) {
      console.error('Error adding issue:', error);
      alert('Failed to add issue. Ensure eos_issues table exists in Supabase.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('eos_issues')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      loadIssues();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = issue.issue_name.toLowerCase().includes(q) ||
                          issue.raised_by.toLowerCase().includes(q) ||
                          issue.workstream.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>Issue Breakdown</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>Track and resolve issues across all workstreams</p>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", color: "#9CA3AF" }}>
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Search issues..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: 240, padding: "8px 16px 8px 36px", background: "#FFFFFF",
                border: "1.5px solid #E8EAF0", borderRadius: 10, fontSize: 13, color: "#1a1d2e",
                outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
              }}
            />
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8, background: "#4F46E5",
              color: "white", padding: "8px 16px", borderRadius: 10, border: "none",
              fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(79,70,229,0.25)"
            }}
          >
            <Plus size={16} />
            Raise Issue
          </button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8 }}>
        {['All', 'Open', 'In Progress', 'Solved'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: statusFilter === status ? "1.5px solid #C7D2FE" : "1.5px solid #E5E7EB",
              background: statusFilter === status ? "#EEF2FF" : "#FFFFFF",
              color: statusFilter === status ? "#4F46E5" : "#6B7280",
              transition: "all 0.15s ease"
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* ── Issues List ───────────────────────────────────── */}
      <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 16, border: "1px solid #E8EAF0", boxShadow: "0 1px 8px rgba(0,0,0,0.05)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9CA3AF", gap: 12 }}>
            <svg style={{ animation: "spin 1s linear infinite", width: 24, height: 24 }} viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <span style={{ fontSize: 13 }}>Loading issues...</span>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9CA3AF", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={24} color="#D1D5DB" />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", color: "#374151", fontWeight: 600, fontSize: 14 }}>No issues found</p>
              <p style={{ margin: 0, fontSize: 13 }}>Raise a new issue to get started.</p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ background: "#FAFBFC", borderBottom: "1px solid #F3F4F6" }}>
                  <th style={{ ...thStyle, width: "35%", textAlign: "left" }}>ISSUE TITLE</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>RAISED BY</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>WORKSTREAM</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>PRIORITY</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue, i) => (
                  <tr key={issue.id} style={{ borderBottom: "1px solid #F9FAFB", background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC" }}>
                    <td style={{ ...tdStyle, textAlign: "left" }}>
                      <div style={{ fontWeight: 600, color: "#1a1d2e", fontSize: 13 }}>{issue.issue_name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                        {new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                          {issue.raised_by.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{issue.raised_by}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "left" }}>
                      <span style={{ fontSize: 13, color: "#6B7280" }}>{issue.workstream}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: PRIORITY_COLORS[issue.priority] }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{issue.priority}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <select
                        value={issue.status}
                        onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                        style={{
                          padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                          cursor: "pointer", outline: "none", border: "none", fontFamily: "inherit",
                          background: issue.status === 'Open' ? '#F3F4F6' : issue.status === 'In Progress' ? '#EFF6FF' : '#ECFDF5',
                          color: issue.status === 'Open' ? '#4B5563' : issue.status === 'In Progress' ? '#2563EB' : '#059669',
                          appearance: "none", textAlign: "center"
                        }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Solved">Solved</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Issue Modal ───────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#FFFFFF", borderRadius: 20, border: "1px solid #E8EAF0", padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1d2e", letterSpacing: "-0.02em" }}>Raise New Issue</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, color: "#6B7280", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
            </div>
            
            <form onSubmit={handleAddIssue} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Issue Title</label>
                <input required type="text" value={newIssue.issue_name} onChange={e => setNewIssue({...newIssue, issue_name: e.target.value})} placeholder="Describe the issue..." style={inputStyle} />
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Raised By</label>
                <input required type="text" value={newIssue.raised_by} onChange={e => setNewIssue({...newIssue, raised_by: e.target.value})} placeholder="Your Name" style={inputStyle} />
              </div>
              
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Workstream</label>
                  <select value={newIssue.workstream} onChange={e => setNewIssue({...newIssue, workstream: e.target.value})} style={inputStyle}>
                    {WORKSTREAMS.map(ws => <option key={ws} value={ws}>{ws}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority</label>
                  <select value={newIssue.priority} onChange={e => setNewIssue({...newIssue, priority: e.target.value})} style={inputStyle}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: "10px 20px", borderRadius: 10, background: "#FFFFFF", border: "1.5px solid #E5E7EB", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "10px 24px", borderRadius: 10, background: "#4F46E5", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(79,70,229,0.3)", opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Creating...' : 'Raise Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Styles ─────────────────────────────────────────
const thStyle = {
  padding: "14px 20px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "#9CA3AF",
};

const tdStyle = {
  padding: "16px 20px",
  fontSize: 13,
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  background: "#F9FAFB",
  border: "1.5px solid #E5E7EB",
  borderRadius: 10,
  fontSize: 13,
  color: "#1a1d2e",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box"
};
