"use client";
import { useEffect, useState } from "react";
import { practiceApi, assessmentApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

export default function PracticePage({ params }) {
  const { conceptId } = params;
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    practiceApi.questions({ conceptId, count: 5 }).then((r) => setQuestions(r.questions));
  }, [conceptId]);

  const question = questions[current];

  async function submitAnswer() {
    if (!question || selected == null) return;
    const isCorrect = selected === question.correct_answer;
    setFeedback(isCorrect ? "✅ Correct!" : `❌ Not quite. Correct answer: ${question.correct_answer}`);
    // Practice attempts are logged separately from formal assessments — see
    // backend TODO in routes/practice.js (practice_attempts table).
    await practiceApi.attempt({
      conceptId,
      questionId: question.question_id,
      studentAnswer: selected,
      isCorrect,
    }).catch(() => {});
  }

  function nextQuestion() {
    setSelected(null);
    setFeedback(null);
    setCurrent((c) => c + 1);
  }

  if (questions.length === 0) return <main style={{ padding: 32 }}>Loading practice questions...</main>;

  if (current >= questions.length) {
    return (
      <>
        <NavBar />
        <main style={{ maxWidth: 640, margin: "48px auto" }}>
          <h1>Practice complete</h1>
          <p>Ready for a quick assessment to confirm mastery?</p>
          <a href={`/learn/assessment/new?conceptId=${conceptId}&type=reassessment`}>Take assessment →</a>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 640, margin: "48px auto" }}>
        <h1>Practice: {conceptId}</h1>
        <p style={{ color: "#999" }}>Question {current + 1} of {questions.length}</p>
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee" }}>
          <p>{question.body}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {(question.options || []).map((opt) => (
              <label key={opt.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          {!feedback ? (
            <button onClick={submitAnswer} disabled={selected == null} style={{ marginTop: 12 }}>
              Submit
            </button>
          ) : (
            <>
              <p style={{ marginTop: 12 }}>{feedback}</p>
              <button onClick={nextQuestion}>Next →</button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
