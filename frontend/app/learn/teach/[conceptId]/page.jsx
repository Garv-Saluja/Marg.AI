"use client";

import { useState } from "react";
import { teachApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

const MODES = [
  { id: "simple", label: "Explain Simply" },
  { id: "detailed", label: "Explain in Detail" },
  { id: "example", label: "Give an Example" },
  { id: "step_by_step", label: "Step-by-Step" },
  { id: "exam_oriented", label: "Exam-Oriented" },
];

export default function TeachingPage({ params }) {
  const { conceptId } = params;

  const [explanation, setExplanation] = useState(null);
  const [mode, setMode] = useState("simple");
  const [question, setQuestion] = useState("");
  const [doubtAnswer, setDoubtAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [error, setError] = useState("");

  const conceptName = conceptId
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  async function loadExplanation(selectedMode) {
    setMode(selectedMode);
    setLoading(true);
    setError("");

    try {
      const result = await teachApi.explain({
        conceptId,
        explanationMode: selectedMode,
      });

      setExplanation(result.text);
    } catch (err) {
      setError("We couldn't generate the explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function askDoubt(e) {
    e.preventDefault();

    if (!question.trim()) return;

    setDoubtLoading(true);
    setError("");

    try {
      const result = await teachApi.ask({
        conceptId,
        question: question.trim(),
      });

      setDoubtAnswer(result.text);
    } catch (err) {
      setError("We couldn't answer your question. Please try again.");
    } finally {
      setDoubtLoading(false);
    }
  }

  return (
    <>
      <NavBar />

      <main className="marg-container marg-page">
        <div className="marg-teach-layout">
          <section className="marg-teach-main">
            <div className="marg-eyebrow">LEARNING / EXPLANATION</div>

            <h1 className="marg-page-title">{conceptName}</h1>

            <p className="marg-page-subtitle">
              Learn this concept at your own pace. Choose how you want Marg.ai
              to explain it.
            </p>

            <div className="marg-mode-grid">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadExplanation(item.id)}
                  className={`marg-mode-card ${
                    mode === item.id ? "active" : ""
                  }`}
                >
                  <span className="marg-mode-index">
                    {String(MODES.indexOf(item) + 1).padStart(2, "0")}
                  </span>

                  <span className="marg-mode-label">{item.label}</span>

                  {mode === item.id && (
                    <span className="marg-mode-arrow">↗</span>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="marg-alert marg-alert-error">
                {error}
              </div>
            )}

            {!explanation && !loading && (
              <div className="marg-teach-intro marg-card">
                <div className="marg-teach-intro-mark">AI</div>

                <div>
                  <div className="marg-card-kicker">READY TO LEARN</div>
                  <h2>Start with a simple explanation.</h2>
                  <p>
                    Marg.ai will explain the concept based on your selected
                    learning mode.
                  </p>

                  <button
                    type="button"
                    className="marg-btn marg-btn-primary"
                    onClick={() => loadExplanation("simple")}
                  >
                    Start explanation →
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="marg-teach-loading marg-card">
                <div className="marg-loading-line" />
                <div className="marg-loading-line short" />
                <div className="marg-loading-line" />
                <p>Marg.ai is preparing your explanation...</p>
              </div>
            )}

            {explanation && !loading && (
              <article className="marg-explanation">
                <div className="marg-explanation-header">
                  <div>
                    <div className="marg-card-kicker">EXPLANATION</div>
                    <h2>
                      {MODES.find((item) => item.id === mode)?.label}
                    </h2>
                  </div>

                  <span className="marg-badge">AI GENERATED</span>
                </div>

                <div className="marg-explanation-body">
                  {explanation}
                </div>
              </article>
            )}

            <section className="marg-doubt-section">
              <div className="marg-section-heading">
                <div>
                  <div className="marg-card-kicker">STUCK?</div>
                  <h2>Ask a doubt.</h2>
                </div>

                <span className="marg-section-number">02</span>
              </div>

              <p className="marg-section-description">
                Ask Marg.ai anything about this concept and get an explanation
                tailored to your question.
              </p>

              <form onSubmit={askDoubt} className="marg-doubt-form">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask anything about this concept..."
                  rows={4}
                />

                <div className="marg-form-footer">
                  <span className="marg-form-hint">
                    Be specific for a more useful explanation.
                  </span>

                  <button
                    type="submit"
                    className="marg-btn marg-btn-dark"
                    disabled={doubtLoading || !question.trim()}
                  >
                    {doubtLoading ? "Thinking..." : "Ask Marg.ai →"}
                  </button>
                </div>
              </form>

              {doubtAnswer && (
                <div className="marg-doubt-answer">
                  <div className="marg-card-kicker">ANSWER</div>
                  <div className="marg-doubt-answer-text">
                    {doubtAnswer}
                  </div>
                </div>
              )}
            </section>

            <div className="marg-practice-cta">
              <div>
                <div className="marg-card-kicker">NEXT STEP</div>
                <h2>Ready to test what you learned?</h2>
                <p>
                  Move from explanation to practice and check your understanding.
                </p>
              </div>

              <a
                href={`/learn/practice/${conceptId}`}
                className="marg-btn marg-btn-primary"
              >
                Start practice →
              </a>
            </div>
          </section>

          <aside className="marg-teach-sidebar">
            <div className="marg-dark-card">
              <div className="marg-card-kicker light">CURRENT CONCEPT</div>

              <div className="marg-sidebar-concept">{conceptName}</div>

              <div className="marg-sidebar-divider" />

              <div className="marg-sidebar-row">
                <span>Mode</span>
                <strong>
                  {MODES.find((item) => item.id === mode)?.label}
                </strong>
              </div>

              <div className="marg-sidebar-row">
                <span>Status</span>
                <strong>{explanation ? "Learning" : "Not started"}</strong>
              </div>
            </div>

            <div className="marg-process-card">
              <div className="marg-card-kicker">YOUR FLOW</div>

              <div className="marg-process-step complete">
                <span>01</span>
                <div>
                  <strong>Understand</strong>
                  <small>Explore the concept</small>
                </div>
              </div>

              <div className="marg-process-line" />

              <div className="marg-process-step active">
                <span>02</span>
                <div>
                  <strong>Learn</strong>
                  <small>Ask, explain, understand</small>
                </div>
              </div>

              <div className="marg-process-line" />

              <div className="marg-process-step">
                <span>03</span>
                <div>
                  <strong>Practice</strong>
                  <small>Test your understanding</small>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}