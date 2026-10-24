"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "next/navigation";
import { learningPathApi, teachApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

const MODES = [
  { id: "simple", label: "Explain Simply" },
  { id: "detailed", label: "Explain in Detail" },
  { id: "example", label: "Give an Example" },
  { id: "step_by_step", label: "Step-by-Step" },
  { id: "exam_oriented", label: "Exam-Oriented" },
];

function MarkdownContent({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="marg-md-h1">{children}</h1>,
        h2: ({ children }) => <h2 className="marg-md-h2">{children}</h2>,
        h3: ({ children }) => <h3 className="marg-md-h3">{children}</h3>,
        p: ({ children }) => <p className="marg-md-p">{children}</p>,
        ul: ({ children }) => <ul className="marg-md-list">{children}</ul>,
        ol: ({ children }) => <ol className="marg-md-list ordered">{children}</ol>,
        li: ({ children }) => <li className="marg-md-li">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="marg-md-quote">{children}</blockquote>
        ),
        hr: () => <hr className="marg-md-hr" />,
        table: ({ children }) => (
          <div className="marg-md-table-wrap">
            <table className="marg-md-table">{children}</table>
          </div>
        ),
        pre: ({ children }) => <pre className="marg-md-pre">{children}</pre>,
        code: ({ children, className }) => (
          <code className={className || "marg-md-inline-code"}>{children}</code>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {typeof children === "string" ? children : ""}
    </ReactMarkdown>
  );
}

export default function TeachingPage({ params }) {
  const { conceptId } = params;
  const searchParams = useSearchParams();
  const stepId = searchParams.get("stepId");  
  const [explanation, setExplanation] = useState(null);
  const [mode, setMode] = useState("simple");
  const [question, setQuestion] = useState("");
  const [doubtAnswer, setDoubtAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [error, setError] = useState("");

  const conceptName = decodeURIComponent(conceptId)
  .replace(/^generated[._-]+/i, "")
  .replace(/[._-]+/g, " ")
  .replace(/\s+[a-f0-9]{8,}$/i, "")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/\bdbms\b/gi, "DBMS")
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
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          "We couldn't generate the explanation. Please try again."
      );
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
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          "We couldn't answer your question. Please try again."
      );
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
              {MODES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadExplanation(item.id)}
                  disabled={loading}
                  className={`marg-mode-card ${
                    mode === item.id ? "active" : ""
                  }`}
                >
                  <span className="marg-mode-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="marg-mode-label">{item.label}</span>
                  {mode === item.id && (
                    <span className="marg-mode-arrow">↗</span>
                  )}
                </button>
              ))}
            </div>

            {error && <div className="marg-alert marg-alert-error">{error}</div>}

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
              <div className="marg-teach-loading marg-card" aria-live="polite">
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
                    <h2>{MODES.find((item) => item.id === mode)?.label}</h2>
                  </div>
                  <span className="marg-badge">AI GENERATED</span>
                </div>

                <div className="marg-explanation-body marg-markdown">
                  <MarkdownContent>{explanation}</MarkdownContent>
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
                  <div className="marg-doubt-answer-text marg-markdown">
                    <MarkdownContent>{doubtAnswer}</MarkdownContent>
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
               href={`/learn/practice/${encodeURIComponent(conceptId)}${
                stepId ? `?stepId=${encodeURIComponent(stepId)}` : ""
                 }`}
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
                <strong>{MODES.find((item) => item.id === mode)?.label}</strong>
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


