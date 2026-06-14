"use client";

import { useState } from "react";

/* ─── SVG Icon Components ─── */
function RxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h6a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H6V3z" />
      <path d="M6 9h5l5 12" />
      <path d="M13 15l5-6" />
      <line x1="6" y1="3" x2="6" y2="21" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 4L12 13L2 4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/* ─── Main Login Page ─── */
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="login-wrapper dot-matrix">
      {/* ── Left: Login Form ── */}
      <div className="login-left">
        {/* Brand */}
        <div className="animate-fade-in">
          <div className="brand-logo">
            <div className="brand-logo-icon">
              <RxIcon />
            </div>
            <div className="brand-name">
              Rx<span>List</span>
            </div>
          </div>
        </div>

        <div className="animate-fade-in-delay-1">
          <div className="status-indicator">
            <span className="status-dot" />
            System Online
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card animate-fade-in-delay-2">
          <h1>Welcome Back</h1>
          <p className="subtitle">
            Sign in to access your patient prescription dashboard and AI-powered
            Rx scanning tools.
          </p>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Email
              </label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">
                  <MailIcon />
                </span>
                <input
                  id="login-email"
                  className="form-input"
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div className="form-input-wrapper">
                <span className="form-input-icon">
                  <LockIcon />
                </span>
                <input
                  id="login-password"
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="form-row">
              <label className="form-checkbox">
                <input type="checkbox" id="remember-me" />
                Remember me
              </label>
              <a href="#" className="form-link">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button type="submit" className="btn-primary" id="login-submit">
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div className="login-divider">
            <span>or</span>
          </div>

          {/* Social */}
          <button className="btn-social" id="google-login">
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Signup */}
          <div className="signup-prompt">
            Don&apos;t have an account?{" "}
            <a href="#">Request Access</a>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer animate-fade-in-delay-4">
          © 2026 RxList · HIPAA Compliant · v1.0.0
        </div>
      </div>

      {/* ── Right: Feature Showcase ── */}
      <div className="login-right">
        <div className="scan-line-effect" />

        <div className="feature-showcase animate-fade-in-delay-1">
          {/* Glyph Interface Animation */}
          <div className="glyph-interface">
            <div className="glyph-ring" />
            <div className="glyph-ring" />
            <div className="glyph-ring" />
            <div className="glyph-center">
              <ScanIcon />
            </div>
            <div className="glyph-dots">
              <div className="glyph-dot" />
              <div className="glyph-dot" />
              <div className="glyph-dot" />
              <div className="glyph-dot" />
            </div>
          </div>

          <h2>AI-Powered Rx Scanning</h2>
          <p>
            Transform handwritten prescriptions into organized, actionable
            checklists — powered by artificial intelligence.
          </p>

          {/* Feature Steps */}
          <div className="feature-steps">
            <div className="feature-step">
              <div className="feature-step-number">01</div>
              <div className="feature-step-content">
                <h3>Scan Prescription</h3>
                <p>
                  Upload or photograph the patient&apos;s Rx list using your device
                  camera.
                </p>
              </div>
            </div>

            <div className="feature-step">
              <div className="feature-step-number">02</div>
              <div className="feature-step-content">
                <h3>AI Processing</h3>
                <p>
                  Our AI engine reads, identifies, and validates each medication
                  automatically.
                </p>
              </div>
            </div>

            <div className="feature-step">
              <div className="feature-step-number">03</div>
              <div className="feature-step-content">
                <h3>Smart Checklist</h3>
                <p>
                  Receive an organized checklist with dosages, schedules, and
                  interaction alerts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
