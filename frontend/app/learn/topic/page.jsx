"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { learningPathApi } from "../../../lib/api";
import NavBar from "../../../components/NavBar";

// TODO(Frontend): replace this free-text input with a proper topic search/picker
// once the backend exposes a "list concepts" endpoint (e.g. GET /graph/concepts?q=...).
// For now, concept ids from the seeded example graph work directly, e.g.:
//   dbms.normalization | dbms.functional_dependencies | dbms.candidate_keys
export default function TopicSelectPage() {
  const router = useRouter();
  const [conceptId, setConceptId] = useState("dbms.normalization");

  async function handleStart(e) {
    e.preventDefault();
    const { learningPath } = await learningPathApi.generate({ scope: "single_topic", targetConceptId: conceptId });
    router.push(`/learn/path/${learningPath.learning_path_id}`);
  }

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 480, margin: "64px auto" }}>
        <h1>Which topic do you want to learn?</h1>
        <form onSubmit={handleStart} style={{ display: "grid", gap: 12 }}>
          <input value={conceptId} onChange={(e) => setConceptId(e.target.value)} placeholder="Concept id" />
          <button type="submit">Build my learning path</button>
        </form>
      </main>
    </>
  );
}
