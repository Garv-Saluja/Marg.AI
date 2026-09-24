import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const knowledgeGraphRouter = Router();
knowledgeGraphRouter.use(requireAuth);

// Used by: Single Topic Mode step 3-4 ("finds prerequisite concepts")
knowledgeGraphRouter.get("/prerequisites/:conceptId", async (req, res) => {
  try {
    const data = await aiService.getPrerequisites(req.params.conceptId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "AI service unavailable" });
  }
});

// Used by: Full Syllabus Mode KG visualization + Full Syllabus learning path generation
knowledgeGraphRouter.get("/subject/:subjectId", async (req, res) => {
  try {
    const data = await aiService.getSubjectGraph(req.params.subjectId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "AI service unavailable" });
  }
});
