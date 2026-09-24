"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { token } = await authApi.register(
        email,
        password,
        fullName
      );

      window.localStorage.setItem("margai_token", token);

      router.push("/dashboard");
    } catch (err) {
      setError(
        err?.response?.data?.error || "Registration failed"
      );
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
          background: "var(--marg-dark)",
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
          style={{
            color: "#ffffff",
            width: "fit-content",
          }}
        >
          <span
            className="marg-logo-mark"
            style={{
              background: "var(--marg-orange)",
            }}
          />
          Marg.ai
        </a>

        <div style={{ maxWidth: 620 }}>
          <div
            className="marg-page-eyebrow"
            style={{
              color: "var(--marg-orange)",
            }}
          >
            START YOUR JOURNEY
          </div>

          <h1
            style={{
              color: "#ffffff",
              marginTop: 12,
            }}
          >
            Build your path.
            <br />
            Learn your way.
          </h1>

          <p
            style={{
              marginTop: 24,
              maxWidth: 520,
              color: "rgba(255,255,255,0.68)",
              fontSize: 18,
              lineHeight: 1.6,
            }}
          >
            Marg.ai turns your syllabus and current knowledge into a
            personalized learning journey.
          </p>

          <div
            style={{
              marginTop: 40,
              display: "grid",
              gap: 14,
              maxWidth: 420,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <span className="marg-tag marg-tag-orange">
                01
              </span>

              <span
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                }}
              >
                Map what you need to learn
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <span className="marg-tag marg-tag-orange">
                02
              </span>

              <span
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                }}
              >
                Identify your knowledge gaps
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <span className="marg-tag marg-tag-orange">
                03
              </span>

              <span
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                }}
              >
                Follow a personalized path
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
          }}
        >
          MARG.AI / PERSONALIZED LEARNING
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
        <div
          style={{
            width: "100%",
            maxWidth: 420,
          }}
        >
          <div style={{ marginBottom: 32 }}>
            <div className="marg-page-eyebrow">
              CREATE ACCOUNT
            </div>

            <h2 style={{ marginTop: 8 }}>
              Start learning.
            </h2>

            <p
              style={{
                marginTop: 12,
                color: "var(--marg-muted)",
              }}
            >
              Create your Marg.ai account and start building your
              learning path.
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
              <label
                htmlFor="fullName"
                className="marg-label"
              >
                Full name
              </label>

              <input
                id="fullName"
                className="marg-input"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="marg-label"
              >
                Email
              </label>

              <input
                id="email"
                className="marg-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="marg-label"
              >
                Password
              </label>

              <input
                id="password"
                className="marg-input"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "12px 14px",
                  border:
                    "1px solid rgba(234,40,4,0.25)",
                  background:
                    "rgba(234,40,4,0.06)",
                  color:
                    "var(--marg-orange-dark)",
                  borderRadius:
                    "var(--radius-sm)",
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
              {loading
                ? "Creating account..."
                : "Create account"}
            </button>
          </form>

          <div
            style={{
              margin: "32px 0",
              borderTop:
                "1px solid var(--marg-border)",
            }}
          />

          <p
            style={{
              color: "var(--marg-muted)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Already have an account?{" "}
            <a
              href="/login"
              style={{
                color: "var(--marg-orange)",
                fontWeight: 600,
              }}
            >
              Log in
            </a>
          </p>

          <p
            style={{
              marginTop: 28,
              color: "var(--marg-ash)",
              fontFamily:
                "JetBrains Mono, monospace",
              fontSize: 10,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Knowledge graphs · AI teaching · Practice
          </p>
        </div>
      </section>
    </main>
  );
}