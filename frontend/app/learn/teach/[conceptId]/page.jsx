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

  async function loadExplanation(selectedMode) {
    setMode(selectedMode);
    setLoading(true);
    const result = await teachApi.explain({ conceptId, explanationMode: selectedMode });
    setExplanation(result.text);
    setLoading(false);
  }

  async function askDoubt(e) {
    e.preventDefault();
    const result = await teachApi.ask({ conceptId, question });
    setDoubtAnswer(result.text);
  }

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 720, margin: "32px auto" }}>
        <h1>{conceptId}</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => loadExplanation(m.id)}
              style={{ fontWeight: mode === m.id ? "bold" : "normal" }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {!explanation && !loading && (
          <button onClick={() => loadExplanation("simple")}>Start explanation</button>
        )}
        {loading && <p>Thinking...</p>}
        {explanation && (
          <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee", whiteSpace: "pre-wrap" }}>
            {explanation}
          </div>
        )}

        <section style={{ marginTop: 24 }}>
          <h3>Have a doubt?</h3>
          <form onSubmit={askDoubt} style={{ display: "flex", gap: 8 }}>
            <input
              style={{ flex: 1 }}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about this concept..."
            />
            <button type="submit">Ask</button>
          </form>
          {doubtAnswer && (
            <div style={{ marginTop: 12, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee" }}>
              {doubtAnswer}
            </div>
          )}
        </section>

        <div style={{ marginTop: 32 }}>
          <a href={`/learn/practice/${conceptId}`}>I'm ready — start practice →</a>
        </div>
      </main>
    </>
  );
}
