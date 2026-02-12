import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { requireRole } from "../middleware/roles";
import { validate } from "../middleware/validate";
import { query } from "../db";
import { badRequest, notFound } from "../utils/http";
import { pool } from "../db/pool";
import { createNotification } from "../services/notification-service";
import { sendSessionRequestEmails, sendSessionStatusEmails } from "../utils/mailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const router = Router();

const formatName = (profile?: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) =>
  profile?.display_name ||
  `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
  "CampusTutor user";

type PreferredDateSlot = {
  date: string;
  startTime: string;
  endTime: string;
};

type SessionRequestRow = {
  id: string;
  tutor_id: string;
  tutee_id: string;
  course_id: string;
  preferred_dates: string | PreferredDateSlot[] | null;
  location_type?: "online" | "in_person" | null;
  location_details?: string | null;
  payment_method?: "cash" | "paystack" | null;
  status: string;
};

type TutorProfileIdRow = { id: string };
type ConflictRow = { id: string };
type UpdateResult = { affectedRows: number };

const parseSlot = (slot: PreferredDateSlot) => {
  const start = new Date(`${slot.date}T${slot.startTime}`);
  const end = new Date(`${slot.date}T${slot.endTime}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return { start, end };
};

const isUpcomingSlot = (slot: PreferredDateSlot, now: Date) => {
  const parsed = parseSlot(slot);
  if (!parsed) return false;
  return parsed.end > parsed.start && parsed.end > now;
};

const createSchema = z.object({
  body: z.object({
    tutorId: z.string().uuid(),
    courseId: z.string().uuid(),
    preferredDates: z
      .array(
        z.object({
          date: z.string(),
          startTime: z.string(),
          endTime: z.string(),
        })
      )
      .min(1),
    message: z.string().optional(),
    locationType: z.enum(["online", "in_person"]).optional(),
    locationDetails: z.string().max(255).optional(),
    paymentMethod: z.enum(["cash", "paystack"]).optional(),
  }),
});

