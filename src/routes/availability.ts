import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { validate } from "../middleware/validate";
import { query } from "../db";
import { badRequest } from "../utils/http";

const router = Router();

const createSchema = z.object({
  body: z.object({
    dayOfWeek: z.enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]),
    startTime: z.string(),
    endTime: z.string(),
    isRecurring: z.boolean().default(true),
  }),
});

router.get("/", requireAuth, requireRole(["tutor", "admin"]), async (req, res, next) => {
  try {
    const tutor = await query<{ id: string }[]>(
      "SELECT id FROM tutor_profiles WHERE user_id = :user_id",
      { user_id: req.user!.id }
    );
    const tutorId = tutor[0]?.id;
    if (!tutorId) {
      throw badRequest("Tutor profile not found");
    }
    const rows = await query<any[]>(
      `SELECT id, day_of_week, start_time, end_time, is_recurring
       FROM tutor_availability
       WHERE tutor_id = :tutor_id
       ORDER BY FIELD(day_of_week,'monday','tuesday','wednesday','thursday','friday','saturday','sunday'), start_time`,
      { tutor_id: tutorId }
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/", requireAuth, requireRole(["tutor", "admin"]), validate(createSchema), async (req, res, next) => {
  try {
    const tutor = await query<{ id: string }[]>(
      "SELECT id FROM tutor_profiles WHERE user_id = :user_id",
      { user_id: req.user!.id }
    );
    const tutorId = tutor[0]?.id;
    if (!tutorId) {
      throw badRequest("Tutor profile not found");
    }
    const slotIdRows = await query<any[]>("SELECT UUID() as id");
    const slotId = slotIdRows[0]?.id;
    await query(
      `INSERT INTO tutor_availability (id, tutor_id, day_of_week, start_time, end_time, is_recurring)
       VALUES (:id, :tutor_id, :day_of_week, :start_time, :end_time, :is_recurring)`,
      {
        id: slotId,
        tutor_id: tutorId,
        day_of_week: req.body.dayOfWeek,
        start_time: req.body.startTime,
        end_time: req.body.endTime,
        is_recurring: req.body.isRecurring ? 1 : 0,
      }
    );
    res.status(201).json({ id: slotId });
  } catch (err) {
    next(err as Error);
  }
});

router.delete("/:id", requireAuth, requireRole(["tutor", "admin"]), async (req, res, next) => {
  try {
    const tutor = await query<{ id: string }[]>(
      "SELECT id FROM tutor_profiles WHERE user_id = :user_id",
      { user_id: req.user!.id }
    );
    const tutorId = tutor[0]?.id;
    if (!tutorId) {
      throw badRequest("Tutor profile not found");
    }
    await query(
      "DELETE FROM tutor_availability WHERE id = :id AND tutor_id = :tutor_id",
      { id: req.params.id, tutor_id: tutorId }
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

export default router;
