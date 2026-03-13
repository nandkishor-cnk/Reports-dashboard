import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', system-ui, sans-serif;
          background: #F5F6FA;
        }

        /* Left panel — branding */
        .login-left {
          width: 480px;
          min-width: 400px;
          background: linear-gradient(155deg, #1a1d2e 0%, #252840 50%, #1e1f35 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 52px;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute;
          top: -120px; left: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(146,114,58,0.25) 0%, transparent 65%);
          pointer-events: none;
        }
        .login-left::after {
          content: '';
          position: absolute;
          bottom: -80px; right: -80px;
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%);
          pointer-events: none;
        }

        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }
        .login-logo-mark {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #92723A 0%, #C9A252 50%, #E8C170 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.02em;
          box-shadow: 0 6px 24px rgba(146,114,58,0.5);
        }
        .login-brand { position: relative; z-index: 1; }
        .login-brand-name {
          font-size: 17px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          letter-spacing: -0.02em;
        }
        .login-brand-sub {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .login-hero {
          position: relative;
          z-index: 1;
        }
        .login-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(201,162,82,0.18);
          border: 1px solid rgba(201,162,82,0.3);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 11px;
          font-weight: 600;
          color: #E8C170;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .login-hero-dot {
          width: 6px; height: 6px;
          background: #E8C170;
          border-radius: 50%;
        }
        .login-hero-title {
          font-size: 38px;
          font-weight: 800;
          color: white;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin: 0 0 16px;
        }
        .login-hero-title span {
          background: linear-gradient(135deg, #C9A252, #E8C170);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .login-hero-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.45);
          line-height: 1.6;
          margin: 0;
          max-width: 340px;
        }

        .login-meta {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 12px;
          color: rgba(255,255,255,0.25);
        }
        .login-meta-dot { color: rgba(255,255,255,0.15); }

        /* Right panel — form */
        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          background: #F5F6FA;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
        }
        .login-card-heading {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          color: #1a1d2e;
          letter-spacing: -0.02em;
        }
        .login-card-sub {
          margin: 0 0 36px;
          font-size: 14px;
          color: #9CA3AF;
        }

        .login-field {
          margin-bottom: 18px;
        }
        .login-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          letter-spacing: 0.02em;
        }
        .login-input {
          width: 100%;
          padding: 11px 14px;
          background: #FFFFFF;
          border: 1.5px solid #E5E7EB;
          border-radius: 12px;
          font-size: 14px;
          font-family: inherit;
          color: #1a1d2e;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .login-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .login-input::placeholder { color: #D1D5DB; }

        .login-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #DC2626;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .login-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 18px rgba(79,70,229,0.35);
          margin-top: 8px;
          letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(79,70,229,0.45);
        }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .login-footer {
          margin-top: 28px;
          text-align: center;
          font-size: 12px;
          color: #D1D5DB;
        }

        @media (max-width: 800px) {
          .login-left { display: none; }
        }
      `}</style>

      <div className="login-root">
        {/* Left branding panel */}
        <div className="login-left">
          <div className="login-logo">
            <div className="login-logo-mark">CK</div>
            <div className="login-brand">
              <div className="login-brand-name">Cox &amp; Kings</div>
              <div className="login-brand-sub">EOS Operating System</div>
            </div>
          </div>

          <div className="login-hero">
            <div className="login-hero-badge">
              <span className="login-hero-dot" />
              Enterprise Dashboard
            </div>
            <h1 className="login-hero-title">
              Manage your<br />
              <span>EOS Scorecard</span><br />
              with clarity.
            </h1>
            <p className="login-hero-sub">
              Real-time metrics, KPI tracking, task management and team coordination — all in one place.
            </p>
          </div>

          <div className="login-meta">
            <span>Cox &amp; Kings</span>
            <span className="login-meta-dot">·</span>
            <span>Sales & Operations</span>
            <span className="login-meta-dot">·</span>
            <span>Confidential</span>
          </div>
        </div>

        {/* Right form panel */}
        <div className="login-right">
          <div className="login-card">
            <h2 className="login-card-heading">Welcome back</h2>
            <p className="login-card-sub">Sign in to access your dashboard</p>

            {error && (
              <div className="login-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label className="login-label">Email address</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="you@coxandkings.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  type="password"
                  className="login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Signing in…" : "Sign in to Dashboard"}
              </button>
            </form>

            <div className="login-footer">
              Cox &amp; Kings © 2025 · Confidential
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
