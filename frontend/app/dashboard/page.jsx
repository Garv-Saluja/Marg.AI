
"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "../../lib/api";
import NavBar from "../../components/NavBar";

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [knowledgeProfile, setKnowledgeProfile] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [pathError, setPathError] = useState("");

  useEffect(() => {
    let mounted = true;

    dashboardApi.overview()
      .then((data) => {
        if (mounted) setOverview(data);
      })
      .catch(console.error);

    dashboardApi.knowledgeProfile()
      .then((data) => {
        if (mounted) setKnowledgeProfile(data);
      })
      .catch(console.error);

    dashboardApi.currentLearning()
      .then((data) => {
        if (!mounted) return;

        let paths = [];

        if (Array.isArray(data)) {
          paths = data;
        } else if (Array.isArray(data?.learningPaths)) {
          paths = data.learningPaths;
        } else if (Array.isArray(data?.paths)) {
          paths = data.paths;
        } else if (data?.activePath) {
          paths = [{
            ...data.activePath,
            steps: data.steps || [],
          }];
        }

        setLearningPaths(paths);
      })
      .catch((error) => {
        console.error("Failed to load learning paths:", error);
        if (mounted) setPathError("Could not load your learning paths.");
      })
      .finally(() => {
        if (mounted) setLoadingPaths(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const weakConcepts = knowledgeProfile?.weakConcepts || [];
  const strongConcepts = knowledgeProfile?.strongConcepts || [];

  const allSteps = learningPaths.flatMap((path) =>
    Array.isArray(path.steps) ? path.steps : []
  );

  const completedSteps = allSteps.filter(
    (step) => step.status === "completed"
  ).length;

  const progress = allSteps.length
    ? Math.round((completedSteps / allSteps.length) * 100)
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

          <a href="/learn/mode" className="marg-btn marg-btn-primary">
            Start learning
          </a>
        </header>

        {/* Overview */}
        <section style={{ marginTop: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <div className="marg-page-eyebrow">OVERVIEW</div>
            <h3>Knowledge at a glance</h3>
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
                allSteps.length
                  ? `${completedSteps} of ${allSteps.length} steps`
                  : "No steps available"
              }
            />
          </div>
        </section>

        {/* All learning paths */}
        <section style={{ marginTop: 64 }}>
          <div style={{ marginBottom: 20 }}>
            <div className="marg-page-eyebrow">CONTINUE</div>
            <h2 style={{ fontSize: 36 }}>Current learning</h2>

            <p style={{ marginTop: 8, color: "var(--marg-muted)" }}>
              Continue your Full Syllabus or Single Topic learning path.
            </p>
          </div>

          {loadingPaths ? (
            <div className="marg-empty">Loading your learning paths...</div>
          ) : pathError ? (
            <div className="marg-empty">
              <div className="marg-empty-title">{pathError}</div>
            </div>
          ) : learningPaths.length > 0 ? (
            <div style={{ display: "grid", gap: 24 }}>
              {learningPaths.map((path, index) => {
                const steps = Array.isArray(path.steps) ? path.steps : [];
                const done = steps.filter(
                  (step) => step.status === "completed"
                ).length;

                const pathProgress = steps.length
                  ? Math.round((done / steps.length) * 100)
                  : 0;

                const pathId =
                  path.learning_path_id ?? path.learningPathId;

                const title =
                  path.title ||
                  path.topic ||
                  path.subject_name ||
                  formatScope(path.scope);

                return (
                  <article
                    className="marg-card"
                    key={pathId ?? `${path.scope}-${index}`}
                  >
                    <div style={{ padding: 28 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 24,
                        }}
                      >
                        <div>
                          <span className="marg-tag marg-tag-orange">
                            {String(path.status || "ACTIVE")
                              .replace(/_/g, " ")
                              .toUpperCase()}
                          </span>

                          <h3 style={{ marginTop: 16 }}>
                            {formatConceptLabel(title)}
                          </h3>

                          <p
                            style={{
                              marginTop: 8,
                              color: "var(--marg-muted)",
                              fontSize: 14,
                            }}
                          >
                            {formatScope(path.scope)} · {steps.length} steps
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
                          {pathProgress}%
                        </span>
                      </div>

                      <div style={{ marginTop: 24 }}>
                        <div className="marg-progress">
                          <div
                            className="marg-progress-bar"
                            style={{ width: `${pathProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: "1px solid var(--marg-border)",
                        padding: "24px 28px",
                      }}
                    >
                      {steps.length ? (
                        <>
                          <div style={{ display: "grid", gap: 12 }}>
                            {steps.slice(0, 5).map((step, stepIndex) => {
                              const completed =
                                step.status === "completed";
                              const active =
                                step.status === "in_progress" ||
                                step.status === "active";

                              return (
                                <div
                                  key={
                                    step.step_id ||
                                    step.concept_id ||
                                    step.conceptId ||
                                    `${pathId}-${stepIndex}`
                                  }
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 14,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
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
                                        ? "#fff"
                                        : "var(--marg-muted)",
                                      fontSize: 11,
                                    }}
                                  >
                                    {completed ? "✓" : stepIndex + 1}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {formatConceptLabel(
                                        step.concept_label ||
                                        step.conceptLabel ||
                                        step.concept_id ||
                                        step.conceptId
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        marginTop: 2,
                                        color: "var(--marg-muted)",
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

                          {pathId && (
                            <a
                              href={`/learn/path/${pathId}`}
                              className="marg-btn marg-btn-dark"
                              style={{ marginTop: 24, width: "100%" }}
                            >
                              Continue learning →
                            </a>
                          )}
                        </>
                      ) : (
                        <p style={{ color: "var(--marg-muted)" }}>
                          No steps were returned for this path.
                          {pathId && (
                            <>
                              {" "}
                              <a href={`/learn/path/${pathId}`}>
                                Open learning path
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="marg-empty">
              <div className="marg-empty-title">
                No learning paths found
              </div>

              <p className="marg-empty-description">
                Start a full syllabus or select a single topic.
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
            <div className="marg-page-eyebrow">KNOWLEDGE PROFILE</div>
            <h2 style={{ fontSize: 36 }}>What you know.</h2>

            <p style={{ marginTop: 8, color: "var(--marg-muted)" }}>
              Your current understanding across mapped concepts.
            </p>
          </div>

          <div className="marg-grid marg-grid-2">
            <section className="marg-card">
              <div
                style={{
                  padding: 24,
                  borderBottom: "1px solid var(--marg-border)",
                }}
              >
                <span className="marg-tag">NEEDS ATTENTION</span>
                <h3 style={{ marginTop: 14 }}>Knowledge gaps</h3>
                <span style={{ color: "var(--marg-orange)" }}>
                  {weakConcepts.length}
                </span>
              </div>

              <ConceptList
                concepts={weakConcepts}
                emptyMessage="No weak concepts detected yet."
                weak
              />
            </section>

            <section className="marg-card">
              <div
                style={{
                  padding: 24,
                  borderBottom: "1px solid var(--marg-border)",
                }}
              >
                <span className="marg-tag marg-tag-success">STRONG</span>
                <h3 style={{ marginTop: 14 }}>Mastered concepts</h3>
                <span style={{ color: "#2b9a66" }}>
                  {strongConcepts.length}
                </span>
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
            borderTop: "1px solid var(--marg-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="marg-page-eyebrow">KEEP GOING</div>
              <h3>Ready for the next concept?</h3>
            </div>

            <a href="/learn/mode" className="marg-btn marg-btn-primary">
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
      <div className="marg-stat-value">{value}</div>
      <div className="marg-stat-meta">{meta}</div>
    </div>
  );
}

function ConceptList({ concepts, emptyMessage, weak = false }) {
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
      {concepts.map((concept, index) => {
        const mastery = Math.min(
          100,
          Math.max(0, Number(concept.mastery_score) || 0)
        );

        return (
          <div
            key={concept.concept_id || `${concept.concept_label}-${index}`}
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid var(--marg-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {formatConceptLabel(
                  concept.concept_label || concept.concept_id
                )}
              </span>

              <span
                className="marg-mono"
                style={{
                  color: weak ? "var(--marg-orange)" : "#2b9a66",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {mastery}%
              </span>
            </div>

            <div
              className="marg-progress"
              style={{ marginTop: 10, height: 4 }}
            >
              <div
                className="marg-progress-bar"
                style={{
                  width: `${mastery}%`,
                  background: weak ? "var(--marg-orange)" : "#2b9a66",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatConceptLabel(label) {
  if (!label) return "Unknown concept";

  let value = String(label).trim();

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original label if it contains malformed URL encoding.
  }

  value = value
    .replace(/^generated[._-]+/i, "")
    // Remove generated hash suffixes separated by spaces, dots, underscores,
    // or hyphens. Accept alphanumeric hashes so labels like "Array Dbe42cc09c"
    // are cleaned even if the suffix is not strictly hexadecimal.
    .replace(/[\s._-]+[a-z0-9]{8,}$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const specialLabels = {
    os: "Operating System",
    dbms: "DBMS",
    dsa: "DSA",
    cpu: "CPU",
    sql: "SQL",
    api: "API",
    ai: "AI",
  };

  const words = value.split(" ");

  if (words.length >= 2 && words[0].toLowerCase() === "os") {
    return (
      "Operating System: " +
      words.slice(1).map(capitalize).join(" ")
    );
  }

  return words
    .map((word) => specialLabels[word.toLowerCase()] || capitalize(word))
    .join(" ");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function getConceptCount(overview) {
  if (!overview?.conceptCounts) return "—";

  return Object.values(overview.conceptCounts).reduce(
    (total, value) => total + (Number(value) || 0),
    0
  );
}

function formatScope(scope) {
  if (!scope) return "Learning path";

  return String(scope)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status) {
  if (!status) return "Pending";

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
