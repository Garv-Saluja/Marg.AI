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

  const currentStep = steps.find(
    (step) =>
      step.status === "in_progress" ||
      step.status === "active"
  );

  const progress =
    steps.length > 0
      ? Math.round(
          (completedSteps / steps.length) * 100
        )
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

                    {currentStep.reason && (
                      <p
                        style={{
                          marginTop: 8,
                          color: "var(--marg-muted)",
                          fontSize: 14,
                        }}
                      >
                        {currentStep.reason}
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

          {/* Learning sequence */}
          <section>
            <div style={{ marginBottom: 24 }}>
              <div className="marg-page-eyebrow">
                LEARNING SEQUENCE
              </div>

              <h2
                style={{
                  marginTop: 8,
                  fontSize: 36,
                }}
              >
                Your concepts.
              </h2>

              <p
                style={{
                  marginTop: 8,
                  color: "var(--marg-muted)",
                }}
              >
                Work through each concept in sequence.
              </p>
            </div>

            <div className="marg-path">
              {steps.map((step, index) => {
                const completed =
                  step.status === "completed";

                const active =
                  step.status === "in_progress" ||
                  step.status === "active";

                const locked =
                  !completed &&
                  !active &&
                  index >
                    steps.findIndex(
                      (item) =>
                        item.status ===
                          "in_progress" ||
                        item.status === "active"
                    );

                return (
                  <div
                    key={step.step_id}
                    className="marg-path-step"
                  >
                    <div
                      className={`marg-path-number ${
                        active
                          ? "marg-path-number-active"
                          : ""
                      }`}
                      style={{
                        background: completed
                          ? "var(--marg-ink)"
                          : active
                            ? "var(--marg-orange)"
                            : "var(--marg-canvas)",
                        borderColor:
                          completed ||
                          active
                            ? completed
                              ? "var(--marg-ink)"
                              : "var(--marg-orange)"
                            : "var(--marg-border-strong)",
                        color:
                          completed || active
                            ? "#ffffff"
                            : "var(--marg-ink)",
                      }}
                    >
                      {completed
                        ? "✓"
                        : String(index + 1).padStart(
                            2,
                            "0"
                          )}
                    </div>

                    <div className="marg-path-content">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                          gap: 16,
                        }}
                      >
                        <div
                          className="marg-path-title"
                          style={{
                            color: locked
                              ? "var(--marg-ash)"
                              : "var(--marg-ink)",
                          }}
                        >
                          {step.concept_label}
                        </div>

                        {completed && (
                          <span className="marg-tag marg-tag-success">
                            COMPLETED
                          </span>
                        )}

                        {active && (
                          <span className="marg-tag marg-tag-orange">
                            CURRENT
                          </span>
                        )}
                      </div>

                      {step.reason && (
                        <div className="marg-path-description">
                          {step.reason}
                        </div>
                      )}

                      {!locked && !completed && (
                        <a
                          href={`/learn/teach/${step.concept_id}?stepId=${step.step_id}`}
                          className="marg-btn marg-btn-outline"
                          style={{
                            marginTop: 14,
                            minHeight: 36,
                            padding: "0 12px",
                            fontSize: 12,
                          }}
                        >
                          Learn this →
                        </a>
                      )}

                      {completed && (
                        <div
                          style={{
                            marginTop: 10,
                            color: "var(--marg-muted)",
                            fontSize: 12,
                            fontFamily:
                              "JetBrains Mono, monospace",
                          }}
                        >
                          Mastery recorded
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

            {currentStep && (
              <a
                href={`/learn/teach/${currentStep.concept_id}?stepId=${currentStep.step_id}`}
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