"use client";
import { useEffect, useState } from "react";
import { learningPathApi } from "../../../../lib/api";
import NavBar from "../../../../components/NavBar";

export default function LearningPathPage({ params }) {
  const { pathId } = params;
  const [data, setData] = useState(null);

  useEffect(() => {
    learningPathApi.get(pathId).then(setData);
  }, [pathId]);

  if (!data) return <main style={{ padding: 32 }}>Loading your path...</main>;

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 640, margin: "48px auto" }}>
        <h1>Your Personalized Learning Path</h1>
        <ol style={{ display: "grid", gap: 12, padding: 0, listStyle: "none" }}>
          {data.steps.map((step) => (
            <li key={step.step_id} style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee" }}>
              <strong>{step.concept_label}</strong>
              <span style={{ marginLeft: 8, color: "#999", fontSize: 12 }}>({step.reason})</span>
              <div style={{ marginTop: 8 }}>
                <a href={`/learn/teach/${step.concept_id}?stepId=${step.step_id}`}>Start learning →</a>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
