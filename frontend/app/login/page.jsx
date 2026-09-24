"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token } = await authApi.login(email, password);

      window.localStorage.setItem("margai_token", token);

      router.push("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
      }}
    >
      {/* Left panel */}
      <section
        style={{
          background: "var(--marg-orange)",
          color: "#ffffff",
          padding: "48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <a
          href="/"
          className="marg-logo"
          style={{ color: "#ffffff", width: "fit-content" }}
        >
          <span
            className="marg-logo-mark"
            style={{ background: "#ffffff" }}
          />
          Marg.ai
        </a>

        <div style={{ maxWidth: 620 }}>
          <div
            className="marg-page-eyebrow"
            style={{ color: "#ffffff" }}
          >
            YOUR LEARNING PATH
          </div>

          <h1 style={{ color: "#ffffff", marginTop: 12 }}>
            Welcome back.
            <br />
            Continue learning.
          </h1>

          <p
            style={{
              marginTop: 24,
              maxWidth: 500,
              color: "rgba(255,255,255,0.82)",
              fontSize: 18,
              lineHeight: 1.6,
            }}
          >
            Return to your personalized learning path and keep building your
            understanding, one concept at a time.
          </p>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.7)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
          }}
        >
          MARG.AI / LEARN
        </div>
      </section>

      {/* Right panel */}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
          background: "var(--marg-canvas)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ marginBottom: 36 }}>
            <div className="marg-page-eyebrow">WELCOME BACK</div>

            <h2 style={{ marginTop: 8 }}>Log in</h2>

            <p
              style={{
                marginTop: 12,
                color: "var(--marg-muted)",
              }}
            >
              Log in to continue your learning path.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gap: 20,
            }}
          >
            <div>
              <label htmlFor="email" className="marg-label">
                Email
              </label>

              <input
                id="email"
                className="marg-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="marg-label">
                Password
              </label>

              <input
                id="password"
                className="marg-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "12px 14px",
                  border: "1px solid rgba(234,40,4,0.25)",
                  background: "rgba(234,40,4,0.06)",
                  color: "var(--marg-orange-dark)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="marg-btn marg-btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                minHeight: 48,
                marginTop: 4,
              }}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div
            style={{
              margin: "32px 0",
              borderTop: "1px solid var(--marg-border)",
            }}
          />

          <p
            style={{
              color: "var(--marg-muted)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Don't have an account?{" "}
            <a
              href="/register"
              style={{
                color: "var(--marg-orange)",
                fontWeight: 600,
              }}
            >
              Create one
            </a>
          </p>

          <p
            style={{
              marginTop: 28,
              color: "var(--marg-ash)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Personalized learning · Knowledge graphs · AI
          </p>
        </div>
      </section>
    </main>
  );
}