<style jsx global>{`
  .marg-markdown {
    color: var(--marg-ink, #202020);
    font-size: 15px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .marg-markdown > :first-child {
    margin-top: 0 !important;
  }

  .marg-markdown > :last-child {
    margin-bottom: 0 !important;
  }

  /* Headings */
  .marg-markdown .marg-md-h1,
  .marg-markdown .marg-md-h2,
  .marg-markdown .marg-md-h3 {
    color: var(--marg-ink, #202020);
    font-weight: 700;
    line-height: 1.3;
    margin: 14px 0 6px !important;
    padding: 0;
  }

  .marg-markdown .marg-md-h1 { font-size: 1.6rem; }

  .marg-markdown .marg-md-h2 {
    font-size: 1.3rem;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--marg-border, #dedbd5);
  }

  .marg-markdown .marg-md-h3 { font-size: 1.08rem; }

  /* Paragraphs */
  .marg-markdown .marg-md-p {
    margin: 0 0 8px !important;
    padding: 0 !important;
    line-height: 1.5;
    white-space: normal;
  }

  /* Lists, including nested lists */
  .marg-markdown .marg-md-list {
    margin: 4px 0 9px !important;
    padding-left: 23px !important;
  }

  .marg-markdown .marg-md-list.ordered {
    list-style: decimal;
  }

  .marg-markdown .marg-md-li {
    margin: 0 0 3px !important;
    padding: 0 0 0 1px !important;
    line-height: 1.45 !important;
  }

  .marg-markdown .marg-md-li::marker {
    color: var(--marg-orange, #ef2b0b);
  }

  .marg-markdown .marg-md-li > p {
    margin: 0 !important;
    line-height: inherit !important;
  }

  .marg-markdown .marg-md-li .marg-md-list {
    margin: 4px 0 5px !important;
    padding-left: 20px !important;
  }

  /* Blockquotes and dividers */
  .marg-markdown .marg-md-quote {
    margin: 10px 0 !important;
    padding: 10px 14px;
    border-left: 3px solid var(--marg-orange, #ef2b0b);
    background: var(--marg-soft, #f3f0e9);
    color: var(--marg-muted, #686868);
  }

  .marg-markdown .marg-md-hr {
    border: 0;
    border-top: 1px solid var(--marg-border, #dedbd5);
    margin: 10px 0 !important;
  }

  /* Tables */
  .marg-markdown .marg-md-table-wrap {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    margin: 8px 0 12px !important;
    -webkit-overflow-scrolling: touch;
  }

  .marg-markdown .marg-md-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 13px;
    line-height: 1.4;
  }

  .marg-markdown .marg-md-table th,
  .marg-markdown .marg-md-table td {
    padding: 7px 9px !important;
    border: 1px solid var(--marg-border, #dedbd5);
    text-align: left;
    vertical-align: top;
    line-height: 1.4 !important;
    overflow-wrap: anywhere;
    word-break: normal;
  }

  /* Two-column tables: reserve more width for descriptions */
  .marg-markdown .marg-md-table th:first-child,
  .marg-markdown .marg-md-table td:first-child {
    width: 32%;
  }

  .marg-markdown .marg-md-table th:nth-child(2),
  .marg-markdown .marg-md-table td:nth-child(2) {
    width: 68%;
  }

  .marg-markdown .marg-md-table th {
    background: var(--marg-soft, #f3f0e9);
    font-weight: 700;
  }

  .marg-markdown .marg-md-table p {
    margin: 0 !important;
  }

  /* Code */
  .marg-markdown .marg-md-inline-code {
    padding: 0.12em 0.35em;
    border-radius: 4px;
    background: var(--marg-soft, #f3f0e9);
    font-size: 0.9em;
  }

  .marg-markdown .marg-md-pre {
    overflow-x: auto;
    padding: 1rem;
    border-radius: 8px;
    background: #202020;
    color: #f7f7f7;
    line-height: 1.6;
  }

  .marg-markdown a {
    color: var(--marg-orange, #ef2b0b);
    text-decoration: underline;
  }

  .marg-markdown strong { font-weight: 700; }
  .marg-markdown em { font-style: italic; }

  /* Mobile */
  @media (max-width: 640px) {
    .marg-markdown { font-size: 14px; }

    .marg-markdown .marg-md-h1 { font-size: 1.4rem; }
    .marg-markdown .marg-md-h2 { font-size: 1.2rem; }
    .marg-markdown .marg-md-h3 { font-size: 1rem; }

    .marg-markdown .marg-md-table {
      font-size: 12px;
    }

    .marg-markdown .marg-md-table th,
    .marg-markdown .marg-md-table td {
      padding: 6px !important;
    }
  }
`}</style>
</>
);
}
