
"use client";

import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../../lib/api";
import NavBar from "../../components/NavBar";

export default function ProgressPage() {
  const [history, setHistory] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [knowledgeProfile, setKnowledgeProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      try {
        const [historyResult, assessmentResult, profileResult] =
          await Promise.all([
            dashboardApi.progress(),
            dashboardApi.assessments(),
            dashboardApi.knowledgeProfile(),
          ]);

        if (!cancelled) {
          setHistory(Array.isArray(historyResult) ? historyResult : []);
          setAssessments(
            Array.isArray(assessmentResult) ? assessmentResult : []
          );
          setKnowledgeProfile(profileResult || null);
        }
      } catch (error) {
        console.error("Failed to load progress:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProgress();

    return () => {
      cancelled = true;
    };
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
      const sortedRows = [...rows].sort(
        (a, b) =>
          new Date(a.recorded_at || 0).getTime() -
          new Date(b.recorded_at || 0).getTime()
      );

      const latest = sortedRows[sortedRows.length - 1];
      const first = sortedRows[0];

      const latestScore = Number(latest?.mastery_score || 0);
      const firstScore = Number(first?.mastery_score || 0);

      return {
        conceptId,
        rows: sortedRows,
        latestScore,
        firstScore,
        change: latestScore - firstScore,
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

  const masteredCount = (knowledgeProfile?.all || []).filter(
    (concept) => Number(concept.mastery_score) >= 75
  ).length;

  const assessmentCount = assessments.length;

  function formatDate(date) {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleDateString();
  }

  function formatType(value) {
    return String(value || "Unknown")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getScoreClass(score) {
    if (score >= 75) return "strong";
    if (score >= 40) return "developing";
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

          <a href="/dashboard" className="marg-btn marg-btn-primary">
            Continue learning →
          </a>
        </header>

        {/* Progress statistics */}
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

        {/* Mastery history */}
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
                <a href="/learn/mode" className="marg-btn marg-btn-dark">
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
                        CONCEPT PROGRESS
                      </div>

                      <h3>{formatConceptLabel(concept.conceptId)}</h3>
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
                        <span
                          key={`${row.concept_id}-${row.recorded_at || index}-${index}`}
                        >
                          {formatType(row.reason)} · {row.mastery_score}%
                        </span>
                      ))}
                    </div>

                    {concept.change !== 0 && (
                      <span
                        className={`marg-progress-change ${
                          concept.change > 0 ? "positive" : "negative"
                        }`}
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

        {/* Assessment history */}
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
                <p>Your completed assessments will appear here.</p>
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
                          ? formatConceptLabel(
                              assessment.target_concept_id
                            )
                          : "Full Syllabus"}
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

function formatConceptLabel(label) {
  if (!label) return "Unknown concept";

  let value = String(label).trim();

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original value if it is not valid URL encoding.
  }

  // Strip generated prefix, e.g. generated.array_dbe42cc09c.
  value = value.replace(/^generated[._\s-]+/i, "");

  // Remove the trailing hash before replacing separators with spaces.
  value = value.replace(/[._-]*[a-f0-9]{8,}$/i, "");

  value = value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return "Unknown concept";

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
