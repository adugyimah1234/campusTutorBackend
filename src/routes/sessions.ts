import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { query } from "../db";
import { badRequest, forbidden, notFound } from "../utils/http";
import { createNotification } from "../services/notification-service";
import { sendPaymentStatusEmail, sendSessionCancelEmails, sendSessionDetailsEmails } from "../utils/mailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const router = Router();

const createSchema = z.object({
  body: z.object({
    tutorId: z.string().uuid(),
    courseId: z.string().uuid(),
    sessionDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    locationType: z.enum(["in_person", "online"]).default("online"),
    locationDetails: z.string().optional(),
    notes: z.string().optional(),
    paymentMethod: z.enum(["cash", "paystack"]).optional(),
  }),
});

const listSchema = z.object({
  query: z.object({
    status: z.string().optional(),
  }),
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(["in_progress", "completed", "cancelled", "no_show"]),
    cancellationReason: z.string().max(1000).optional(),
  }),
});

const updateDetailsSchema = z.object({
  body: z.object({
    meetingLink: z.string().url().max(500).optional(),
    locationType: z.enum(["in_person", "online"]).optional(),
    locationDetails: z.string().max(255).optional(),
  }),
});

const updatePaymentSchema = z.object({
  body: z.object({
    paymentStatus: z.enum(["paid"]),
  }),
});

const paymentIntentSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(["cash", "paystack"]),
  }),
});

