"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { learningPathApi } from "../../../lib/api";
import NavBar from "../../../components/NavBar";

export default function TopicSelectPage() {
  const router = useRouter();

  const [conceptId, setConceptId] = useState(
    "dbms.normalization"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleStart(e) {
    e.preventDefault();

    if (!conceptId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { learningPath } =
        await learningPathApi.generate({
          scope: "single_topic",
          targetConceptId: conceptId.trim(),
        });

      router.push(
        `/learn/path/${learningPath.learning_path_id}`
      );
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not build your learning path."
      );
      setLoading(false);
    }
  }

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
              maxWidth: 760,
              marginBottom: 48,
            }}
          >
            <div className="marg-page-eyebrow">
              STEP 02 / SINGLE TOPIC
            </div>

            <h1
              style={{
                marginTop: 10,
                fontSize: "clamp(44px, 6vw, 72px)",
              }}
            >
              What do you want
              <br />
              to understand?
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
              Choose a concept and Marg.ai will work backwards
              through its prerequisites before building a focused
              learning path.
            </p>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.35fr) minmax(280px, 0.65fr)",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Topic input */}
            <section className="marg-card">
              <form
                onSubmit={handleStart}
                style={{ padding: 32 }}
              >
                <div className="marg-page-eyebrow">
                  TOPIC INPUT
                </div>

                <h2
                  style={{
                    marginTop: 8,
                    fontSize: 30,
                  }}
                >
                  Choose a concept
                </h2>

                <p
                  style={{
                    marginTop: 10,
                    color: "var(--marg-muted)",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  Enter the concept ID you want to learn.
                  Marg.ai will use the knowledge graph to build
                  the path around it.
                </p>

                <div style={{ marginTop: 32 }}>
                  <label
                    htmlFor="conceptId"
                    className="marg-label"
                  >
                    Concept ID
                  </label>

                  <input
                    id="conceptId"
                    className="marg-input"
                    value={conceptId}
                    onChange={(e) =>
                      setConceptId(e.target.value)
                    }
                    placeholder="e.g. dbms.normalization"
                    disabled={loading}
                    required
                  />

                  <p
                    style={{
                      marginTop: 8,
                      color: "var(--marg-ash)",
                      fontFamily:
                        "JetBrains Mono, monospace",
                      fontSize: 10,
                    }}
                  >
                    Example: dbms.normalization
                  </p>
                </div>

                {error && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: "14px 16px",
                      border:
                        "1px solid rgba(234,40,4,0.25)",
                      background:
                        "rgba(234,40,4,0.06)",
                      borderRadius:
                        "var(--radius-sm)",
                      color:
                        "var(--marg-orange-dark)",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="marg-btn marg-btn-primary"
                  disabled={
                    !conceptId.trim() || loading
                  }
                  style={{
                    width: "100%",
                    minHeight: 50,
                    marginTop: 24,
                    opacity:
                      !conceptId.trim() || loading
                        ? 0.5
                        : 1,
                  }}
                >
                  {loading
                    ? "Building your path..."
                    : "Build my learning path →"}
                </button>
              </form>
            </section>

            {/* Explanation */}
            <aside
              className="marg-card"
              style={{
                background: "var(--marg-dark)",
                color: "#ffffff",
              }}
            >
              <div style={{ padding: 28 }}>
                <div
                  className="marg-page-eyebrow"
                  style={{
                    color: "var(--marg-orange)",
                  }}
                >
                  HOW IT WORKS
                </div>

                <h3
                  style={{
                    color: "#ffffff",
                    marginTop: 10,
                    fontSize: 24,
                  }}
                >
                  Don't start
                  <br />
                  from zero.
                </h3>

                <p
                  style={{
                    marginTop: 14,
                    color:
                      "rgba(255,255,255,0.58)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Marg.ai uses relationships between concepts
                  to understand what you may need before reaching
                  your target.
                </p>

                <div
                  className="marg-code"
                  style={{
                    marginTop: 28,
                    background: "#000000",
                  }}
                >
                  <div
                    style={{
                      color:
                        "rgba(255,255,255,0.45)",
                    }}
                  >
                    TARGET
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      color: "#ffffff",
                    }}
                  >
                    {conceptId ||
                      "your.concept.id"}
                  </div>

                  <div
                    style={{
                      margin: "16px 0",
                      color:
                        "var(--marg-orange)",
                    }}
                  >
                    ↓
                  </div>

                  <div
                    style={{
                      color:
                        "rgba(255,255,255,0.45)",
                    }}
                  >
                    PREREQUISITES
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      color: "#ffffff",
                    }}
                  >
                    knowledge graph
                  </div>

                  <div
                    style={{
                      margin: "16px 0",
                      color:
                        "var(--marg-orange)",
                    }}
                  >
                    ↓
                  </div>

                  <div
                    style={{
                      color:
                        "rgba(255,255,255,0.45)",
                    }}
                  >
                    LEARNING PATH
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Current limitation / examples */}
          <section
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop:
                "1px solid var(--marg-border)",
            }}
          >
            <div className="marg-page-eyebrow">
              SEEDED CONCEPTS
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              <TopicExample
                value="dbms.normalization"
                onSelect={setConceptId}
              />

              <TopicExample
                value="dbms.functional_dependencies"
                onSelect={setConceptId}
              />

              <TopicExample
                value="dbms.candidate_keys"
                onSelect={setConceptId}
              />
            </div>

            <p
              style={{
                marginTop: 12,
                color: "var(--marg-ash)",
                fontSize: 12,
              }}
            >
              These examples use the currently seeded knowledge
              graph. A searchable concept picker can replace this
              input when the concepts endpoint is available.
            </p>
          </section>

          {/* Flow */}
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
              flexWrap: "wrap",
            }}
          >
            <span>01</span>

            <span>Choose mode</span>

            <span>→</span>

            <span
              style={{
                color: "var(--marg-orange)",
              }}
            >
              02
            </span>

            <span>Choose topic</span>

            <span>→</span>

            <span>03</span>

            <span>Assess</span>

            <span>→</span>

            <span>04</span>

            <span>Learn</span>

            <span>→</span>

            <span>05</span>

            <span>Master</span>
          </div>
        </div>
      </main>
    </>
  );
}

function TopicExample({ value, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="marg-tag"
      style={{
        background: "transparent",
        cursor: "pointer",
      }}
    >
      {value}
    </button>
  );
}