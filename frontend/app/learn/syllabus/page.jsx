"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syllabusApi, learningPathApi } from "../../../lib/api";
import NavBar from "../../../components/NavBar";

export default function SyllabusUploadPage() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [subjectName, setSubjectName] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleUploadAndProcess(e) {
    e.preventDefault();

    if (!file || !subjectName.trim()) return;

    setLoading(true);
    setStatus("Uploading your syllabus...");

    try {
      const { subject, syllabus } = await syllabusApi.upload(
        file,
        subjectName.trim()
      );

      setStatus("Extracting concepts & building knowledge graph...");

      await syllabusApi.process(syllabus.syllabus_id);

      setStatus("Generating your personalized path...");

      const { learningPath } = await learningPathApi.generate({
        scope: "full_syllabus",
        subjectId: subject.subject_id,
      });

      router.push(
        `/learn/path/${learningPath.learning_path_id}`
      );
    } catch (err) {
      setStatus(
        err?.response?.data?.error ||
          "Something went wrong while processing your syllabus."
      );
      setLoading(false);
    }
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
      setStatus(null);
    }
  }

  return (
    <>
      <NavBar />

      <main className="marg-container marg-page">
        <header className="marg-syllabus-header">
          <div>
            <div className="marg-eyebrow">
              STEP 02 / FULL SYLLABUS
            </div>

            <h1>
              Give Marg.ai
              <br />
              your syllabus.
            </h1>

            <p>
              We'll turn your syllabus into concepts, map their
              relationships, and build a learning path around what
              you need to learn.
            </p>
          </div>
        </header>

        <div className="marg-syllabus-layout">
          <section className="marg-syllabus-card">
            <form onSubmit={handleUploadAndProcess}>
              <div className="marg-card-kicker">
                SYLLABUS INPUT
              </div>

              <h2>Upload your syllabus</h2>

              <p className="marg-syllabus-description">
                Start with the subject name and your syllabus
                document.
              </p>

              <div className="marg-form-group">
                <label htmlFor="subjectName">
                  Subject name
                </label>

                <input
                  id="subjectName"
                  className="marg-input"
                  placeholder="e.g. DBMS"
                  value={subjectName}
                  onChange={(e) =>
                    setSubjectName(e.target.value)
                  }
                  disabled={loading}
                  required
                />
              </div>

              <div className="marg-form-group">
                <label htmlFor="syllabusFile">
                  Syllabus file
                </label>

                <label
                  htmlFor="syllabusFile"
                  className={`marg-upload-zone ${
                    file ? "has-file" : ""
                  }`}
                >
                  <input
                    id="syllabusFile"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    disabled={loading}
                  />

                  <div className="marg-upload-icon">
                    ↑
                  </div>

                  {file ? (
                    <>
                      <strong>{file.name}</strong>

                      <span>
                        Click to choose another file
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Choose your syllabus</strong>

                      <span>PDF, DOC, or DOCX</span>
                    </>
                  )}
                </label>
              </div>

              {status && (
                <div
                  className={`marg-syllabus-status ${
                    loading ? "processing" : "error"
                  }`}
                >
                  {loading && (
                    <span className="marg-spinner" />
                  )}

                  <span>{status}</span>
                </div>
              )}

              <button
                type="submit"
                className="marg-btn marg-btn-primary marg-syllabus-submit"
                disabled={
                  !file ||
                  !subjectName.trim() ||
                  loading
                }
              >
                {loading
                  ? "Building your path..."
                  : "Analyze syllabus →"}
              </button>
            </form>
          </section>

          <aside className="marg-syllabus-process">
            <div className="marg-card-kicker light">
              WHAT HAPPENS NEXT
            </div>

            <h2>
              From syllabus
              <br />
              to learning path.
            </h2>

            <div className="marg-process-list">
              <ProcessStep
                number="01"
                title="Extract concepts"
                description="Your syllabus is analyzed to identify the concepts you need to learn."
              />

              <ProcessStep
                number="02"
                title="Build the graph"
                description="Concepts and their relationships become a knowledge graph."
              />

              <ProcessStep
                number="03"
                title="Find your gaps"
                description="Your current understanding is used to identify what needs attention."
              />

              <ProcessStep
                number="04"
                title="Build your path"
                description="Marg.ai creates a personalized sequence for your learning."
                last
              />
            </div>
          </aside>
        </div>

        <div className="marg-learning-flow">
          <span className="active">01</span>
          <span>Choose mode</span>

          <span>→</span>

          <span className="active">02</span>
          <span>Upload</span>

          <span>→</span>

          <span>03</span>
          <span>Assess</span>

          <span>→</span>

          <span>04</span>
          <span>Learn</span>

          <span>→</span>

          <span>05</span>
          <span>Master</span>
        </div>
      </main>
    </>
  );
}

function ProcessStep({
  number,
  title,
  description,
  last = false,
}) {
  return (
    <div className="marg-process-item">
      {!last && <div className="marg-process-connector" />}

      <div className="marg-process-number">
        {number}
      </div>

      <div>
        <strong>{title}</strong>

        <p>{description}</p>
      </div>
    </div>
  );
}