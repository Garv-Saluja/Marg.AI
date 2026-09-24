"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "../../lib/api";
import NavBar from "../../components/NavBar";

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [knowledgeProfile, setKnowledgeProfile] = useState(null);
  const [currentLearning, setCurrentLearning] = useState(null);

  useEffect(() => {
    dashboardApi.overview().then(setOverview).catch(() => {});
    dashboardApi
      .knowledgeProfile()
      .then(setKnowledgeProfile)
      .catch(() => {});
    dashboardApi
      .currentLearning()
      .then(setCurrentLearning)
      .catch(() => {});
  }, []);

  const weakConcepts = knowledgeProfile?.weakConcepts || [];
  const strongConcepts = knowledgeProfile?.strongConcepts || [];
  const steps = currentLearning?.steps || [];

  const completedSteps = steps.filter(
    (step) => step.status === "completed"
  ).length;

  const progress =
    steps.length > 0
      ? Math.round((completedSteps / steps.length) * 100)
      : 0;

  return (
    <div className="marg-dashboard">
      <NavBar />

      <main className="marg-dashboard-main">
        {/* Header */}
        <header className="marg-page-header">
          <div>
            <div className="marg-page-eyebrow">
              MARG.AI / DASHBOARD
            </div>

            <h1 className="marg-page-title">
              Your learning path.
            </h1>

            <p className="marg-page-description">
              See where you are, understand your knowledge gaps, and
              continue learning from where you left off.
            </p>
          </div>

          <a
            href="/learn/mode"
            className="marg-btn marg-btn-primary"
          >
            Start learning
          </a>
        </header>

        {/* Overview */}
        <section style={{ marginTop: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div className="marg-page-eyebrow">
                OVERVIEW
              </div>

              <h3>Knowledge at a glance</h3>
            </div>
          </div>

          <div className="marg-grid marg-grid-4">
            <StatCard
              label="Concepts"
              value={getConceptCount(overview)}
              meta="Mapped concepts"
            />

            <StatCard
              label="Weak"
              value={weakConcepts.length}
              meta="Need attention"
            />

            <StatCard
              label="Strong"
              value={strongConcepts.length}
              meta="Mastered concepts"
            />

            <StatCard
              label="Path progress"
              value={`${progress}%`}
              meta={
                steps.length > 0
                  ? `${completedSteps} of ${steps.length} steps`
                  : "No active path"
              }
            />
          </div>
        </section>

        {/* Current Learning */}
        <section style={{ marginTop: 64 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: 20,
            }}
          >
            <div>
              <div className="marg-page-eyebrow">
                CONTINUE
              </div>

              <h2 style={{ fontSize: 36 }}>
                Current learning
              </h2>
            </div>
          </div>

          {currentLearning?.activePath ? (
            <div className="marg-card">
              <div style={{ padding: 28 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 24,
                  }}
                >
                  <div>
                    <span className="marg-tag marg-tag-orange">
                      ACTIVE PATH
                    </span>

                    <h3 style={{ marginTop: 16 }}>
                      {formatScope(
                        currentLearning.activePath.scope
                      )}
                    </h3>

                    <p
                      style={{
                        marginTop: 8,
                        color: "var(--marg-muted)",
                        fontSize: 14,
                      }}
                    >
                      Continue working through your personalized
                      learning path.
                    </p>
                  </div>

                  <span
                    className="marg-mono"
                    style={{
                      color: "var(--marg-orange)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {progress}%
                  </span>
                </div>

                <div style={{ marginTop: 24 }}>
                  <div className="marg-progress">
                    <div
                      className="marg-progress-bar"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {steps.length > 0 && (
                <div
                  style={{
                    borderTop:
                      "1px solid var(--marg-border)",
                    padding: "24px 28px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    {steps.slice(0, 5).map((step, index) => {
                      const completed =
                        step.status === "completed";
                      const active =
                        step.status === "in_progress" ||
                        step.status === "active";

                      return (
                        <div
                          key={step.step_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `1px solid ${
                                completed || active
                                  ? "var(--marg-orange)"
                                  : "var(--marg-border)"
                              }`,
                              borderRadius: "50%",
                              background: completed
                                ? "var(--marg-orange)"
                                : "transparent",
                              color: completed
                                ? "#ffffff"
                                : active
                                  ? "var(--marg-orange)"
                                  : "var(--marg-muted)",
                              fontFamily:
                                "JetBrains Mono, monospace",
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {completed ? "✓" : index + 1}
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                              }}
                            >
                              {step.concept_label}
                            </div>

                            <div
                              style={{
                                marginTop: 2,
                                color:
                                  "var(--marg-muted)",
                                fontSize: 12,
                              }}
                            >
                              {formatStatus(step.status)}
                            </div>
                          </div>

                          {active && (
                            <span className="marg-tag marg-tag-orange">
                              CURRENT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <a
                    href={`/learn/path/${currentLearning.activePath.learning_path_id}`}
                    className="marg-btn marg-btn-dark"
                    style={{
                      marginTop: 24,
                      width: "100%",
                    }}
                  >
                    Continue learning →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="marg-empty">
              <div className="marg-empty-title">
                No active learning path
              </div>

              <p className="marg-empty-description">
                Start with a full syllabus or choose a single topic
                to create your personalized learning path.
              </p>

              <a
                href="/learn/mode"
                className="marg-btn marg-btn-primary"
                style={{ marginTop: 24 }}
              >
                Choose learning mode
              </a>
            </div>
          )}
        </section>

        {/* Knowledge Profile */}
        <section style={{ marginTop: 72 }}>
          <div style={{ marginBottom: 24 }}>
            <div className="marg-page-eyebrow">
              KNOWLEDGE PROFILE
            </div>

            <h2 style={{ fontSize: 36 }}>
              What you know.
            </h2>

            <p
              style={{
                marginTop: 8,
                color: "var(--marg-muted)",
              }}
            >
              Your current understanding across mapped concepts.
            </p>
          </div>

          <div className="marg-grid marg-grid-2">
            {/* Weak concepts */}
            <section className="marg-card">
              <div
                style={{
                  padding: 24,
                  borderBottom:
                    "1px solid var(--marg-border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span className="marg-tag">
                      NEEDS ATTENTION
                    </span>

                    <h3 style={{ marginTop: 14 }}>
                      Knowledge gaps
                    </h3>
                  </div>

                  <span
                    style={{
                      color: "var(--marg-orange)",
                      fontFamily:
                        "JetBrains Mono, monospace",
                      fontSize: 13,
                    }}
                  >
                    {weakConcepts.length}
                  </span>
                </div>
              </div>

              <ConceptList
                concepts={weakConcepts}
                emptyMessage="No weak concepts detected yet."
                weak
              />
            </section>

            {/* Strong concepts */}
            <section className="marg-card">
              <div
                style={{
                  padding: 24,
                  borderBottom:
                    "1px solid var(--marg-border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span className="marg-tag marg-tag-success">
                      STRONG
                    </span>

                    <h3 style={{ marginTop: 14 }}>
                      Mastered concepts
                    </h3>
                  </div>

                  <span
                    style={{
                      color: "#2b9a66",
                      fontFamily:
                        "JetBrains Mono, monospace",
                      fontSize: 13,
                    }}
                  >
                    {strongConcepts.length}
                  </span>
                </div>
              </div>

              <ConceptList
                concepts={strongConcepts}
                emptyMessage="No strong concepts recorded yet."
              />
            </section>
          </div>
        </section>

        {/* Bottom CTA */}
        <section
          style={{
            marginTop: 72,
            padding: "40px 0",
            borderTop:
              "1px solid var(--marg-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div>
              <div className="marg-page-eyebrow">
                KEEP GOING
              </div>

              <h3>Ready for the next concept?</h3>
            </div>

            <a
              href="/learn/mode"
              className="marg-btn marg-btn-primary"
            >
              Learn something new
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, meta }) {
  return (
    <div className="marg-stat">
      <div className="marg-stat-label">{label}</div>

      <div className="marg-stat-value">
        {value}
      </div>

      <div className="marg-stat-meta">
        {meta}
      </div>
    </div>
  );
}

function ConceptList({
  concepts,
  emptyMessage,
  weak = false,
}) {
  if (!concepts.length) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--marg-muted)",
          fontSize: 14,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {concepts.map((concept) => (
        <div
          key={concept.concept_id}
          style={{
            padding: "16px 24px",
            borderBottom:
              "1px solid var(--marg-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {concept.concept_label}
            </span>

            <span
              className="marg-mono"
              style={{
                color: weak
                  ? "var(--marg-orange)"
                  : "#2b9a66",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {concept.mastery_score}%
            </span>
          </div>

          <div
            className="marg-progress"
            style={{
              marginTop: 10,
              height: 4,
            }}
          >
            <div
              className="marg-progress-bar"
              style={{
                width: `${Math.min(
                  Math.max(
                    Number(concept.mastery_score) || 0,
                    0
                  ),
                  100
                )}%`,
                background: weak
                  ? "var(--marg-orange)"
                  : "#2b9a66",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function getConceptCount(overview) {
  if (!overview?.conceptCounts) {
    return "—";
  }

  const counts = overview.conceptCounts;

  return Object.values(counts).reduce(
    (total, value) =>
      total + (Number(value) || 0),
    0
  );
}

function formatScope(scope) {
  if (!scope) return "Learning path";

  return scope
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatStatus(status) {
  if (!status) return "Not started";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}