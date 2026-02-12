import { Router } from "express";
import { query } from "../db";

const router = Router();

router.get("/departments", async (_req, res, next) => {
  try {
    const rows = await query<any[]>(
      "SELECT id, name, code FROM departments WHERE is_active = TRUE ORDER BY name"
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

router.get("/courses", async (req, res, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const rows = await query<any[]>(
      `SELECT id, name, code, department_id 
       FROM courses 
       WHERE is_active = TRUE AND (:departmentId IS NULL OR department_id = :departmentId)
       ORDER BY name`,
      { departmentId: departmentId ?? null }
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

export default router;
