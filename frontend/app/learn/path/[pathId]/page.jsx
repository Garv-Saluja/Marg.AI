"use client";

import { useEffect, useState } from "react";
import { learningPathApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

export default function LearningPathPage({ params }) {
  const { pathId } = params;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    learningPathApi
      .get(pathId)
      .then(setData)
      .catch(() => {
        setError("Unable to load your learning path.");
      });
  }, [pathId]);

  if (error) {
    return (
      <>
        <NavBar />

        <main className="marg-dashboard">
          <div
            className="marg-container"
            style={{
              paddingTop: 64,
              paddingBottom: 96,
            }}
          >
            <div className="marg-empty">
              <div className="marg-empty-title">
                Something went wrong
              </div>

              <p className="marg-empty-description">
                {error}
              </p>

              <a
                href="/learn/mode"
                className="marg-btn marg-btn-primary"
                style={{ marginTop: 24 }}
              >
                Start again
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <NavBar />

        <main className="marg-dashboard">
          <div
            className="marg-container"
            style={{
              paddingTop: 64,
            }}
          >
            <div className="marg-loading">
              <span className="marg-spinner" />
              Loading your learning path...
            </div>
          </div>
        </main>
      </>
    );
  }

  const steps = data.steps || [];

  const completedSteps = steps.filter(
    (step) => step.status === "completed"
  ).length;

  // The API returns steps in prerequisite-safe order. Until the API exposes
  // explicit dependency IDs, unlock only the first incomplete step.
  const firstIncompleteIndex = steps.findIndex(
    (step) => step.status !== "completed"
  );

  const currentStep =
    firstIncompleteIndex >= 0 ? steps[firstIncompleteIndex] : null;

  const progress =
    steps.length > 0
      ? Math.round((completedSteps / steps.length) * 100)
      : 0;

  return (
    <>
      <NavBar />

      <main className="marg-dashboard">
        <div
          className="marg-container"
          style={{
            paddingTop: 64,
            paddingBottom: 96,
          }}
        >
          {/* Header */}
          <header
            style={{
              maxWidth: 820,
              marginBottom: 48,
            }}
          >
            <div className="marg-page-eyebrow">
              PERSONALIZED PATH
            </div>

            <h1
              style={{
                marginTop: 10,
                fontSize: "clamp(44px, 6vw, 72px)",
              }}
            >
              Your path
              <br />
              is ready.
            </h1>

            <p
              style={{
                maxWidth: 620,
                marginTop: 20,
                color: "var(--marg-muted)",
                fontSize: 18,
                lineHeight: 1.6,
              }}
            >
              Marg.ai has arranged the concepts into a sequence
              designed around what you need to learn.
            </p>
          </header>

          {/* Progress overview */}
          <section
            className="marg-card"
            style={{
              marginBottom: 48,
            }}
          >
            <div
              style={{
                padding: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 32,
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="marg-page-eyebrow">
                  PATH PROGRESS
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 36,
                      lineHeight: 1,
                      fontWeight: 600,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {progress}%
                  </span>

                  <span
                    style={{
                      color: "var(--marg-muted)",
                      fontSize: 13,
                    }}
                  >
                    {completedSteps} of {steps.length} completed
                  </span>
                </div>

                <div
                  className="marg-progress"
                  style={{
                    marginTop: 18,
                  }}
                >
                  <div
                    className="marg-progress-bar"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  minWidth: 110,
                  textAlign: "right",
                }}
              >
                <div className="marg-stat-label">
                  CONCEPTS
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 28,
                    fontWeight: 600,
                  }}
                >
                  {steps.length}
                </div>
              </div>
            </div>
          </section>

          {/* Current concept */}
          {currentStep && (
            <section
              style={{
                marginBottom: 48,
              }}
            >
              <div className="marg-page-eyebrow">
                UP NEXT
              </div>

              <div
                className="marg-card"
                style={{
                  marginTop: 12,
                  borderColor: "var(--marg-orange)",
                }}
              >
                <div
                  style={{
                    padding: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 24,
                  }}
                >
                  <div>
                    <span className="marg-tag marg-tag-orange">
                      CURRENT CONCEPT
                    </span>

                    <h2
                      style={{
                        marginTop: 14,
                        fontSize: 30,
                      }}
                    >
                      {currentStep.concept_label}
                    </h2>

                    {currentStep.reason && currentStep.reason !== "syllabus_concept" && (
                      <p
                        style={{
                          marginTop: 8,
                          color: "var(--marg-muted)",
                          fontSize: 14,
                        }}
                      >
                        {currentStep.reason === "quick_revision"
                          ? "Quick revision"
                          : currentStep.reason === "missing_prerequisite"
                            ? "Prerequisite to learn"
                            : currentStep.reason}
                      </p>
                    )}
                  </div>

                  <a
                    href={`/learn/teach/${currentStep.concept_id}?stepId=${currentStep.step_id}`}
                    className="marg-btn marg-btn-primary"
                  >
                    Start learning →
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* Branching skill tree */}
          <section>
            <div style={{ marginBottom: 28 }}>
              <div className="marg-page-eyebrow">LEARNING SEQUENCE</div>
              <h2 style={{ marginTop: 8, fontSize: 36 }}>Your skill tree.</h2>
              <p style={{ marginTop: 8, color: "var(--marg-muted)", maxWidth: 620 }}>
                Complete the available concept to unlock the next step. Locked concepts open as you progress.
              </p>
            </div>

            {steps.length === 0 ? (
              <div className="marg-card" style={{ padding: 24 }}>
                No concepts were found for this learning path. Try generating the path again.
              </div>
            ) : (
              <div style={{
                position: "relative",
                padding: "28px 12px 36px",
                border: "1px solid var(--marg-border)",
                borderRadius: 20,
                background: "var(--marg-card, var(--marg-canvas))",
                overflow: "hidden",
              }}>
                <div style={{
                  display: "flex", justifyContent: "center", marginBottom: 28,
                }}>
                  <div style={{
                    padding: "10px 18px", borderRadius: 999,
                    background: "var(--marg-ink)", color: "#fff",
                    fontSize: 12, fontWeight: 700, letterSpacing: ".08em",
                  }}>START YOUR JOURNEY</div>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
                  gap: "30px 22px",
                  alignItems: "stretch",
                }}>
                  {steps.map((step, index) => {
                    const completed = step.status === "completed";
                    const isFirstIncomplete = index === firstIncompleteIndex;
                    const active = !completed && isFirstIncomplete;
                    const locked = !completed && !active;
                    const conceptId = step.concept_id ?? step.conceptId;
                    const stepId = step.step_id ?? step.stepId;
                    const canNavigate = !locked && Boolean(conceptId && stepId);

                    return (
                      <article
                        key={step.step_id ?? step.stepId ?? `${conceptId}-${index}`}
                        style={{
                          position: "relative",
                          minWidth: 0,
                          border: `1px solid ${active ? "var(--marg-orange)" : completed ? "var(--marg-ink)" : "var(--marg-border-strong)"}`,
                          borderRadius: 16,
                          padding: 18,
                          background: completed
                            ? "var(--marg-ink)"
                            : active
                              ? "var(--marg-canvas)"
                              : "var(--marg-card, var(--marg-canvas))",
                          color: completed ? "#fff" : "var(--marg-ink)",
                          opacity: locked ? 0.72 : 1,
                          boxShadow: active ? "0 0 0 3px rgba(231, 57, 22, 0.10)" : "none",
                        }}
                      >
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                          marginBottom: 14,
                        }}>
                          <div style={{
                            width: 38, height: 38, flexShrink: 0, borderRadius: "50%",
                            display: "grid", placeItems: "center",
                            border: `1px solid ${completed ? "rgba(255,255,255,.5)" : active ? "var(--marg-orange)" : "var(--marg-border-strong)"}`,
                            background: active ? "var(--marg-orange)" : "transparent",
                            color: active ? "#fff" : completed ? "#fff" : "var(--marg-ink)",
                            fontSize: 12, fontWeight: 700,
                          }}>
                            {completed ? "✓" : locked ? "🔒" : String(index + 1).padStart(2, "0")}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                            color: completed ? "#d7f7df" : active ? "var(--marg-orange)" : "var(--marg-muted)",
                          }}>
                            {completed ? "COMPLETED" : active ? "AVAILABLE NOW" : "LOCKED"}
                          </span>
                        </div>

                        <h3 style={{
                          fontSize: 17, lineHeight: 1.4, fontWeight: 650,
                          overflowWrap: "anywhere",
                        }}>{step.concept_label ?? step.conceptLabel ?? "Untitled concept"}</h3>

                        {step.reason && step.reason !== "syllabus_concept" && (
                          <p style={{
                            marginTop: 8, fontSize: 12, lineHeight: 1.5,
                            color: completed ? "rgba(255,255,255,.75)" : "var(--marg-muted)",
                          }}>
                            {step.reason === "quick_revision"
                              ? "Quick revision"
                              : step.reason === "missing_prerequisite"
                                ? "Prerequisite concept"
                                : step.reason}
                          </p>
                        )}

                        {canNavigate && !completed && (
                          <a
                            href={`/learn/teach/${encodeURIComponent(conceptId)}?stepId=${encodeURIComponent(stepId)}`}
                            className={`marg-btn ${active ? "marg-btn-primary" : "marg-btn-outline"}`}
                            style={{ marginTop: 16, width: "100%", minHeight: 40, fontSize: 12, justifyContent: "center" }}
                          >
                            {step.status === "in_progress" || step.status === "active" ? "Continue learning →" : "Start learning →"}
                          </a>
                        )}

                        {locked && !completed && (
                          <div style={{ marginTop: 16, fontSize: 12, color: "var(--marg-muted)" }}>
                            Complete the earlier step to unlock this concept.
                          </div>
                        )}

                        {completed && (
                          <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,.75)" }}>
                            Mastery recorded
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Bottom navigation */}
          <section
            style={{
              marginTop: 64,
              paddingTop: 24,
              borderTop:
                "1px solid var(--marg-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
            }}
          >
            <a
              href="/learn/mode"
              className="marg-btn marg-btn-outline"
            >
              ← New learning path
            </a>

            {currentStep && (currentStep.concept_id ?? currentStep.conceptId) && (currentStep.step_id ?? currentStep.stepId) && (
              <a
                href={`/learn/teach/${encodeURIComponent(currentStep.concept_id ?? currentStep.conceptId)}?stepId=${encodeURIComponent(currentStep.step_id ?? currentStep.stepId)}`}
                className="marg-btn marg-btn-primary"
              >
                Continue →
              </a>
            )}
          </section>
        </div>
      </main>
    </>
  );
}