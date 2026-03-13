import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";

import ScorecardDashboard from "../scorecard_dashboard.jsx";

// EOS Modules
import Dashboard from "./pages/eos/Dashboard";
import Tasks from "./pages/eos/Tasks";
import Kanban from "./pages/eos/Kanban";
import Owners from "./pages/eos/Owners";
import Timeline from "./pages/eos/Timeline";
import Issues from "./pages/eos/Issues";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div style={{ minHeight: "100vh", background: "#F5F6FA", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontFamily: "Inter, system-ui, sans-serif", fontSize: 15, gap: 10 }}><svg style={{ animation: "spin 1s linear infinite", width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<ScorecardDashboard />} />
        <Route path="eos">
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="owners" element={<Owners />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="issues" element={<Issues />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
