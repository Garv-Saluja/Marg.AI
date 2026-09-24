"use client";
import NavBar from "../../../components/NavBar";

// This page is the actual start of the CORE LEARNING FLOW.
// Login -> Dashboard is a separate module; the flow itself starts here.
export default function ModeSelectPage() {
  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 640, margin: "64px auto", textAlign: "center" }}>
        <h1>How would you like to learn today?</h1>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 32 }}>
          <a href="/learn/syllabus" style={optionCard}>
            <h2>📘 Full Syllabus</h2>
            <p>Upload your syllabus and get a complete personalized study plan.</p>
          </a>
          <a href="/learn/topic" style={optionCard}>
            <h2>🎯 Single Topic</h2>
            <p>Jump straight to one topic and let Marg.ai fill in only the gaps.</p>
          </a>
        </div>
      </main>
    </>
  );
}

const optionCard = {
  display: "block",
  width: 260,
  padding: 24,
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  textDecoration: "none",
  color: "inherit",
};
