"use client";
import { useEffect, useState } from "react";
import { dashboardApi } from "../../lib/api";
import NavBar from "../../components/NavBar";

export default function ProgressPage() {
  const [history, setHistory] = useState([]);
  const [assessments, setAssessments] = useState([]);

  useEffect(() => {
    dashboardApi.progress().then(setHistory).catch(() => {});
    dashboardApi.assessments().then(setAssessments).catch(() => {});
  }, []);

  // Group mastery_history rows by concept for a simple per-concept trend list.
  // TODO(Frontend): swap this for a real chart (e.g. recharts) once there's
  // enough history data to make a line chart meaningful.
  const byConcept = history.reduce((acc, row) => {
    (acc[row.concept_id] = acc[row.concept_id] || []).push(row);
    return acc;
  }, {});

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 720, margin: "32px auto" }}>
        <h1>Your Progress</h1>

        <section style={{ marginBottom: 32 }}>
          <h2>Mastery over time</h2>
          {Object.keys(byConcept).length === 0 && <p style={{ color: "#999" }}>No history yet — complete an assessment to see progress here.</p>}
          {Object.entries(byConcept).map(([conceptId, rows]) => (
            <div key={conceptId} style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee", marginBottom: 12 }}>
              <strong>{conceptId}</strong>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {rows.map((r, i) => (
                  <span key={i} style={{ fontSize: 12, background: "#f0f0f8", padding: "4px 8px", borderRadius: 4 }}>
                    {r.reason}: {r.mastery_score}%
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section>
          <h2>Assessment history</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th>Type</th><th>Scope</th><th>Concept</th><th>Status</th><th>Started</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.assessment_id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td>{a.assessment_type}</td>
                  <td>{a.scope}</td>
                  <td>{a.target_concept_id || "—"}</td>
                  <td>{a.status}</td>
                  <td>{new Date(a.started_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
