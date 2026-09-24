import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { syllabusRouter } from "./routes/syllabus.js";
import { knowledgeGraphRouter } from "./routes/knowledgeGraph.js";
import { assessmentRouter } from "./routes/assessment.js";
import { learningPathRouter } from "./routes/learningPath.js";
import { teachingRouter } from "./routes/teaching.js";
import { practiceRouter } from "./routes/practice.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "backend" }));

// Auth
app.use("/api/auth", authRouter);

// Student Dashboard — separate module, NOT part of the core learning flow
app.use("/api/dashboard", dashboardRouter);

// Full Syllabus Mode: upload + NLP processing
app.use("/api/syllabus", syllabusRouter);

// Knowledge Graph reads (proxied to ai-service/Neo4j)
app.use("/api/graph", knowledgeGraphRouter);

// Diagnostic / post-teaching / reassessment
app.use("/api/assessments", assessmentRouter);

// Personalized learning path generation (both Full Syllabus + Single Topic modes)
app.use("/api/learning-paths", learningPathRouter);

// AI Teaching Module: explanations, doubt support (RAG), re-teaching
app.use("/api/teach", teachingRouter);

// Practice questions
app.use("/api/practice", practiceRouter);

const PORT = process.env.BACKEND_PORT || 4000;
app.listen(PORT, () => console.log(`Marg.ai backend listening on port ${PORT}`));
