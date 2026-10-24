
import axios from "axios";

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 180000, // 3 minutes for LLM processing
});

export const aiService = {
  // Syllabus text -> structured concepts + knowledge graph
  extractConcepts: (payload) =>
    client.post("/concepts/extract", payload).then((r) => r.data),

  // Knowledge graph
  getPrerequisites: (conceptId) =>
    client
      .get(`/graph/prerequisites/${encodeURIComponent(conceptId)}`)
      .then((r) => r.data),

  getSubjectGraph: (subjectId) =>
    client
      .get(`/graph/subject/${encodeURIComponent(subjectId)}`)
      .then((r) => r.data),

  // Knowledge estimation
  estimateKnowledge: (payload) =>
    client.post("/knowledge/estimate", payload).then((r) => r.data),

  // Personalized learning paths
  recommendPath: (payload) =>
    client.post("/recommend/path", payload).then((r) => r.data),

  // AI teaching and doubt support
  teachConcept: (payload) =>
    client.post("/teach/explain", payload).then((r) => r.data),

  askDoubt: (payload) =>
    client.post("/teach/rag-answer", payload).then((r) => r.data),

  reteach: (payload) =>
    client.post("/teach/reteach", payload).then((r) => r.data),

  // Practice questions
  getPracticeQuestions: (payload) =>
    client.post("/practice/select", payload).then((r) => r.data),
};
