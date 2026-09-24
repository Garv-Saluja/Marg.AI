"use client";

import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../../lib/api";
import NavBar from "../../components/NavBar";

export default function ProgressPage() {
  const [history, setHistory] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      try {
        const [historyResult, assessmentResult] = await Promise.all([
          dashboardApi.progress(),
          dashboardApi.assessments(),
        ]);

        setHistory(historyResult || []);
        setAssessments(assessmentResult || []);
      } catch (error) {
        // Keep the page usable even if one request fails.
      } finally {
        setLoading(false);
      }
    }

    loadProgress();
  }, []);

  const byConcept = useMemo(() => {
    return history.reduce((acc, row) => {
      const conceptId = row.concept_id || "unknown";

      if (!acc[conceptId]) {
        acc[conceptId] = [];
      }

      acc[conceptId].push(row);
      return acc;
    }, {});
  }, [history]);

  const conceptStats = useMemo(() => {
    return Object.entries(byConcept).map(([conceptId, rows]) => {
      const latest = rows[rows.length - 1];
      const first = rows[0];

      return {
        conceptId,
        rows,
        latestScore: Number(latest?.mastery_score || 0),
        firstScore: Number(first?.mastery_score || 0),
        change:
          Number(latest?.mastery_score || 0) -
          Number(first?.mastery_score || 0),
      };
    });
  }, [byConcept]);

  const averageMastery =
    conceptStats.length > 0
      ? Math.round(
          conceptStats.reduce((sum, item) => sum + item.latestScore, 0) /
            conceptStats.length
        )
      : 0;

  const masteredCount = conceptStats.filter(
    (item) => item.latestScore >= 80
  ).length;

  const assessmentCount = assessments.length;

  function formatConcept(conceptId) {
    return conceptId
      .replace(/[_-]/g, " ")
      .replace(/\./g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(date) {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleDateString();
  }

  function formatType(value) {
    return String(value || "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getScoreClass(score) {
    if (score >= 80) return "strong";
    if (score >= 50) return "developing";
    return "needs-work";
  }

  if (loading) {
    return (
      <>
        <NavBar />

        <main className="marg-container marg-page">
          <div className="marg-progress-loading">
            <div className="marg-eyebrow">PROGRESS</div>
            <h1>Loading your progress...</h1>
            <div className="marg-loading-line" />
            <div className="marg-loading-line short" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />

      <main className="marg-container marg-page">
        <header className="marg-progress-header">
          <div>
            <div className="marg-eyebrow">YOUR LEARNING / PROGRESS</div>
            <h1>See how far you've come.</h1>
            <p>
              Track your mastery across concepts and see how your assessments
              are shaping your learning path.
            </p>
          </div>

          <a href="/learn/mode" className="marg-btn marg-btn-primary">
            Continue learning →
          </a>
        </header>

        <section className="marg-progress-stats">
          <div className="marg-progress-stat">
            <span>AVERAGE MASTERY</span>
            <strong>{averageMastery}%</strong>
          </div>

          <div className="marg-progress-stat">
            <span>CONCEPTS TRACKED</span>
            <strong>{conceptStats.length}</strong>
          </div>

          <div className="marg-progress-stat">
            <span>MASTERED</span>
            <strong>{masteredCount}</strong>
          </div>

          <div className="marg-progress-stat">
            <span>ASSESSMENTS</span>
            <strong>{assessmentCount}</strong>
          </div>
        </section>

        <section className="marg-progress-section">
          <div className="marg-progress-section-header">
            <div>
              <div className="marg-card-kicker">01 / MASTERY</div>
              <h2>Mastery over time</h2>
            </div>

            <span className="marg-section-number">
              {conceptStats.length} CONCEPTS
            </span>
          </div>

          {conceptStats.length === 0 ? (
            <div className="marg-progress-empty">
              <div className="marg-empty-mark">+</div>
              <div>
                <h3>No mastery history yet.</h3>
                <p>
                  Complete an assessment to start building your progress
                  history.
                </p>
                <a
                  href="/learn/mode"
                  className="marg-btn marg-btn-dark"
                >
                  Start learning →
                </a>
              </div>
            </div>
          ) : (
            <div className="marg-concept-list">
              {conceptStats.map((concept) => (
                <div
                  key={concept.conceptId}
                  className="marg-concept-progress"
                >
                  <div className="marg-concept-progress-top">
                    <div>
                      <div className="marg-concept-id">
                        {concept.conceptId}
                      </div>

                      <h3>{formatConcept(concept.conceptId)}</h3>
                    </div>

                    <div
                      className={`marg-concept-score ${getScoreClass(
                        concept.latestScore
                      )}`}
                    >
                      {concept.latestScore}%
                    </div>
                  </div>

                  <div className="marg-mastery-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          Math.max(concept.latestScore, 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="marg-concept-progress-bottom">
                    <div className="marg-history-pills">
                      {concept.rows.map((row, index) => (
                        <span key={`${row.concept_id}-${index}`}>
                          {formatType(row.reason)} · {row.mastery_score}%
                        </span>
                      ))}
                    </div>

                    {concept.change !== 0 && (
                      <span
                        className={
                          concept.change > 0
                            ? "marg-progress-change positive"
                            : "marg-progress-change negative"
                        }
                      >
                        {concept.change > 0 ? "+" : ""}
                        {concept.change}% since first assessment
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="marg-progress-section assessment-history-section">
          <div className="marg-progress-section-header">
            <div>
              <div className="marg-card-kicker">02 / ASSESSMENTS</div>
              <h2>Assessment history</h2>
            </div>

            <span className="marg-section-number">
              {assessments.length} RECORDS
            </span>
          </div>

          {assessments.length === 0 ? (
            <div className="marg-progress-empty compact">
              <div>
                <h3>No assessments yet.</h3>
                <p>
                  Your completed assessments will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="marg-assessment-table-wrap">
              <table className="marg-assessment-table">
                <thead>
                  <tr>
                    <th>TYPE</th>
                    <th>SCOPE</th>
                    <th>CONCEPT</th>
                    <th>STATUS</th>
                    <th>STARTED</th>
                  </tr>
                </thead>

                <tbody>
                  {assessments.map((assessment) => (
                    <tr key={assessment.assessment_id}>
                      <td>
                        <strong>
                          {formatType(assessment.assessment_type)}
                        </strong>
                      </td>

                      <td>{formatType(assessment.scope)}</td>

                      <td>
                        {assessment.target_concept_id
                          ? formatConcept(assessment.target_concept_id)
                          : "Full syllabus"}
                      </td>

                      <td>
                        <span
                          className={`marg-status ${
                            assessment.status === "completed"
                              ? "completed"
                              : ""
                          }`}
                        >
                          {formatType(assessment.status)}
                        </span>
                      </td>

                      <td>{formatDate(assessment.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}