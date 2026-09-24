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

  async function handleUploadAndProcess(e) {
    e.preventDefault();
    if (!file) return;
    setStatus("Uploading...");
    const { subject, syllabus } = await syllabusApi.upload(file, subjectName);
    setStatus("Extracting concepts & building knowledge graph...");
    await syllabusApi.process(syllabus.syllabus_id);
    setStatus("Generating your personalized path...");
    const { learningPath } = await learningPathApi.generate({ scope: "full_syllabus", subjectId: subject.subject_id });
    router.push(`/learn/path/${learningPath.learning_path_id}`);
  }

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 480, margin: "64px auto" }}>
        <h1>Upload your syllabus</h1>
        <form onSubmit={handleUploadAndProcess} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Subject name (e.g. DBMS)"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
          />
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files[0])} />
          <button type="submit" disabled={!file}>Analyze syllabus</button>
        </form>
        {status && <p style={{ marginTop: 16, color: "#666" }}>{status}</p>}
      </main>
    </>
  );
}