router.post(
  "/",
  requireAuth,
  requireVerified,
  requireRole(["tutee", "admin"]),
  validate(createSchema),
  async (req, res, next) => {
  try {
    const { tutorId, courseId, preferredDates, message } = req.body;
    const now = new Date();
    const upcomingPreferredDates = (preferredDates as PreferredDateSlot[]).filter((slot) =>
      isUpcomingSlot(slot, now)
    );
    if (upcomingPreferredDates.length === 0) {
      throw badRequest("Please choose at least one upcoming date and time.");
    }
    const requestId = crypto.randomUUID();
    const activeSessions = await query<{ id: string }[]>(
      `SELECT id FROM sessions
       WHERE status = 'in_progress'
         AND session_date = CURDATE()
         AND start_time <= CURTIME() AND end_time > CURTIME()
         AND (tutor_id = :tutor_id OR tutee_id = :tutee_id)
       LIMIT 1`,
      { tutor_id: tutorId, tutee_id: req.user!.id }
    );
    if (activeSessions.length > 0) {
      throw badRequest("A session is currently in progress. Please try again after it ends.");
    }
    const params = {
      id: requestId,
      tutor_id: tutorId,
      tutee_id: req.user!.id,
      course_id: courseId,
      preferred_dates: JSON.stringify(upcomingPreferredDates),
      message: message ?? null,
      location_type: req.body.locationType ?? null,
      location_details: req.body.locationDetails ?? null,
      payment_method: req.body.paymentMethod ?? "cash",
    };
    try {
      await query(
        `INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message, location_type, location_details, payment_method)
         VALUES (:id, :tutor_id, :tutee_id, :course_id, :preferred_dates, :message, :location_type, :location_details, :payment_method)`,
        params
      );
    } catch {
      try {
        await query(
          `INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message, payment_method)
           VALUES (:id, :tutor_id, :tutee_id, :course_id, :preferred_dates, :message, :payment_method)`,
          params
        );
      } catch {
        await query(
          `INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message)
           VALUES (:id, :tutor_id, :tutee_id, :course_id, :preferred_dates, :message)`,
          params
        );
      }
    }
    const tutorInfo = await query<
      { user_id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
    >(
      `SELECT tp.user_id, u.email, p.display_name, p.first_name, p.last_name
       FROM tutor_profiles tp
       JOIN users u ON u.id = tp.user_id
       JOIN profiles p ON p.user_id = u.id
       WHERE tp.id = :tutor_id`,
      { tutor_id: tutorId }
    );
    const tuteeInfo = await query<
      { email: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
    >(
      `SELECT u.email, p.display_name, p.first_name, p.last_name
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = :user_id`,
      { user_id: req.user!.id }
    );
    const courseInfo = await query<{ name: string }[]>(
      "SELECT name FROM courses WHERE id = :id",
      { id: courseId }
    );
    const tuteeName = formatName(tuteeInfo[0]);
    const tutorName = formatName(tutorInfo[0]);
    const courseName = courseInfo[0]?.name ?? "your course";
    if (tutorInfo[0]) {
      await createNotification(
        tutorInfo[0].user_id,
        "session_request",
        "New session request",
        `${tuteeName} asked for a session`,
        `/dashboard/tutor-hub`,
        { requestId, locationType: req.body.locationType ?? null, locationDetails: req.body.locationDetails ?? null }
      );
    }
    if (tutorInfo[0] && tuteeInfo[0]) {
      try {
        await sendSessionRequestEmails({
          tutorEmail: tutorInfo[0].email,
          tutorName,
          tuteeEmail: tuteeInfo[0].email,
          tuteeName,
          courseName,
          message: message ?? null,
          locationType: req.body.locationType ?? null,
          locationDetails: req.body.locationDetails ?? null,
          actionUrl: `${env.FRONTEND_URL}/dashboard/tutor-hub`,
        });
      } catch (err) {
        logger.warn({ err }, "Failed to send session request emails");
      }
    }
    res.status(201).json({ id: requestId });
  } catch (err) {
    next(err as Error);
  }
});

router.patch(
  "/:id/accept",
  requireAuth,
  requireVerified,
  requireRole(["tutor", "admin"]),
  async (req, res, next) => {
    const requestId = req.params.id;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<SessionRequestRow[]>(
        `SELECT * FROM session_requests WHERE id = ? FOR UPDATE`,
        [requestId]
      );
      const request = rows[0];
      if (!request) {
        throw notFound("Session request not found");
      }
      if (!req.user!.roles.includes("admin")) {
        const [tutorRows] = await connection.query<TutorProfileIdRow[]>(
          "SELECT id FROM tutor_profiles WHERE user_id = ?",
          [req.user!.id]
        );
        const tutorId = tutorRows[0]?.id;
        if (!tutorId || tutorId !== request.tutor_id) {
          throw badRequest("Not authorized for this request");
        }
      }
      if (request.status !== "pending") {
        throw badRequest("Session request is no longer pending");
      }
      let preferred: PreferredDateSlot[] = [];
      if (typeof request.preferred_dates === "string") {
        try {
          const parsed = JSON.parse(request.preferred_dates || "[]");
          preferred = Array.isArray(parsed) ? (parsed as PreferredDateSlot[]) : [];
        } catch {
          preferred = [];
        }
      } else if (Array.isArray(request.preferred_dates)) {
        preferred = request.preferred_dates as PreferredDateSlot[];
      }
      const now = new Date();
      const slot = preferred.find((candidate) => isUpcomingSlot(candidate, now));
      if (!slot) {
        throw badRequest("No upcoming preferred dates available");
      }
      const [conflicts] = await connection.query<ConflictRow[]>(
        `SELECT id FROM sessions
         WHERE session_date = ?
           AND status IN ('pending','confirmed','in_progress')
           AND (tutor_id = ? OR tutee_id = ?)
           AND (start_time < ? AND end_time > ?)
         LIMIT 1 FOR UPDATE`,
        [slot.date, request.tutor_id, request.tutee_id, slot.endTime, slot.startTime]
      );
      if (conflicts.length > 0) {
        throw badRequest("This time is no longer available.");
      }
      const sessionId = crypto.randomUUID();
      try {
        await connection.query(
          `INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, status, payment_method, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'unpaid')`,
          [
            sessionId,
            request.tutor_id,
            request.tutee_id,
            request.course_id,
            slot.date,
            slot.startTime,
            slot.endTime,
            request.location_type ?? "online",
            request.location_details ?? null,
            request.payment_method ?? "cash",
          ]
        );
      } catch {
        await connection.query(
          `INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [
            sessionId,
            request.tutor_id,
            request.tutee_id,
            request.course_id,
            slot.date,
            slot.startTime,
            slot.endTime,
            request.location_type ?? "online",
            request.location_details ?? null,
          ]
        );
      }
      await connection.query(
        `UPDATE session_requests
         SET status = 'accepted', responded_at = NOW()
         WHERE id = ?`,
        [requestId]
      );
      await connection.commit();

      const tutorInfo = await query<
        { user_id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
      >(
        `SELECT tp.user_id, u.email, p.display_name, p.first_name, p.last_name
         FROM tutor_profiles tp
         JOIN users u ON u.id = tp.user_id
         JOIN profiles p ON p.user_id = u.id
         WHERE tp.id = :tutor_id`,
        { tutor_id: request.tutor_id }
      );
      const tuteeInfo = await query<
        { email: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
      >(
        `SELECT u.email, p.display_name, p.first_name, p.last_name
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE u.id = :user_id`,
        { user_id: request.tutee_id }
      );
      const courseInfo = await query<{ name: string }[]>(
        "SELECT name FROM courses WHERE id = :id",
        { id: request.course_id }
      );
      const tutorName = formatName(tutorInfo[0]);
      const tuteeName = formatName(tuteeInfo[0]);
      const courseName = courseInfo[0]?.name ?? "your course";
      const slotText = slot ? `${slot.date} ${slot.startTime}-${slot.endTime}` : undefined;

      await createNotification(
        request.tutee_id,
        "session_confirmed",
        "Request accepted",
        `${tutorName} accepted your request`,
        `/dashboard/sessions`
      );
      if (tutorInfo[0]) {
        await createNotification(
          tutorInfo[0].user_id,
          "session_confirmed",
          "Session confirmed",
          `You accepted ${tuteeName}'s request`,
          `/dashboard/sessions`
        );
      }

      if (tutorInfo[0] && tuteeInfo[0]) {
        try {
          await sendSessionStatusEmails({
            tutorEmail: tutorInfo[0].email,
            tutorName,
            tuteeEmail: tuteeInfo[0].email,
            tuteeName,
            courseName,
            status: "accepted",
            slotText,
            actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
          });
        } catch (err) {
          logger.warn({ err }, "Failed to send session status emails");
        }
      }

      res.json({ sessionId });
    } catch (err) {
      await connection.rollback();
      next(err as Error);
    } finally {
      connection.release();
    }
  }
);

router.patch(
  "/:id/decline",
  requireAuth,
  requireVerified,
  requireRole(["tutor", "admin"]),
  async (req, res, next) => {
    try {
      const requestId = req.params.id;
      const isAdmin = req.user!.roles.includes("admin");

      if (!isAdmin) {
        const tutor = await query<{ id: string }[]>(
          "SELECT id FROM tutor_profiles WHERE user_id = :user_id",
          { user_id: req.user!.id }
        );
        const tutorId = tutor[0]?.id;
        if (!tutorId) {
          throw badRequest("Not authorized for this request");
        }
        const result = await query<UpdateResult>(
          `UPDATE session_requests
           SET status = 'declined', responded_at = NOW()
           WHERE id = :id AND status = 'pending' AND tutor_id = :tutor_id`,
          { id: requestId, tutor_id: tutorId }
        );
        if (result.affectedRows === 0) {
          throw notFound("Session request not found");
        }
      } else {
        const result = await query<UpdateResult>(
          `UPDATE session_requests
           SET status = 'declined', responded_at = NOW()
           WHERE id = :id AND status = 'pending'`,
          { id: requestId }
        );
        if (result.affectedRows === 0) {
          throw notFound("Session request not found");
        }
      }

      const requestRows = await query<{ tutor_id: string; tutee_id: string; course_id: string }[]>(
        "SELECT tutor_id, tutee_id, course_id FROM session_requests WHERE id = :id",
        { id: requestId }
      );
      const request = requestRows[0];
      if (request) {
        const tutorInfo = await query<
          { user_id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
        >(
          `SELECT tp.user_id, u.email, p.display_name, p.first_name, p.last_name
           FROM tutor_profiles tp
           JOIN users u ON u.id = tp.user_id
           JOIN profiles p ON p.user_id = u.id
           WHERE tp.id = :tutor_id`,
          { tutor_id: request.tutor_id }
        );
        const tuteeInfo = await query<
          { email: string; display_name: string | null; first_name: string | null; last_name: string | null }[]
        >(
          `SELECT u.email, p.display_name, p.first_name, p.last_name
           FROM users u
           JOIN profiles p ON p.user_id = u.id
           WHERE u.id = :user_id`,
          { user_id: request.tutee_id }
        );
        const courseInfo = await query<{ name: string }[]>(
          "SELECT name FROM courses WHERE id = :id",
          { id: request.course_id }
        );
        const tutorName = formatName(tutorInfo[0]);
        const tuteeName = formatName(tuteeInfo[0]);
        const courseName = courseInfo[0]?.name ?? "your course";

        await createNotification(
          request.tutee_id,
          "session_cancelled",
          "Request declined",
          "Your tutor declined the request",
          `/dashboard/sessions`
        );
        if (tutorInfo[0]) {
          await createNotification(
            tutorInfo[0].user_id,
            "session_cancelled",
            "Request declined",
            `You declined ${tuteeName}'s request`,
            `/dashboard/requests`
          );
        }

        if (tutorInfo[0] && tuteeInfo[0]) {
          try {
            await sendSessionStatusEmails({
              tutorEmail: tutorInfo[0].email,
              tutorName,
              tuteeEmail: tuteeInfo[0].email,
              tuteeName,
              courseName,
              status: "declined",
              actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
            });
          } catch (err) {
            logger.warn({ err }, "Failed to send session status emails");
          }
        }
      }

      res.status(204).send();
    } catch (err) {
      next(err as Error);
    }
  }
);

export default router;
