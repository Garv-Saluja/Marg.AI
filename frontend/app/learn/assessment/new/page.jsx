"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { assessmentApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

function AssessmentContent() {
  const params = useSearchParams();
  const conceptId = params.get("conceptId");
  const assessmentType = params.get("type") || "diagnostic";

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    assessmentApi
      .start({
        assessmentType,
        scope: "single_topic",
        targetConceptId: conceptId,
        conceptIds: [conceptId],
      })
      .then((r) => {
        setAssessment(r.assessment);
        setQuestions(r.questions);
      });
  }, [conceptId, assessmentType]);

  async function submitAnswer() {
    const question = questions[current];

    await assessmentApi.answer(assessment.assessment_id, {
      questionId: question.question_id,
      studentAnswer: selected,
    });

    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      const completion = await assessmentApi.complete(
        assessment.assessment_id,
        { reason: assessmentType }
      );

      setResult(completion.conceptScores);
    }
  }

  if (result) {
    const mastered = result.every((c) => c.status === "mastered");

    return (
      <>
        <NavBar />

        <main style={{ maxWidth: 640, margin: "48px auto" }}>
          <h1>Assessment complete</h1>

          {result.map((c) => (
            <p key={c.conceptId}>
              {c.conceptLabel}:{" "}
              <strong>{c.masteryScore}%</strong> ({c.status})
            </p>
          ))}

          {mastered ? (
            <>
              <p>🎉 Mastery achieved!</p>
              <a href="/dashboard">Back to dashboard →</a>
            </>
          ) : (
            <>
              <p>
                Not quite there yet — let's re-teach the weak parts.
              </p>

              <a href={`/learn/teach/${conceptId}`}>
                Re-teach this concept →
              </a>
            </>
          )}
        </main>
      </>
    );
  }

  if (questions.length === 0) {
    return (
      <main style={{ padding: 32 }}>
        Preparing your assessment...
      </main>
    );
  }

  const question = questions[current];

  return (
    <>
      <NavBar />

      <main style={{ maxWidth: 640, margin: "48px auto" }}>
        <h1>
          {assessmentType === "diagnostic"
            ? "Diagnostic Assessment"
            : "Reassessment"}
        </h1>

        <p style={{ color: "#999" }}>
          Question {current + 1} of {questions.length}
        </p>

        <div
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 8,
            border: "1px solid #eee",
          }}
        >
          <p>{question.body}</p>

          <div style={{ display: "grid", gap: 8 }}>
            {(question.options || []).map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  type="radio"
                  name="option"
                  checked={selected === opt.id}
                  onChange={() => setSelected(opt.id)}
                />

                {opt.text}
              </label>
            ))}
          </div>

          <button
            onClick={submitAnswer}
            disabled={selected == null}
            style={{ marginTop: 12 }}
          >
            {current + 1 < questions.length ? "Next" : "Finish"}
          </button>
        </div>
      </main>
    </>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 32 }}>
          Loading assessment...
        </main>
      }
    >
      <AssessmentContent />
    </Suspense>
  );
}
