
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { practiceApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

export default function PracticePage({ params }) {
  const { conceptId } = params;
  const searchParams = useSearchParams();
  const stepId = searchParams.get("stepId");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");

        const result = await practiceApi.questions({
          conceptId,
          count: 5,
        });

        if (!cancelled) {
          setQuestions(
            Array.isArray(result?.questions) ? result.questions : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.error ||
              "We couldn't load the practice questions. Please try again."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [conceptId]);


const conceptName = formatConceptLabel(conceptId);

function formatConceptLabel(id) {
  if (!id) return "Unknown concept";

  const value = decodeURIComponent(String(id))
    .replace(/^generated[._-]+/i, "")
    .replace(/[\s._-]*[a-f0-9]{8,}$/i, "")
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
      words.slice(1).map(capitalizeWord).join(" ")
    );
  }

  return words
    .map((word) => specialLabels[word.toLowerCase()] || capitalizeWord(word))
    .join(" ");
}

function capitalizeWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}


  const question = questions[current];

  function normalizeAnswer(value) {
    return String(value ?? "").trim();
  }

  async function submitAnswer() {
    if (!question || selected == null || submitting || feedback) return;

    const isCorrect =
      normalizeAnswer(selected) ===
      normalizeAnswer(question.correct_answer);

    setFeedback({
      correct: isCorrect,
      text: isCorrect
        ? "Correct! You understood this one."
        : `Not quite. The correct answer is ${
            question.options?.find(
              (option) =>
                normalizeAnswer(option.id) ===
                normalizeAnswer(question.correct_answer)
            )?.text ?? question.correct_answer
          }.`,
    });

    setSubmitting(true);

    try {
      await practiceApi.attempt({
        conceptId,
        questionId: question.question_id,
        studentAnswer: selected,
        isCorrect,
      });
    } catch (err) {
      // Attempt logging should not interrupt practice.
      console.error("Could not record practice attempt:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    setSelected(null);
    setFeedback(null);
    setCurrent((value) => value + 1);
  }

  const pageStyles = `
    .practice-page {
      width: 100%;
      max-width: 1440px;
      margin: 0 auto;
      padding: 36px 28px 64px;
      color: #202020;
    }

    .practice-eyebrow {
      color: #77716a;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .practice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      margin-bottom: 24px;
    }

    .practice-title {
      margin: 10px 0 0;
      font-size: clamp(30px, 4vw, 48px);
      line-height: 1.12;
      letter-spacing: -1.5px;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .practice-count {
      flex-shrink: 0;
      font-size: 15px;
      color: #6d6964;
      padding-bottom: 5px;
    }

    .practice-count strong {
      color: #ed2b0b;
      font-weight: 700;
    }

    .practice-progress {
      height: 5px;
      background: #e8e4de;
      overflow: hidden;
      margin-bottom: 28px;
    }

    .practice-progress-fill {
      height: 100%;
      background: #ed2b0b;
      transition: width 200ms ease;
    }

    .practice-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 290px;
      gap: 24px;
      align-items: start;
    }

    .practice-question-card {
      min-width: 0;
      padding: 30px;
      background: #fff;
      border: 1px solid #dedbd5;
    }

    .practice-question-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding-bottom: 18px;
      border-bottom: 1px solid #e5e1db;
    }

    .practice-question-number {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #ed2b0b;
      text-transform: uppercase;
    }

    .practice-question-concept {
      font-size: 12px;
      color: #77716a;
    }

    .practice-question-title {
      margin: 25px 0 26px;
      max-width: 850px;
      font-size: clamp(22px, 2.3vw, 30px);
      line-height: 1.35;
      letter-spacing: -0.6px;
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .practice-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .practice-option {
      display: flex;
      align-items: flex-start;
      gap: 13px;
      width: 100%;
      min-width: 0;
      min-height: 76px;
      padding: 16px;
      border: 1px solid #dedbd5;
      background: #fff;
      color: #202020;
      text-align: left;
      cursor: pointer;
      transition: border-color 150ms ease, background 150ms ease;
      font: inherit;
    }

    .practice-option:hover:not(:disabled) {
      border-color: #ed2b0b;
      background: #fffaf8;
    }

    .practice-option.selected {
      border: 1.5px solid #ed2b0b;
      background: #fff3ef;
    }

    .practice-option.correct {
      border-color: #21834a;
      background: #eff9f1;
    }

    .practice-option.wrong {
      border-color: #c73535;
      background: #fff1f1;
    }

    .practice-option:disabled {
      cursor: default;
    }

    .practice-option-letter {
      display: flex;
      flex: 0 0 30px;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      border: 1px solid #d9d5cf;
      background: #faf9f6;
      font-size: 12px;
      font-weight: 700;
    }

    .practice-option.selected .practice-option-letter {
      border-color: #ed2b0b;
      color: #ed2b0b;
    }

    .practice-option-text {
      flex: 1;
      min-width: 0;
      padding-top: 4px;
      font-size: 14px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .practice-option-status {
      font-weight: 800;
      font-size: 18px;
    }

    .practice-question-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e8e4de;
    }

    .practice-helper {
      color: #77716a;
      font-size: 13px;
      line-height: 1.5;
    }

    .practice-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 12px 18px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: background 150ms ease, opacity 150ms ease;
    }

    .practice-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .practice-btn-primary {
      color: #fff;
      background: #ed2b0b;
    }

    .practice-btn-primary:hover:not(:disabled) {
      background: #d92307;
    }

    .practice-btn-dark {
      color: #fff;
      background: #202020;
    }

    .practice-btn-outline {
      color: #202020;
      background: #fff;
      border-color: #d8d3cc;
    }

    .practice-feedback {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 24px;
      padding: 18px;
      border: 1px solid #d9d5cf;
    }

    .practice-feedback.correct {
      background: #eff9f1;
      border-color: #b9dfc3;
    }

    .practice-feedback.incorrect {
      background: #fff4f1;
      border-color: #efc8bd;
    }

    .practice-feedback strong {
      font-size: 15px;
    }

    .practice-feedback p {
      margin: 6px 0 0;
      font-size: 13px;
      line-height: 1.6;
    }

    .practice-sidebar {
      display: grid;
      gap: 18px;
    }

    .practice-session-card {
      padding: 24px;
      background: #202020;
      color: #fff;
    }

    .practice-session-number {
      margin-top: 12px;
      font-size: 34px;
      line-height: 1;
      font-weight: 700;
    }

    .practice-session-caption {
      margin: 10px 0 0;
      color: #c2beb8;
      font-size: 12px;
    }

    .practice-sidebar-divider {
      height: 1px;
      margin: 24px 0;
      background: #454545;
    }

    .practice-sidebar-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-top: 18px;
      font-size: 12px;
    }

    .practice-sidebar-row span {
      color: #b7b1aa;
    }

    .practice-sidebar-row strong {
      max-width: 65%;
      text-align: right;
      overflow-wrap: anywhere;
    }

    .practice-tip {
      padding: 22px;
      border: 1px solid #dedbd5;
      background: #fff;
    }

    .practice-tip p {
      margin: 10px 0 0;
      color: #68635d;
      font-size: 13px;
      line-height: 1.7;
    }

    .practice-state {
      max-width: 760px;
      margin: 35px auto;
      padding: 32px;
      border: 1px solid #dedbd5;
      background: #fff;
    }

    .practice-state h1 {
      margin: 12px 0;
      font-size: clamp(25px, 4vw, 36px);
      line-height: 1.2;
    }

    .practice-state p {
      color: #68635d;
      line-height: 1.7;
    }

    .practice-error {
      color: #a72525;
      background: #fff1f1;
      border: 1px solid #e9c4c4;
      padding: 15px 18px;
      line-height: 1.6;
    }

    .practice-skeleton {
      height: 10px;
      max-width: 450px;
      margin-top: 20px;
      background: #e8e4de;
    }

    .practice-skeleton.short {
      max-width: 250px;
    }

    .practice-complete-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }

    @media (max-width: 900px) {
      .practice-layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .practice-sidebar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 600px) {
      .practice-page {
        padding: 25px 16px 40px;
      }

      .practice-header {
        align-items: flex-start;
      }

      .practice-title {
        font-size: 32px;
        letter-spacing: -0.8px;
      }

      .practice-question-card {
        padding: 20px 16px;
      }

      .practice-question-title {
        font-size: 23px;
        margin: 22px 0;
      }

      .practice-options {
        grid-template-columns: minmax(0, 1fr);
      }

      .practice-option {
        min-height: 64px;
        padding: 13px;
      }

      .practice-question-footer {
        align-items: stretch;
      }

      .practice-question-footer .practice-btn {
        width: 100%;
      }

      .practice-sidebar {
        grid-template-columns: minmax(0, 1fr);
      }

      .practice-feedback {
        flex-direction: column;
      }

      .practice-state {
        padding: 22px;
      }
    }
  `;

  if (loading) {
    return (
      <>
        <NavBar />
        <style jsx global>{pageStyles}</style>
        <main className="practice-page">
          <div className="practice-state">
            <div className="practice-eyebrow">PRACTICE</div>
            <h1>Preparing your questions...</h1>
            <div className="practice-skeleton" />
            <div className="practice-skeleton short" />
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar />
        <style jsx global>{pageStyles}</style>
        <main className="practice-page">
          <div className="practice-state">
            <div className="practice-error">{error}</div>
            <div style={{ marginTop: 20 }}>
              <a
                href={`/learn/teach/${encodeURIComponent(conceptId)}`}
                className="practice-btn practice-btn-outline"
              >
                Back to learning
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (questions.length === 0) {
    return (
      <>
        <NavBar />
        <style jsx global>{pageStyles}</style>
        <main className="practice-page">
          <div className="practice-state">
            <div className="practice-eyebrow">PRACTICE</div>
            <h1>No questions available yet.</h1>
            <p>
              There aren't any practice questions available for this concept
              right now.
            </p>
            <a
              href={`/learn/teach/${encodeURIComponent(conceptId)}`}
              className="practice-btn practice-btn-dark"
            >
              Back to learning →
            </a>
          </div>
        </main>
      </>
    );
  }

  if (current >= questions.length) {
    return (
      <>
        <NavBar />
        <style jsx global>{pageStyles}</style>
        <main className="practice-page">
          <div className="practice-layout">
            <section className="practice-state">
              <div className="practice-eyebrow">PRACTICE / COMPLETE</div>
              <h1>Practice complete.</h1>
              <p>
                You've worked through the practice questions for{" "}
                <strong>{conceptName}</strong>.
              </p>

              <div className="practice-complete-actions">
                <a
                  href={`/learn/assessment/new?conceptId=${encodeURIComponent(
                    conceptId
                  )}&type=reassessment${
                    stepId ? `&stepId=${encodeURIComponent(stepId)}` : ""
                  }`}
                  className="practice-btn practice-btn-primary"
                >
                  Take assessment →
                </a>

                <a
                  href={`/learn/teach/${encodeURIComponent(conceptId)}`}
                  className="practice-btn practice-btn-outline"
                >
                  Review concept
                </a>
              </div>
            </section>

            <aside className="practice-tip">
              <div className="practice-eyebrow">NEXT</div>
              <h2>Confirm your mastery.</h2>
              <p>
                Take a quick reassessment to check how well you've understood
                the concept.
              </p>
            </aside>
          </div>
        </main>
      </>
    );
  }

  const progress = ((current + 1) / questions.length) * 100;

  return (
    <>
      <NavBar />
      <style jsx global>{pageStyles}</style>

      <main className="practice-page">
        <header className="practice-header">
          <div>
            <div className="practice-eyebrow">LEARNING / PRACTICE</div>
            <h1 className="practice-title">{conceptName}</h1>
          </div>

          <div className="practice-count">
            <strong>{String(current + 1).padStart(2, "0")}</strong>
            {" / "}
            {String(questions.length).padStart(2, "0")}
          </div>
        </header>

        <div
          className="practice-progress"
          role="progressbar"
          aria-label="Practice progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="practice-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="practice-layout">
          <section className="practice-question-card">
            <div className="practice-question-meta">
              <span className="practice-question-number">
                Question {String(current + 1).padStart(2, "0")}
              </span>
              <span className="practice-question-concept">{conceptName}</span>
            </div>

            <h2 className="practice-question-title">{question.body}</h2>

            <div className="practice-options">
              {(question.options || []).map((option, index) => {
                const isSelected =
                  normalizeAnswer(selected) === normalizeAnswer(option.id);

                const isCorrect =
                  !!feedback &&
                  normalizeAnswer(option.id) ===
                    normalizeAnswer(question.correct_answer);

                const isWrong =
                  !!feedback && isSelected && !isCorrect;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      "practice-option",
                      isSelected ? "selected" : "",
                      isCorrect ? "correct" : "",
                      isWrong ? "wrong" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => !feedback && setSelected(option.id)}
                    disabled={!!feedback}
                    aria-pressed={isSelected}
                  >
                    <span className="practice-option-letter">
                      {String.fromCharCode(65 + index)}
                    </span>

                    <span className="practice-option-text">{option.text}</span>

                    {isCorrect && (
                      <span className="practice-option-status">✓</span>
                    )}

                    {isWrong && (
                      <span className="practice-option-status">×</span>
                    )}
                  </button>
                );
              })}
            </div>

            {!feedback ? (
              <div className="practice-question-footer">
                <span className="practice-helper">
                  Select one answer to continue.
                </span>

                <button
                  type="button"
                  className="practice-btn practice-btn-primary"
                  onClick={submitAnswer}
                  disabled={selected == null || submitting}
                >
                  {submitting ? "Checking..." : "Check answer →"}
                </button>
              </div>
            ) : (
              <div
                className={`practice-feedback ${
                  feedback.correct ? "correct" : "incorrect"
                }`}
                aria-live="polite"
              >
                <div>
                  <strong>
                    {feedback.correct ? "Correct!" : "Not quite"}
                  </strong>
                  <p>{feedback.text}</p>
                </div>

                <button
                  type="button"
                  className="practice-btn practice-btn-dark"
                  onClick={nextQuestion}
                >
                  {current + 1 === questions.length
                    ? "Finish practice →"
                    : "Next question →"}
                </button>
              </div>
            )}
          </section>

          <aside className="practice-sidebar">
            <section className="practice-session-card">
              <div className="practice-eyebrow" style={{ color: "#c5bdb3" }}>
                PRACTICE SESSION
              </div>

              <div className="practice-session-number">
                {String(current + 1).padStart(2, "0")}
              </div>

              <p className="practice-session-caption">
                Question {current + 1} of {questions.length}
              </p>

              <div className="practice-sidebar-divider" />

              <div className="practice-sidebar-row">
                <span>Concept</span>
                <strong>{conceptName}</strong>
              </div>

              <div className="practice-sidebar-row">
                <span>Progress</span>
                <strong>{Math.round(progress)}%</strong>
              </div>
            </section>

            <section className="practice-tip">
              <div className="practice-eyebrow">TIP</div>
              <p>
                Think through the concept before checking the answer. Practice
                is about finding what you understand — and what still needs
                work.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
