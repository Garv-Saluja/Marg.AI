import axios from "axios";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const client = axios.create({ baseURL: AI_SERVICE_URL, timeout: 30000 });

export const aiService = {
  // Step 1-2: syllabus text -> structured concept list + KG write
  extractConcepts: (payload) => client.post("/concepts/extract", payload).then((r) => r.data),

  // Step 3: fetch subgraph / prerequisites for a concept, or full subject graph
  getPrerequisites: (conceptId) =>
    client.get(`/graph/prerequisites/${encodeURIComponent(conceptId)}`).then((r) => r.data),
  getSubjectGraph: (subjectId) =>
    client.get(`/graph/subject/${encodeURIComponent(subjectId)}`).then((r) => r.data),

  // Step 4-5: score a diagnostic assessment into concept-level mastery
  estimateKnowledge: (payload) => client.post("/knowledge/estimate", payload).then((r) => r.data),

  // Step 11: personalized recommendation / learning path generation
  recommendPath: (payload) => client.post("/recommend/path", payload).then((r) => r.data),

  // Step 7-8: AI teaching (explanation) + RAG doubt support
  teachConcept: (payload) => client.post("/teach/explain", payload).then((r) => r.data),
  askDoubt: (payload) => client.post("/teach/rag-answer", payload).then((r) => r.data),
  reteach: (payload) => client.post("/teach/reteach", payload).then((r) => r.data),

  // Step 9: practice question selection/generation
  getPracticeQuestions: (payload) => client.post("/practice/select", payload).then((r) => r.data),
};
