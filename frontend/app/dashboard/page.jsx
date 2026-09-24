"use client";
import { useEffect, useState } from "react";
import { dashboardApi } from "../../lib/api";
import NavBar from "../../components/NavBar";

// NOTE: This is a standalone module the student can visit any time.
// It is NOT a step in the core learning flow (Login -> Choose Mode -> Learn).
export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [knowledgeProfile, setKnowledgeProfile] = useState(null);
  const [currentLearning, setCurrentLearning] = useState(null);

  useEffect(() => {
    dashboardApi.overview().then(setOverview).catch(() => {});
    dashboardApi.knowledgeProfile().then(setKnowledgeProfile).catch(() => {});
    dashboardApi.currentLearning().then(setCurrentLearning).catch(() => {});
  }, []);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 960, margin: "32px auto", padding: "0 16px" }}>
        <h1>Your Dashboard</h1>

        <section style={{ marginBottom: 32 }}>
          <h2>Overview</h2>
          <pre style={cardStyle}>{JSON.stringify(overview?.conceptCounts || {}, null, 2)}</pre>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Current Learning</h2>
          {currentLearning?.activePath ? (
            <div style={cardStyle}>
              <p>Active path: {currentLearning.activePath.scope}</p>
              <ol>
                {currentLearning.steps?.map((s) => (
                  <li key={s.step_id}>
                    {s.concept_label} — {s.status}
                  </li>
                ))}
              </ol>
              <a href={`/learn/path/${currentLearning.activePath.learning_path_id}`}>Continue →</a>
            </div>
          ) : (
            <div style={cardStyle}>
              No active learning path yet. <a href="/learn/mode">Start learning</a>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2>Knowledge Profile</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={cardStyle}>
              <h3>Weak Concepts</h3>
              <ul>
                {knowledgeProfile?.weakConcepts?.map((c) => (
                  <li key={c.concept_id}>{c.concept_label}: {c.mastery_score}%</li>
                ))}
              </ul>
            </div>
            <div style={cardStyle}>
              <h3>Strong Concepts</h3>
              <ul>
                {knowledgeProfile?.strongConcepts?.map((c) => (
                  <li key={c.concept_id}>{c.concept_label}: {c.mastery_score}%</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

const cardStyle = { background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee" };
