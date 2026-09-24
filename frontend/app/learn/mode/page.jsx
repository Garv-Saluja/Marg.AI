"use client";

import NavBar from "../../../components/NavBar";

export default function ModeSelectPage() {
  return (
    <>
      <NavBar />

      <main className="marg-dashboard">
        <div
          className="marg-container"
          style={{
            paddingTop: 72,
            paddingBottom: 96,
          }}
        >
          {/* Header */}
          <header
            style={{
              maxWidth: 760,
              marginBottom: 48,
            }}
          >
            <div className="marg-page-eyebrow">
              STEP 01 / CHOOSE MODE
            </div>

            <h1
              style={{
                marginTop: 10,
                fontSize: "clamp(44px, 6vw, 72px)",
              }}
            >
              How do you want
              <br />
              to learn?
            </h1>

            <p
              style={{
                marginTop: 20,
                maxWidth: 620,
                color: "var(--marg-muted)",
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              Start with everything you need to learn, or focus on one
              concept. Marg.ai will adapt the learning path to what you
              already know.
            </p>
          </header>

          {/* Learning options */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <a
              href="/learn/syllabus"
              className="marg-card marg-card-hover"
              style={{
                padding: 32,
                display: "flex",
                flexDirection: "column",
                minHeight: 360,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span className="marg-tag marg-tag-orange">
                  FULL SYLLABUS
                </span>

                <span
                  className="marg-mono"
                  style={{
                    color: "var(--marg-orange)",
                    fontSize: 12,
                  }}
                >
                  01
                </span>
              </div>

              <div style={{ marginTop: 56 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--marg-border-strong)",
                    borderRadius: "50%",
                    fontFamily:
                      "JetBrains Mono, monospace",
                    fontSize: 18,
                  }}
                >
                  →
                </div>

                <h2
                  style={{
                    marginTop: 24,
                    fontSize: 34,
                  }}
                >
                  Learn the
                  <br />
                  whole subject.
                </h2>

                <p
                  style={{
                    marginTop: 14,
                    maxWidth: 420,
                    color: "var(--marg-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Upload your syllabus and let Marg.ai map the
                  concepts, identify your gaps, and build a complete
                  personalized study path.
                </p>
              </div>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 32,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop:
                    "1px solid var(--marg-border)",
                }}
              >
                <span
                  style={{
                    color: "var(--marg-muted)",
                    fontSize: 13,
                  }}
                >
                  Syllabus → Knowledge graph → Path
                </span>

                <span
                  style={{
                    color: "var(--marg-orange)",
                    fontWeight: 600,
                  }}
                >
                  Start →
                </span>
              </div>
            </a>

            <a
              href="/learn/topic"
              className="marg-card marg-card-hover"
              style={{
                padding: 32,
                display: "flex",
                flexDirection: "column",
                minHeight: 360,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span className="marg-tag">
                  SINGLE TOPIC
                </span>

                <span
                  className="marg-mono"
                  style={{
                    color: "var(--marg-muted)",
                    fontSize: 12,
                  }}
                >
                  02
                </span>
              </div>

              <div style={{ marginTop: 56 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--marg-border-strong)",
                    borderRadius: "50%",
                    fontFamily:
                      "JetBrains Mono, monospace",
                    fontSize: 18,
                  }}
                >
                  →
                </div>

                <h2
                  style={{
                    marginTop: 24,
                    fontSize: 34,
                  }}
                >
                  Focus on
                  <br />
                  one topic.
                </h2>

                <p
                  style={{
                    marginTop: 14,
                    maxWidth: 420,
                    color: "var(--marg-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Choose a topic and Marg.ai will identify the
                  prerequisites, assess your understanding, and
                  focus only on the gaps that matter.
                </p>
              </div>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 32,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop:
                    "1px solid var(--marg-border)",
                }}
              >
                <span
                  style={{
                    color: "var(--marg-muted)",
                    fontSize: 13,
                  }}
                >
                  Topic → Assessment → Learning
                </span>

                <span
                  style={{
                    color: "var(--marg-orange)",
                    fontWeight: 600,
                  }}
                >
                  Start →
                </span>
              </div>
            </a>
          </div>

          {/* Process indicator */}
          <div
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop:
                "1px solid var(--marg-border)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "var(--marg-muted)",
              fontFamily:
                "JetBrains Mono, monospace",
              fontSize: 11,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                color: "var(--marg-orange)",
              }}
            >
              01
            </span>

            <span>Choose mode</span>

            <span>→</span>

            <span>02</span>

            <span>Assess</span>

            <span>→</span>

            <span>03</span>

            <span>Learn</span>

            <span>→</span>

            <span>04</span>

            <span>Master</span>
          </div>
        </div>
      </main>
    </>
  );
}