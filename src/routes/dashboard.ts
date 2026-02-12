import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { getAdminDashboard, getTuteeDashboard, getTutorDashboard } from "../services/dashboard-service";

const router = Router();

router.get("/tutee", requireAuth, requireRole(["tutee", "admin"]), async (req, res, next) => {
  try {
    const data = await getTuteeDashboard(req.user!.id);
    res.json(data);
  } catch (err) {
    next(err as Error);
  }
});

router.get("/tutor", requireAuth, requireRole(["tutor", "admin"]), async (req, res, next) => {
  try {
    const range = typeof req.query.range === "string" ? req.query.range : undefined;
    const data = await getTutorDashboard(req.user!.id, range);
    res.json(data);
  } catch (err) {
    next(err as Error);
  }
});

router.get("/admin", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const data = await getAdminDashboard();
    res.json(data);
  } catch (err) {
    next(err as Error);
  }
});

export default router;
