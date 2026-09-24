import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({ baseURL: API_BASE_URL });

// Attach the JWT (stored client-side after login) to every request.
// TODO: for a real app, prefer an httpOnly cookie set by the backend over
// localStorage, to reduce XSS token-theft risk. localStorage is fine for a
// capstone demo.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("margai_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }).then((r) => r.data),
  register: (email, password, fullName) =>
    api.post("/auth/register", { email, password, fullName }).then((r) => r.data),
};

export const dashboardApi = {
  overview: () => api.get("/dashboard/overview").then((r) => r.data),
  knowledgeProfile: () => api.get("/dashboard/knowledge-profile").then((r) => r.data),
  currentLearning: () => api.get("/dashboard/current-learning").then((r) => r.data),
  assessments: () => api.get("/dashboard/assessments").then((r) => r.data),
  progress: () => api.get("/dashboard/progress").then((r) => r.data),
};

export const syllabusApi = {
  upload: (file, subjectName) => {
    const form = new FormData();
    form.append("file", file);
    form.append("subjectName", subjectName);
    return api.post("/syllabus/upload", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  process: (syllabusId) => api.post(`/syllabus/${syllabusId}/process`).then((r) => r.data),
};

export const graphApi = {
  prerequisites: (conceptId) => api.get(`/graph/prerequisites/${conceptId}`).then((r) => r.data),
  subjectGraph: (subjectId) => api.get(`/graph/subject/${subjectId}`).then((r) => r.data),
};

export const assessmentApi = {
  start: (payload) => api.post("/assessments/start", payload).then((r) => r.data),
  answer: (assessmentId, payload) => api.post(`/assessments/${assessmentId}/answer`, payload).then((r) => r.data),
  complete: (assessmentId, payload) => api.post(`/assessments/${assessmentId}/complete`, payload).then((r) => r.data),
};

export const learningPathApi = {
  generate: (payload) => api.post("/learning-paths/generate", payload).then((r) => r.data),
  get: (pathId) => api.get(`/learning-paths/${pathId}`).then((r) => r.data),
  updateStep: (stepId, status) => api.patch(`/learning-paths/steps/${stepId}`, { status }).then((r) => r.data),
};

export const teachApi = {
  explain: (payload) => api.post("/teach/explain", payload).then((r) => r.data),
  ask: (payload) => api.post("/teach/ask", payload).then((r) => r.data),
  reteach: (payload) => api.post("/teach/reteach", payload).then((r) => r.data),
};

export const practiceApi = {
  questions: (payload) => api.post("/practice/questions", payload).then((r) => r.data),
  attempt: (payload) => api.post("/practice/attempt", payload).then((r) => r.data),
};
