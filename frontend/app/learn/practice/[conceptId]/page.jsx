"use client";

import { useEffect, useState } from "react";
import { practiceApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

export default function PracticePage({ params }) {
  const { conceptId } = params;

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQuestions() {
      try {
        setLoading(true);
        const result = await practiceApi.questions({
          conceptId,
          count: 5,
        });

        setQuestions(result.questions || []);
      } catch (err) {
        setError("We couldn't load the practice questions.");
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [conceptId]);

  const question = questions[current];

  const conceptName = conceptId
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  async function submitAnswer() {
    if (!question || selected == null || submitting) return;

    const isCorrect = selected === question.correct_answer;

    setFeedback({
      correct: isCorrect,
      text: isCorrect
        ? "Correct! You understood this one."
        : `Not quite. The correct answer is ${question.correct_answer}.`,
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
      // Practice logging should not block the learning flow.
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    setSelected(null);
    setFeedback(null);
    setCurrent((value) => value + 1);
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="marg-container marg-page">
          <div className="marg-practice-loading">
            <div className="marg-card-kicker">PRACTICE</div>
            <h1>Preparing your questions...</h1>
            <div className="marg-loading-line" />
            <div className="marg-loading-line short" />
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar />
        <main className="marg-container marg-page">
          <div className="marg-alert marg-alert-error">{error}</div>
        </main>
      </>
    );
  }

  if (questions.length === 0) {
    return (
      <>
        <NavBar />
        <main className="marg-container marg-page">
          <div className="marg-empty-state">
            <div className="marg-card-kicker">PRACTICE</div>
            <h1>No questions available yet.</h1>
            <p>
              There aren't any practice questions available for this concept
              right now.
            </p>
            <a href={`/learn/teach/${conceptId}`} className="marg-btn marg-btn-dark">
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

        <main className="marg-container marg-page">
          <div className="marg-complete-layout">
            <section className="marg-complete-main">
              <div className="marg-eyebrow">PRACTICE / COMPLETE</div>

              <div className="marg-complete-number">05</div>

              <h1>Practice complete.</h1>

              <p>
                You've worked through the practice questions for{" "}
                <strong>{conceptName}</strong>.
              </p>

              <div className="marg-complete-actions">
                <a
                  href={`/learn/assessment/new?conceptId=${conceptId}&type=reassessment`}
                  className="marg-btn marg-btn-primary"
                >
                  Take assessment →
                </a>

                <a
                  href={`/learn/teach/${conceptId}`}
                  className="marg-btn marg-btn-outline"
                >
                  Review concept
                </a>
              </div>
            </section>

            <aside className="marg-complete-sidebar">
              <div className="marg-card-kicker">NEXT</div>
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

      <main className="marg-container marg-page">
        <div className="marg-practice-header">
          <div>
            <div className="marg-eyebrow">LEARNING / PRACTICE</div>
            <h1>{conceptName}</h1>
          </div>

          <div className="marg-question-count">
            <span>{String(current + 1).padStart(2, "0")}</span>
            <small>/ {String(questions.length).padStart(2, "0")}</small>
          </div>
        </div>

        <div className="marg-progress-track">
          <div
            className="marg-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="marg-practice-layout">
          <section className="marg-question-card">
            <div className="marg-question-meta">
              <span>QUESTION {current + 1}</span>
              <span>{conceptName}</span>
            </div>

            <h2>{question.body}</h2>

            <div className="marg-options">
              {(question.options || []).map((option, index) => {
                const isSelected = selected === option.id;
                const isCorrect =
                  feedback && option.id === question.correct_answer;
                const isWrong =
                  feedback &&
                  isSelected &&
                  option.id !== question.correct_answer;

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`marg-option ${
                      isSelected ? "selected" : ""
                    } ${isCorrect ? "correct" : ""} ${
                      isWrong ? "wrong" : ""
                    }`}
                    onClick={() => !feedback && setSelected(option.id)}
                    disabled={!!feedback}
                  >
                    <span className="marg-option-letter">
                      {String.fromCharCode(65 + index)}
                    </span>

                    <span className="marg-option-text">{option.text}</span>

                    {isCorrect && (
                      <span className="marg-option-status">✓</span>
                    )}

                    {isWrong && (
                      <span className="marg-option-status">×</span>
                    )}
                  </button>
                );
              })}
            </div>

            {!feedback ? (
              <div className="marg-question-footer">
                <span>Select one answer to continue.</span>

                <button
                  type="button"
                  className="marg-btn marg-btn-primary"
                  onClick={submitAnswer}
                  disabled={selected == null || submitting}
                >
                  {submitting ? "Checking..." : "Check answer →"}
                </button>
              </div>
            ) : (
              <div
                className={`marg-feedback ${
                  feedback.correct ? "correct" : "incorrect"
                }`}
              >
                <div>
                  <strong>{feedback.correct ? "Correct" : "Not quite"}</strong>
                  <p>{feedback.text}</p>
                </div>

                <button
                  type="button"
                  className="marg-btn marg-btn-dark"
                  onClick={nextQuestion}
                >
                  {current + 1 === questions.length
                    ? "Finish practice →"
                    : "Next question →"}
                </button>
              </div>
            )}
          </section>

          <aside className="marg-practice-sidebar">
            <div className="marg-dark-card">
              <div className="marg-card-kicker light">PRACTICE SESSION</div>

              <div className="marg-practice-sidebar-number">
                {String(current + 1).padStart(2, "0")}
              </div>

              <p>
                Question {current + 1} of {questions.length}
              </p>

              <div className="marg-sidebar-divider" />

              <div className="marg-sidebar-row">
                <span>Concept</span>
                <strong>{conceptName}</strong>
              </div>

              <div className="marg-sidebar-row">
                <span>Progress</span>
                <strong>{Math.round(progress)}%</strong>
              </div>
            </div>

            <div className="marg-practice-tip">
              <div className="marg-card-kicker">TIP</div>
              <p>
                Think through the concept before checking the answer. Practice
                is about finding what you understand — and what still needs
                work.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}