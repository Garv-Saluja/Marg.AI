"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { assessmentApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

function AssessmentContent() {
  const params = useSearchParams();

  const conceptId = params.get("conceptId");
  const subjectId = params.get("subjectId");
  const assessmentType = params.get("type") || "diagnostic";

  const isFullSyllabus = !!subjectId && !conceptId;

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function startAssessment() {
      try {
        setLoading(true);
        setError("");

        const payload = {
          assessmentType,
          scope: isFullSyllabus ? "full_syllabus" : "single_topic",
        };

        if (isFullSyllabus) {
          payload.subjectId = subjectId;
        } else {
          payload.targetConceptId = conceptId;
          payload.conceptIds = conceptId ? [conceptId] : [];
        }

        const response = await assessmentApi.start(payload);

        setAssessment(response.assessment);
        setQuestions(response.questions || []);
      } catch (err) {
        setError(
          "We couldn't prepare your assessment. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    if (conceptId || subjectId) {
      startAssessment();
    } else {
      setLoading(false);
      setError("No concept or subject was provided for this assessment.");
    }
  }, [conceptId, subjectId, assessmentType, isFullSyllabus]);

  async function submitAnswer() {
    const question = questions[current];

    if (!question || selected == null || !assessment || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await assessmentApi.answer(assessment.assessment_id, {
        questionId: question.question_id,
        studentAnswer: selected,
      });

      if (current + 1 < questions.length) {
        setCurrent((value) => value + 1);
        setSelected(null);
      } else {
        const completion = await assessmentApi.complete(
          assessment.assessment_id,
          {
            reason: assessmentType,
          }
        );

        setResult(completion.conceptScores || []);
      }
    } catch (err) {
      setError("We couldn't submit your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const assessmentTitle =
    assessmentType === "diagnostic"
      ? "Diagnostic Assessment"
      : "Reassessment";

  const conceptName = conceptId
    ? conceptId
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Full Syllabus";

  if (loading) {
    return (
      <>
        <NavBar />

        <main className="marg-container marg-page">
          <div className="marg-assessment-loading">
            <div className="marg-eyebrow">ASSESSMENT</div>

            <h1>Preparing your assessment...</h1>

            <div className="marg-loading-line" />
            <div className="marg-loading-line short" />

            <p>
              Marg.ai is preparing questions based on your learning profile.
            </p>
          </div>
        </main>
      </>
    );
  }

  if (error && !questions.length) {
    return (
      <>
        <NavBar />

        <main className="marg-container marg-page">
          <div className="marg-empty-state">
            <div className="marg-card-kicker">ASSESSMENT</div>

            <h1>Something went wrong.</h1>

            <p>{error}</p>

            <a href="/learn/mode" className="marg-btn marg-btn-dark">
              Back to learning →
            </a>
          </div>
        </main>
      </>
    );
  }

  if (result) {
    const mastered =
      result.length > 0 &&
      result.every((concept) => concept.status === "mastered");

    return (
      <>
        <NavBar />

        <main className="marg-container marg-page">
          <div className="marg-result-layout">
            <section className="marg-result-main">
              <div className="marg-eyebrow">
                ASSESSMENT / COMPLETE
              </div>

              <div className="marg-result-mark">
                {mastered ? "✓" : "!"}
              </div>

              <h1>Assessment complete.</h1>

              <p className="marg-result-intro">
                Your understanding of{" "}
                <strong>{conceptName}</strong> has been reassessed.
              </p>

              <div className="marg-score-list">
                {result.map((concept) => (
                  <div
                    className="marg-score-row"
                    key={concept.conceptId}
                  >
                    <div>
                      <strong>{concept.conceptLabel}</strong>
                      <span>{concept.status}</span>
                    </div>

                    <div className="marg-score-value">
                      {concept.masteryScore}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="marg-result-actions">
                {mastered ? (
                  <a
                    href="/dashboard"
                    className="marg-btn marg-btn-primary"
                  >
                    Back to dashboard →
                  </a>
                ) : (
                  <>
                    <a
                      href={`/learn/teach/${conceptId}`}
                      className="marg-btn marg-btn-primary"
                    >
                      Re-teach this concept →
                    </a>

                    <a
                      href="/dashboard"
                      className="marg-btn marg-btn-outline"
                    >
                      Dashboard
                    </a>
                  </>
                )}
              </div>
            </section>

            <aside className="marg-result-sidebar">
              <div className="marg-card-kicker">
                YOUR RESULT
              </div>

              <div className="marg-result-status">
                {mastered ? "Mastered" : "Keep learning"}
              </div>

              <div className="marg-result-sidebar-divider" />

              <p>
                {mastered
                  ? "You've demonstrated mastery of the assessed concept."
                  : "Your result shows that some parts still need more practice."}
              </p>
            </aside>
          </div>
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
            <div className="marg-card-kicker">ASSESSMENT</div>

            <h1>No questions available.</h1>

            <p>
              There aren't any assessment questions available for this
              learning path yet.
            </p>

            <a href="/dashboard" className="marg-btn marg-btn-dark">
              Back to dashboard →
            </a>
          </div>
        </main>
      </>
    );
  }

  const question = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <>
      <NavBar />

      <main className="marg-container marg-page">
        <header className="marg-assessment-header">
          <div>
            <div className="marg-eyebrow">
              LEARNING / {assessmentType.toUpperCase()}
            </div>

            <h1>{assessmentTitle}</h1>

            <p>{conceptName}</p>
          </div>

          <div className="marg-assessment-count">
            <strong>
              {String(current + 1).padStart(2, "0")}
            </strong>

            <span>
              / {String(questions.length).padStart(2, "0")}
            </span>
          </div>
        </header>

        <div className="marg-progress-track">
          <div
            className="marg-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error && (
          <div className="marg-alert marg-alert-error">
            {error}
          </div>
        )}

        <div className="marg-assessment-layout">
          <section className="marg-assessment-card">
            <div className="marg-assessment-card-header">
              <span>QUESTION {current + 1}</span>

              <span>{Math.round(progress)}% COMPLETE</span>
            </div>

            <div className="marg-assessment-question">
              <h2>{question.body}</h2>

              <div className="marg-assessment-options">
                {(question.options || []).map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`marg-assessment-option ${
                      selected === option.id ? "selected" : ""
                    }`}
                    onClick={() => setSelected(option.id)}
                    disabled={submitting}
                  >
                    <span className="marg-option-letter">
                      {String.fromCharCode(65 + index)}
                    </span>

                    <span>{option.text}</span>

                    {selected === option.id && (
                      <span className="marg-selected-mark">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="marg-assessment-footer">
              <span>
                Choose the answer you think is correct.
              </span>

              <button
                type="button"
                className="marg-btn marg-btn-primary"
                onClick={submitAnswer}
                disabled={selected == null || submitting}
              >
                {submitting
                  ? "Saving..."
                  : current + 1 < questions.length
                  ? "Next question →"
                  : "Finish assessment →"}
              </button>
            </div>
          </section>

          <aside className="marg-assessment-sidebar">
            <div className="marg-dark-card">
              <div className="marg-card-kicker light">
                ASSESSMENT SESSION
              </div>

              <div className="marg-assessment-sidebar-number">
                {String(current + 1).padStart(2, "0")}
              </div>

              <p>
                Question {current + 1} of {questions.length}
              </p>

              <div className="marg-sidebar-divider" />

              <div className="marg-sidebar-row">
                <span>Type</span>
                <strong>{assessmentType}</strong>
              </div>

              <div className="marg-sidebar-row">
                <span>Scope</span>

                <strong>
                  {isFullSyllabus
                    ? "Full syllabus"
                    : "Single topic"}
                </strong>
              </div>
            </div>

            <div className="marg-assessment-note">
              <div className="marg-card-kicker">
                WHY THIS MATTERS
              </div>

              <p>
                Your answers help Marg.ai understand your current
                mastery and determine what you should learn next.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense
      fallback={
        <>
          <NavBar />

          <main className="marg-container marg-page">
            <div className="marg-assessment-loading">
              <div className="marg-card-kicker">
                ASSESSMENT
              </div>

              <h1>Loading assessment...</h1>
            </div>
          </main>
        </>
      }
    >
      <AssessmentContent />
    </Suspense>
  );
}