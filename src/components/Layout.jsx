import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { 
  BarChart2, 
  CheckSquare, 
  KanbanSquare, 
  LayoutDashboard, 
  Users, 
  Clock, 
  AlertTriangle,
  LogOut
} from "lucide-react";

const NAV_ITEMS = [
  { label: "SCORECARD", items: [
    { name: "Company Scorecard", icon: BarChart2, to: "/", end: true },
  ]},
  { label: "EOS TRACKER", items: [
    { name: "EOS Dashboard",  icon: LayoutDashboard, to: "/eos",          end: true },
    { name: "Master Tasks",   icon: CheckSquare,     to: "/eos/tasks"              },
    { name: "Kanban Board",   icon: KanbanSquare,    to: "/eos/kanban"             },
    { name: "Owner Overview", icon: Users,           to: "/eos/owners"             },
    { name: "Weekly Timeline",icon: Clock,           to: "/eos/timeline"           },
    { name: "Issue Breakdown",icon: AlertTriangle,   to: "/eos/issues"             },
  ]},
];

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate("/login");
  };

  const initials = user?.email?.charAt(0).toUpperCase() || "U";
  const emailDisplay = user?.email || "User";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .layout-root {
          display: flex;
          height: 100vh;
          background: #F5F6FA;
          color: #1a1d2e;
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 256px;
          min-width: 256px;
          display: flex;
          flex-direction: column;
          background: #FFFFFF;
          border-right: 1px solid #E8EAF0;
          position: relative;
          z-index: 20;
          overflow: hidden;
          box-shadow: 2px 0 16px rgba(0,0,0,0.04);
        }

        /* Logo block */
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 18px;
          border-bottom: 1px solid #F0F1F5;
          position: relative;
          z-index: 1;
        }
        .sidebar-logo-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #92723A 0%, #C9A252 50%, #E8C170 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.02em;
          box-shadow: 0 4px 14px rgba(146,114,58,0.35);
          flex-shrink: 0;
        }
        .sidebar-brand-name {
          font-size: 14px;
          font-weight: 700;
          color: #1a1d2e;
          line-height: 1.1;
          letter-spacing: -0.01em;
        }
        .sidebar-brand-sub {
          font-size: 9px;
          font-weight: 600;
          color: #9EA3B3;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* Nav sections */
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 16px 10px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          z-index: 1;
        }
        .nav-section-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #B8BFCE;
          padding: 0 10px 8px;
          text-transform: uppercase;
        }
        .nav-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          color: #6B7280;
          text-decoration: none;
          transition: all 0.15s;
          border: 1px solid transparent;
          cursor: pointer;
        }
        .nav-link:hover {
          color: #1a1d2e;
          background: #F5F6FA;
        }
        .nav-link.active {
          color: #4F46E5;
          background: #EEF2FF;
          border-color: #C7D2FE;
          font-weight: 600;
        }
        .nav-link svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          opacity: 0.65;
        }
        .nav-link.active svg { opacity: 1; color: #4F46E5; }

        /* User footer */
        .sidebar-footer {
          border-top: 1px solid #F0F1F5;
          padding: 14px 12px;
          background: #FAFBFC;
          position: relative;
          z-index: 1;
        }
        .user-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 6px 12px;
        }
        .user-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(99,102,241,0.25);
        }
        .user-email {
          font-size: 12px;
          font-weight: 500;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }
        .user-status {
          font-size: 10px;
          color: #9CA3AF;
          margin-top: 1px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .status-dot {
          width: 5px;
          height: 5px;
          background: #10B981;
          border-radius: 50%;
        }
        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          color: #6B7280;
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }
        .logout-btn:hover {
          background: #FEF2F2;
          border-color: #FECACA;
          color: #DC2626;
        }
        .logout-btn svg { width: 14px; height: 14px; }

        /* ── Main content ── */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          min-width: 0;
          background: #F5F6FA;
        }

        .main-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 32px 36px;
          position: relative;
          z-index: 1;
        }
        .main-inner {
          max-width: 1600px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>

      <div className="layout-root">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* Logo */}
          <div className="sidebar-logo">
            <div className="sidebar-logo-mark">CK</div>
            <div>
              <div className="sidebar-brand-name">Cox &amp; Kings</div>
              <div className="sidebar-brand-sub">EOS Operating System</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(section => (
              <div key={section.label}>
                <div className="nav-section-label">{section.label}</div>
                <div className="nav-items">
                  {section.items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                    >
                      <item.icon />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="sidebar-footer">
            <div className="user-card">
              <div className="user-avatar">{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-email">{emailDisplay}</div>
                <div className="user-status">
                  <span className="status-dot" />
                  Online
                </div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main-content">
          <div className="main-scroll">
            <div className="main-inner">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