const formatName = (profile?: { first_name?: string | null; last_name?: string | null }) =>
  `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "CampusTutor user";

type SessionListRow = {
  session_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes?: number | null;
  status: string;
  payment_status?: string | null;
  payment_method?: "cash" | "paystack" | null;
  location_type?: "online" | "in_person" | null;
  location_details?: string | null;
  meeting_link?: string | null;
  course_code?: string | null;
  course_name: string;
  tutor_id: string;
  tutor_user_id: string;
  tutor_first_name: string;
  tutor_last_name: string;
  tutor_avatar?: string | null;
  tutee_id: string;
  tutee_first_name: string;
  tutee_last_name: string;
  tutee_avatar?: string | null;
};

router.post("/", requireAuth, requireVerified, validate(createSchema), async (req, res, next) => {
  try {
    const payload = req.body;
    const sessionId = crypto.randomUUID();
    const activeSessions = await query<{ id: string }[]>(
      `SELECT id FROM sessions
       WHERE status = 'in_progress'
         AND session_date = CURDATE()
         AND start_time <= CURTIME() AND end_time > CURTIME()
         AND (tutor_id = :tutor_id OR tutee_id = :tutee_id)
       LIMIT 1`,
      { tutor_id: payload.tutorId, tutee_id: req.user!.id }
    );
    if (activeSessions.length > 0) {
      throw badRequest("A session is currently in progress. Please try again after it ends.");
    }
    const conflicts = await query<{ id: string }[]>(
      `SELECT id FROM sessions
       WHERE session_date = :session_date
         AND status IN ('pending','confirmed','in_progress')
         AND (tutor_id = :tutor_id OR tutee_id = :tutee_id)
         AND (start_time < :end_time AND end_time > :start_time)
       LIMIT 1`,
      {
        session_date: payload.sessionDate,
        tutor_id: payload.tutorId,
        tutee_id: req.user!.id,
        start_time: payload.startTime,
        end_time: payload.endTime,
      }
    );
    if (conflicts.length > 0) {
      throw badRequest("This time is no longer available.");
    }
    try {
      await query(
        `INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, notes, payment_method, payment_status)
         VALUES (:id, :tutor_id, :tutee_id, :course_id, :session_date, :start_time, :end_time, :location_type, :location_details, :notes, :payment_method, :payment_status)`,
        {
          id: sessionId,
          tutor_id: payload.tutorId,
          tutee_id: req.user!.id,
          course_id: payload.courseId,
          session_date: payload.sessionDate,
          start_time: payload.startTime,
          end_time: payload.endTime,
          location_type: payload.locationType,
          location_details: payload.locationDetails ?? null,
          notes: payload.notes ?? null,
          payment_method: payload.paymentMethod ?? "cash",
          payment_status: "unpaid",
        }
      );
    } catch {
      await query(
        `INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, notes)
         VALUES (:id, :tutor_id, :tutee_id, :course_id, :session_date, :start_time, :end_time, :location_type, :location_details, :notes)`,
        {
          id: sessionId,
          tutor_id: payload.tutorId,
          tutee_id: req.user!.id,
          course_id: payload.courseId,
          session_date: payload.sessionDate,
          start_time: payload.startTime,
          end_time: payload.endTime,
          location_type: payload.locationType,
          location_details: payload.locationDetails ?? null,
          notes: payload.notes ?? null,
        }
      );
    }
    res.status(201).json({ id: sessionId });
  } catch (err) {
    next(err as Error);
  }
});

router.get("/", requireAuth, requireVerified, validate(listSchema), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: string };
    const isAdmin = req.user!.roles.includes("admin");
    const rows = await query<SessionListRow[]>(
      `SELECT 
          s.id AS session_id,
          s.session_date,
          s.start_time,
          s.end_time,
          s.duration_minutes,
          s.status,
          s.payment_status,
          s.payment_method,
          s.location_type,
          s.location_details,
          s.meeting_link,
          c.code AS course_code,
          c.name AS course_name,
          tp.id AS tutor_id,
          tu.id AS tutor_user_id,
          tprof.first_name AS tutor_first_name,
          tprof.last_name AS tutor_last_name,
          tprof.avatar_url AS tutor_avatar,
          s.tutee_id,
          sprof.first_name AS tutee_first_name,
          sprof.last_name AS tutee_last_name,
          sprof.avatar_url AS tutee_avatar
       FROM sessions s
       JOIN tutor_profiles tp ON s.tutor_id = tp.id
       JOIN users tu ON tp.user_id = tu.id
       JOIN profiles tprof ON tu.id = tprof.user_id
       JOIN profiles sprof ON s.tutee_id = sprof.user_id
       JOIN courses c ON s.course_id = c.id
       WHERE (:is_admin = 1 OR s.tutee_id = :user_id OR tu.id = :user_id)
         AND (:status IS NULL OR s.status = :status)
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 50`,
      { user_id: req.user!.id, status: status ?? null, is_admin: isAdmin ? 1 : 0 }
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

router.patch(
  "/:id/details",
  requireAuth,
  requireVerified,
  validate(updateDetailsSchema),
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const { meetingLink, locationType, locationDetails } = req.body;
      const rows = await query<
        {
          id: string;
          tutee_id: string;
          tutor_user_id: string;
          session_date: string;
          start_time: string;
          end_time: string;
          meeting_link: string | null;
          location_type: "online" | "in_person" | null;
          location_details: string | null;
          course_name: string;
        }[]
      >(
        `SELECT s.id, s.tutee_id, tp.user_id AS tutor_user_id,
                s.session_date, s.start_time, s.end_time,
                s.meeting_link, s.location_type, s.location_details,
                c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`,
        { id: sessionId }
      );
      const session = rows[0];
      if (!session) {
        throw notFound("Session not found");
      }
      const isAdmin = req.user!.roles.includes("admin");
      const isTutor = session.tutor_user_id === req.user!.id;
      if (!isAdmin && !isTutor) {
        throw forbidden("Only the tutor can update session details");
      }
      await query(
        `UPDATE sessions
         SET meeting_link = COALESCE(:meeting_link, meeting_link),
             location_type = COALESCE(:location_type, location_type),
             location_details = COALESCE(:location_details, location_details)
         WHERE id = :id`,
        {
          id: sessionId,
          meeting_link: meetingLink ?? null,
          location_type: locationType ?? null,
          location_details: locationDetails ?? null,
        }
      );
      if (meetingLink || locationType || locationDetails) {
        await createNotification(
          session.tutee_id,
          "session_confirmed",
          "Session details updated",
          "Your tutor updated the session details.",
          "/dashboard/sessions"
        );
        try {
          const tutorProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
            "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
            { user_id: session.tutor_user_id }
          );
          const tuteeProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
            "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
            { user_id: session.tutee_id }
          );
          const tutorName = formatName(tutorProfile[0]);
          const tuteeName = formatName(tuteeProfile[0]);
          const tutorEmailRows = await query<{ email: string }[]>(
            "SELECT email FROM users WHERE id = :id",
            { id: session.tutor_user_id }
          );
          const tuteeEmailRows = await query<{ email: string }[]>(
            "SELECT email FROM users WHERE id = :id",
            { id: session.tutee_id }
          );
          if (tutorEmailRows[0] && tuteeEmailRows[0]) {
            await sendSessionDetailsEmails({
              tutorEmail: tutorEmailRows[0].email,
              tutorName,
              tuteeEmail: tuteeEmailRows[0].email,
              tuteeName,
              courseName: session.course_name,
              sessionDate: session.session_date,
              sessionTime: `${session.start_time}-${session.end_time}`,
              meetingLink: meetingLink ?? session.meeting_link,
              locationType: locationType ?? session.location_type,
              locationDetails: locationDetails ?? session.location_details,
              actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
            });
          }
        } catch (err) {
          logger.warn({ err }, "Failed to send session details email");
        }
      }
      res.json({ ok: true });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.patch(
  "/:id/status",
  requireAuth,
  requireVerified,
  validate(updateStatusSchema),
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const { status, cancellationReason } = req.body;
      const rows = await query<
        {
          id: string;
          status: string;
          payment_status?: string | null;
          session_date: string;
          start_time: string;
          end_time: string;
          tutee_id: string;
          tutor_id: string;
          tutor_user_id: string;
          course_name: string;
        }[]
      >(
        `SELECT s.id, s.status, s.payment_status, s.session_date, s.start_time, s.end_time, s.tutee_id, s.tutor_id,
                tp.user_id AS tutor_user_id, c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`,
        { id: sessionId }
      );
      const session = rows[0];
      if (!session) {
        throw notFound("Session not found");
      }
      const isAdmin = req.user!.roles.includes("admin");
      const isTutor = session.tutor_user_id === req.user!.id;
      const isTutee = session.tutee_id === req.user!.id;
      if (!isAdmin && !isTutor && !isTutee) {
        throw forbidden("Not authorized for this session");
      }

      const current = session.status;
      const canTutorUpdate = isAdmin || isTutor;
      const canTuteeCancel = isAdmin || isTutee;

      if (status === "in_progress") {
        if (!canTutorUpdate) throw forbidden("Only the tutor can start a session");
        if (!["confirmed", "pending"].includes(current)) {
          throw badRequest("Session cannot be started from the current status");
        }
      }

      if (status === "completed") {
        if (!canTutorUpdate) throw forbidden("Only the tutor can complete a session");
        if (!["in_progress", "confirmed"].includes(current)) {
          throw badRequest("Session cannot be completed from the current status");
        }
      }

      if (status === "cancelled") {
        if (!canTuteeCancel && !canTutorUpdate) {
          throw forbidden("Not authorized to cancel this session");
        }
        if (["completed", "cancelled"].includes(current)) {
          throw badRequest("Session is already completed or cancelled");
        }
      }

      if (status === "no_show") {
        if (!canTutorUpdate) throw forbidden("Only the tutor can mark no-show");
        if (!["confirmed", "in_progress"].includes(current)) {
          throw badRequest("Session cannot be marked no-show from the current status");
        }
      }

      const paymentStatus =
        status === "completed" && session.payment_status !== "paid" ? "due" : null;

      const updates: Record<string, unknown> = {
        status,
        cancellation_reason: null,
        cancelled_by: null,
        cancelled_at: null,
      };
      if (status === "cancelled") {
        updates.cancellation_reason = cancellationReason ?? "Cancelled";
        updates.cancelled_by = req.user!.id;
        updates.cancelled_at = new Date();
      }

      try {
        await query(
          `UPDATE sessions
           SET status = :status,
               cancellation_reason = COALESCE(:cancellation_reason, cancellation_reason),
               cancelled_by = COALESCE(:cancelled_by, cancelled_by),
               cancelled_at = COALESCE(:cancelled_at, cancelled_at),
               payment_status = COALESCE(:payment_status, payment_status)
           WHERE id = :id`,
          { id: sessionId, ...updates, payment_status: paymentStatus }
        );
      } catch {
        await query(
          `UPDATE sessions
           SET status = :status,
               cancellation_reason = COALESCE(:cancellation_reason, cancellation_reason),
               cancelled_by = COALESCE(:cancelled_by, cancelled_by),
               cancelled_at = COALESCE(:cancelled_at, cancelled_at)
           WHERE id = :id`,
          { id: sessionId, ...updates }
        );
      }

      const tutorProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
        "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
        { user_id: session.tutor_user_id }
      );
      const tuteeProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
        "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
        { user_id: session.tutee_id }
      );
      const tutorName = formatName(tutorProfile[0]);
      const tuteeName = formatName(tuteeProfile[0]);
      const tutorEmailRows = await query<{ email: string }[]>(
        "SELECT email FROM users WHERE id = :id",
        { id: session.tutor_user_id }
      );
      const tuteeEmailRows = await query<{ email: string }[]>(
        "SELECT email FROM users WHERE id = :id",
        { id: session.tutee_id }
      );

      if (status === "in_progress") {
        await createNotification(
          session.tutee_id,
          "session_confirmed",
          "Session started",
          `${tutorName} has started the session.`,
          `/dashboard/sessions`
        );
      }
      if (status === "completed") {
        await createNotification(
          session.tutee_id,
          "session_confirmed",
          "Session completed",
          `Your session with ${tutorName} is marked complete. Payment is due before feedback.`,
          `/dashboard/sessions`
        );
        await createNotification(
          session.tutor_user_id,
          "session_confirmed",
          "Session completed",
          `Your session with ${tuteeName} is marked complete.`,
          `/dashboard/sessions`
        );
        if (paymentStatus === "due") {
          try {
            if (tuteeEmailRows[0]) {
              await sendPaymentStatusEmail({
                to: tuteeEmailRows[0].email,
                recipientName: tuteeName,
                statusLabel: "Payment due",
                courseName: session.course_name,
                actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
              });
            }
            if (tutorEmailRows[0]) {
              await sendPaymentStatusEmail({
                to: tutorEmailRows[0].email,
                recipientName: tutorName,
                statusLabel: "Payment due from student",
                courseName: session.course_name,
                actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
              });
            }
          } catch (err) {
            logger.warn({ err }, "Failed to send payment due email");
          }
        }
      }
      if (status === "cancelled") {
        const actor = isTutor ? tutorName : isTutee ? tuteeName : "CampusTutor";
        const otherUserId = isTutor ? session.tutee_id : session.tutor_user_id;
        await createNotification(
          otherUserId,
          "session_cancelled",
          "Session cancelled",
          `${actor} cancelled the session.`,
          `/dashboard/sessions`
        );
        try {
          if (tutorEmailRows[0] && tuteeEmailRows[0]) {
            await sendSessionCancelEmails({
              tutorEmail: tutorEmailRows[0].email,
              tutorName,
              tuteeEmail: tuteeEmailRows[0].email,
              tuteeName,
              courseName: session.course_name,
              cancelledBy: actor,
              reason: cancellationReason ?? null,
              actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
            });
          }
        } catch (err) {
          logger.warn({ err }, "Failed to send session cancellation emails");
        }
      }
      if (status === "no_show") {
        await createNotification(
          session.tutee_id,
          "session_cancelled",
          "No-show recorded",
          `The session was marked as no-show.`,
          `/dashboard/sessions`
        );
      }

      res.json({ ok: true });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.patch(
  "/:id/payment-intent",
  requireAuth,
  requireVerified,
  validate(paymentIntentSchema),
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const { paymentMethod } = req.body;
      const rows = await query<
        {
          id: string;
          status: string;
          payment_status?: string | null;
          tutee_id: string;
          tutor_user_id: string;
          course_name: string;
        }[]
      >(
        `SELECT s.id, s.status, s.payment_status, s.tutee_id, tp.user_id AS tutor_user_id,
                c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`,
        { id: sessionId }
      );
      const session = rows[0];
      if (!session) {
        throw notFound("Session not found");
      }
      const isAdmin = req.user!.roles.includes("admin");
      const isTutee = session.tutee_id === req.user!.id;
      if (!isAdmin && !isTutee) {
        throw forbidden("Only the student can initiate payment");
      }
      if (session.status !== "completed") {
        throw badRequest("Session must be completed before payment");
      }
      if (session.payment_status === "paid") {
        res.json({ ok: true });
        return;
      }
      const nextStatus = paymentMethod === "paystack" ? "paid" : "due";
      try {
        await query(
          `UPDATE sessions
           SET payment_method = :payment_method,
               payment_status = :payment_status
           WHERE id = :id`,
          { id: sessionId, payment_method: paymentMethod, payment_status: nextStatus }
        );
      } catch {
        // fallback if payment columns do not exist
      }
      if (nextStatus === "paid") {
        await createNotification(
          session.tutee_id,
          "session_confirmed",
          "Payment confirmed",
          "Your payment was confirmed automatically. You can now leave feedback.",
          "/dashboard/sessions"
        );
        await createNotification(
          session.tutor_user_id,
          "session_confirmed",
          "Payment confirmed",
          "Payment was confirmed automatically for the completed session.",
          "/dashboard/sessions"
        );
      } else {
        await createNotification(
          session.tutor_user_id,
          "session_confirmed",
          "Payment initiated",
          "A student selected cash payment for the completed session.",
          "/dashboard/sessions"
        );
      }
      try {
        const tutorProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
          "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
          { user_id: session.tutor_user_id }
        );
        const tuteeProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
          "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
          { user_id: session.tutee_id }
        );
        const tutorEmailRows = await query<{ email: string }[]>(
          "SELECT email FROM users WHERE id = :id",
          { id: session.tutor_user_id }
        );
        const tuteeEmailRows = await query<{ email: string }[]>(
          "SELECT email FROM users WHERE id = :id",
          { id: session.tutee_id }
        );
        const tutorName = formatName(tutorProfile[0]);
        const tuteeName = formatName(tuteeProfile[0]);
        if (tuteeEmailRows[0]) {
          await sendPaymentStatusEmail({
            to: tuteeEmailRows[0].email,
            recipientName: tuteeName,
            statusLabel: nextStatus === "paid" ? "Payment confirmed" : "Payment method set to cash",
            courseName: session.course_name,
            actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
          });
        }
        if (tutorEmailRows[0]) {
          await sendPaymentStatusEmail({
            to: tutorEmailRows[0].email,
            recipientName: tutorName,
            statusLabel: nextStatus === "paid" ? "Payment confirmed" : "Student selected cash payment",
            courseName: session.course_name,
            actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
          });
        }
      } catch (err) {
        logger.warn({ err }, "Failed to send payment status email");
      }
      res.json({ ok: true });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.patch(
  "/:id/payment",
  requireAuth,
  requireVerified,
  validate(updatePaymentSchema),
  async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      const { paymentStatus } = req.body;
      const rows = await query<
        {
          id: string;
          status: string;
          payment_status?: string | null;
          tutee_id: string;
          tutor_user_id: string;
          course_name: string;
        }[]
      >(
        `SELECT s.id, s.status, s.payment_status, s.tutee_id, tp.user_id AS tutor_user_id,
                c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`,
        { id: sessionId }
      );
      const session = rows[0];
      if (!session) {
        throw notFound("Session not found");
      }
      const isAdmin = req.user!.roles.includes("admin");
      const isTutor = session.tutor_user_id === req.user!.id;
      if (!isAdmin && !isTutor) {
        throw forbidden("Only the tutor can confirm payment");
      }
      if (session.status !== "completed") {
        throw badRequest("Session must be completed before confirming payment");
      }
      if (session.payment_status === "paid") {
        res.json({ ok: true });
        return;
      }
      await query(
        `UPDATE sessions
         SET payment_status = :payment_status
         WHERE id = :id`,
        { id: sessionId, payment_status: paymentStatus }
      );
      await createNotification(
        session.tutee_id,
        "session_confirmed",
        "Payment confirmed",
        "Payment has been marked as received. You can now leave feedback.",
        "/dashboard/sessions"
      );
      try {
        const tutorProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
          "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
          { user_id: session.tutor_user_id }
        );
        const tuteeProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
          "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
          { user_id: session.tutee_id }
        );
        const tutorEmailRows = await query<{ email: string }[]>(
          "SELECT email FROM users WHERE id = :id",
          { id: session.tutor_user_id }
        );
        const tuteeEmailRows = await query<{ email: string }[]>(
          "SELECT email FROM users WHERE id = :id",
          { id: session.tutee_id }
        );
        const tutorName = formatName(tutorProfile[0]);
        const tuteeName = formatName(tuteeProfile[0]);
        if (tuteeEmailRows[0]) {
          await sendPaymentStatusEmail({
            to: tuteeEmailRows[0].email,
            recipientName: tuteeName,
            statusLabel: "Payment confirmed",
            courseName: session.course_name,
            actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
          });
        }
        if (tutorEmailRows[0]) {
          await sendPaymentStatusEmail({
            to: tutorEmailRows[0].email,
            recipientName: tutorName,
            statusLabel: "Payment confirmed",
            courseName: session.course_name,
            actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
          });
        }
      } catch (err) {
        logger.warn({ err }, "Failed to send payment confirmation email");
      }
      res.json({ ok: true });
    } catch (err) {
      next(err as Error);
    }
  }
);

export default router;
