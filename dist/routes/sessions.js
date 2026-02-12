"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const auth_1 = require("../middleware/auth");
const verified_1 = require("../middleware/verified");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const notification_service_1 = require("../services/notification-service");
const mailer_1 = require("../utils/mailer");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        tutorId: zod_1.z.string().uuid(),
        courseId: zod_1.z.string().uuid(),
        sessionDate: zod_1.z.string(),
        startTime: zod_1.z.string(),
        endTime: zod_1.z.string(),
        locationType: zod_1.z.enum(["in_person", "online"]).default("online"),
        locationDetails: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        paymentMethod: zod_1.z.enum(["cash", "paystack"]).optional(),
    }),
});
const listSchema = zod_1.z.object({
    query: zod_1.z.object({
        status: zod_1.z.string().optional(),
    }),
});
const updateStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(["in_progress", "completed", "cancelled", "no_show"]),
        cancellationReason: zod_1.z.string().max(1000).optional(),
    }),
});
const updateDetailsSchema = zod_1.z.object({
    body: zod_1.z.object({
        meetingLink: zod_1.z.string().url().max(500).optional(),
        locationType: zod_1.z.enum(["in_person", "online"]).optional(),
        locationDetails: zod_1.z.string().max(255).optional(),
    }),
});
const updatePaymentSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentStatus: zod_1.z.enum(["paid"]),
    }),
});
const paymentIntentSchema = zod_1.z.object({
    body: zod_1.z.object({
        paymentMethod: zod_1.z.enum(["cash", "paystack"]),
    }),
});
const formatName = (profile) => `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "CampusTutor user";
router.post("/", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(createSchema), async (req, res, next) => {
    try {
        const payload = req.body;
        const sessionId = crypto_1.default.randomUUID();
        const activeSessions = await (0, db_1.query)(`SELECT id FROM sessions
       WHERE status = 'in_progress'
         AND session_date = CURDATE()
         AND start_time <= CURTIME() AND end_time > CURTIME()
         AND (tutor_id = :tutor_id OR tutee_id = :tutee_id)
       LIMIT 1`, { tutor_id: payload.tutorId, tutee_id: req.user.id });
        if (activeSessions.length > 0) {
            throw (0, http_1.badRequest)("A session is currently in progress. Please try again after it ends.");
        }
        const conflicts = await (0, db_1.query)(`SELECT id FROM sessions
       WHERE session_date = :session_date
         AND status IN ('pending','confirmed','in_progress')
         AND (tutor_id = :tutor_id OR tutee_id = :tutee_id)
         AND (start_time < :end_time AND end_time > :start_time)
       LIMIT 1`, {
            session_date: payload.sessionDate,
            tutor_id: payload.tutorId,
            tutee_id: req.user.id,
            start_time: payload.startTime,
            end_time: payload.endTime,
        });
        if (conflicts.length > 0) {
            throw (0, http_1.badRequest)("This time is no longer available.");
        }
        try {
            await (0, db_1.query)(`INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, notes, payment_method, payment_status)
         VALUES (:id, :tutor_id, :tutee_id, :course_id, :session_date, :start_time, :end_time, :location_type, :location_details, :notes, :payment_method, :payment_status)`, {
                id: sessionId,
                tutor_id: payload.tutorId,
                tutee_id: req.user.id,
                course_id: payload.courseId,
                session_date: payload.sessionDate,
                start_time: payload.startTime,
                end_time: payload.endTime,
                location_type: payload.locationType,
                location_details: payload.locationDetails ?? null,
                notes: payload.notes ?? null,
                payment_method: payload.paymentMethod ?? "cash",
                payment_status: "unpaid",
            });
        }
        catch {
            await (0, db_1.query)(`INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, notes)
         VALUES (:id, :tutor_id, :tutee_id, :course_id, :session_date, :start_time, :end_time, :location_type, :location_details, :notes)`, {
                id: sessionId,
                tutor_id: payload.tutorId,
                tutee_id: req.user.id,
                course_id: payload.courseId,
                session_date: payload.sessionDate,
                start_time: payload.startTime,
                end_time: payload.endTime,
                location_type: payload.locationType,
                location_details: payload.locationDetails ?? null,
                notes: payload.notes ?? null,
            });
        }
        res.status(201).json({ id: sessionId });
    }
    catch (err) {
        next(err);
    }
});
router.get("/", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(listSchema), async (req, res, next) => {
    try {
        const status = req.query.status;
        const isAdmin = req.user.roles.includes("admin");
        const rows = await (0, db_1.query)(`SELECT 
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
       LIMIT 50`, { user_id: req.user.id, status: status ?? null, is_admin: isAdmin ? 1 : 0 });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/details", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(updateDetailsSchema), async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const { meetingLink, locationType, locationDetails } = req.body;
        const rows = await (0, db_1.query)(`SELECT s.id, s.tutee_id, tp.user_id AS tutor_user_id,
                s.session_date, s.start_time, s.end_time,
                s.meeting_link, s.location_type, s.location_details,
                c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`, { id: sessionId });
        const session = rows[0];
        if (!session) {
            throw (0, http_1.notFound)("Session not found");
        }
        const isAdmin = req.user.roles.includes("admin");
        const isTutor = session.tutor_user_id === req.user.id;
        if (!isAdmin && !isTutor) {
            throw (0, http_1.forbidden)("Only the tutor can update session details");
        }
        await (0, db_1.query)(`UPDATE sessions
         SET meeting_link = COALESCE(:meeting_link, meeting_link),
             location_type = COALESCE(:location_type, location_type),
             location_details = COALESCE(:location_details, location_details)
         WHERE id = :id`, {
            id: sessionId,
            meeting_link: meetingLink ?? null,
            location_type: locationType ?? null,
            location_details: locationDetails ?? null,
        });
        if (meetingLink || locationType || locationDetails) {
            await (0, notification_service_1.createNotification)(session.tutee_id, "session_confirmed", "Session details updated", "Your tutor updated the session details.", "/dashboard/sessions");
            try {
                const tutorProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutor_user_id });
                const tuteeProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutee_id });
                const tutorName = formatName(tutorProfile[0]);
                const tuteeName = formatName(tuteeProfile[0]);
                const tutorEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutor_user_id });
                const tuteeEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutee_id });
                if (tutorEmailRows[0] && tuteeEmailRows[0]) {
                    await (0, mailer_1.sendSessionDetailsEmails)({
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
                        actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                    });
                }
            }
            catch (err) {
                logger_1.logger.warn({ err }, "Failed to send session details email");
            }
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/status", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(updateStatusSchema), async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const { status, cancellationReason } = req.body;
        const rows = await (0, db_1.query)(`SELECT s.id, s.status, s.payment_status, s.session_date, s.start_time, s.end_time, s.tutee_id, s.tutor_id,
                tp.user_id AS tutor_user_id, c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`, { id: sessionId });
        const session = rows[0];
        if (!session) {
            throw (0, http_1.notFound)("Session not found");
        }
        const isAdmin = req.user.roles.includes("admin");
        const isTutor = session.tutor_user_id === req.user.id;
        const isTutee = session.tutee_id === req.user.id;
        if (!isAdmin && !isTutor && !isTutee) {
            throw (0, http_1.forbidden)("Not authorized for this session");
        }
        const current = session.status;
        const canTutorUpdate = isAdmin || isTutor;
        const canTuteeCancel = isAdmin || isTutee;
        if (status === "in_progress") {
            if (!canTutorUpdate)
                throw (0, http_1.forbidden)("Only the tutor can start a session");
            if (!["confirmed", "pending"].includes(current)) {
                throw (0, http_1.badRequest)("Session cannot be started from the current status");
            }
        }
        if (status === "completed") {
            if (!canTutorUpdate)
                throw (0, http_1.forbidden)("Only the tutor can complete a session");
            if (!["in_progress", "confirmed"].includes(current)) {
                throw (0, http_1.badRequest)("Session cannot be completed from the current status");
            }
        }
        if (status === "cancelled") {
            if (!canTuteeCancel && !canTutorUpdate) {
                throw (0, http_1.forbidden)("Not authorized to cancel this session");
            }
            if (["completed", "cancelled"].includes(current)) {
                throw (0, http_1.badRequest)("Session is already completed or cancelled");
            }
        }
        if (status === "no_show") {
            if (!canTutorUpdate)
                throw (0, http_1.forbidden)("Only the tutor can mark no-show");
            if (!["confirmed", "in_progress"].includes(current)) {
                throw (0, http_1.badRequest)("Session cannot be marked no-show from the current status");
            }
        }
        const paymentStatus = status === "completed" && session.payment_status !== "paid" ? "due" : null;
        const updates = {
            status,
            cancellation_reason: null,
            cancelled_by: null,
            cancelled_at: null,
        };
        if (status === "cancelled") {
            updates.cancellation_reason = cancellationReason ?? "Cancelled";
            updates.cancelled_by = req.user.id;
            updates.cancelled_at = new Date();
        }
        try {
            await (0, db_1.query)(`UPDATE sessions
           SET status = :status,
               cancellation_reason = COALESCE(:cancellation_reason, cancellation_reason),
               cancelled_by = COALESCE(:cancelled_by, cancelled_by),
               cancelled_at = COALESCE(:cancelled_at, cancelled_at),
               payment_status = COALESCE(:payment_status, payment_status)
           WHERE id = :id`, { id: sessionId, ...updates, payment_status: paymentStatus });
        }
        catch {
            await (0, db_1.query)(`UPDATE sessions
           SET status = :status,
               cancellation_reason = COALESCE(:cancellation_reason, cancellation_reason),
               cancelled_by = COALESCE(:cancelled_by, cancelled_by),
               cancelled_at = COALESCE(:cancelled_at, cancelled_at)
           WHERE id = :id`, { id: sessionId, ...updates });
        }
        const tutorProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutor_user_id });
        const tuteeProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutee_id });
        const tutorName = formatName(tutorProfile[0]);
        const tuteeName = formatName(tuteeProfile[0]);
        const tutorEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutor_user_id });
        const tuteeEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutee_id });
        if (status === "in_progress") {
            await (0, notification_service_1.createNotification)(session.tutee_id, "session_confirmed", "Session started", `${tutorName} has started the session.`, `/dashboard/sessions`);
        }
        if (status === "completed") {
            await (0, notification_service_1.createNotification)(session.tutee_id, "session_confirmed", "Session completed", `Your session with ${tutorName} is marked complete. Payment is due before feedback.`, `/dashboard/sessions`);
            await (0, notification_service_1.createNotification)(session.tutor_user_id, "session_confirmed", "Session completed", `Your session with ${tuteeName} is marked complete.`, `/dashboard/sessions`);
            if (paymentStatus === "due") {
                try {
                    if (tuteeEmailRows[0]) {
                        await (0, mailer_1.sendPaymentStatusEmail)({
                            to: tuteeEmailRows[0].email,
                            recipientName: tuteeName,
                            statusLabel: "Payment due",
                            courseName: session.course_name,
                            actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                        });
                    }
                    if (tutorEmailRows[0]) {
                        await (0, mailer_1.sendPaymentStatusEmail)({
                            to: tutorEmailRows[0].email,
                            recipientName: tutorName,
                            statusLabel: "Payment due from student",
                            courseName: session.course_name,
                            actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                        });
                    }
                }
                catch (err) {
                    logger_1.logger.warn({ err }, "Failed to send payment due email");
                }
            }
        }
        if (status === "cancelled") {
            const actor = isTutor ? tutorName : isTutee ? tuteeName : "CampusTutor";
            const otherUserId = isTutor ? session.tutee_id : session.tutor_user_id;
            await (0, notification_service_1.createNotification)(otherUserId, "session_cancelled", "Session cancelled", `${actor} cancelled the session.`, `/dashboard/sessions`);
            try {
                if (tutorEmailRows[0] && tuteeEmailRows[0]) {
                    await (0, mailer_1.sendSessionCancelEmails)({
                        tutorEmail: tutorEmailRows[0].email,
                        tutorName,
                        tuteeEmail: tuteeEmailRows[0].email,
                        tuteeName,
                        courseName: session.course_name,
                        cancelledBy: actor,
                        reason: cancellationReason ?? null,
                        actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                    });
                }
            }
            catch (err) {
                logger_1.logger.warn({ err }, "Failed to send session cancellation emails");
            }
        }
        if (status === "no_show") {
            await (0, notification_service_1.createNotification)(session.tutee_id, "session_cancelled", "No-show recorded", `The session was marked as no-show.`, `/dashboard/sessions`);
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/payment-intent", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(paymentIntentSchema), async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const { paymentMethod } = req.body;
        const rows = await (0, db_1.query)(`SELECT s.id, s.status, s.payment_status, s.tutee_id, tp.user_id AS tutor_user_id,
                c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`, { id: sessionId });
        const session = rows[0];
        if (!session) {
            throw (0, http_1.notFound)("Session not found");
        }
        const isAdmin = req.user.roles.includes("admin");
        const isTutee = session.tutee_id === req.user.id;
        if (!isAdmin && !isTutee) {
            throw (0, http_1.forbidden)("Only the student can initiate payment");
        }
        if (session.status !== "completed") {
            throw (0, http_1.badRequest)("Session must be completed before payment");
        }
        if (session.payment_status === "paid") {
            res.json({ ok: true });
            return;
        }
        const nextStatus = paymentMethod === "paystack" ? "paid" : "due";
        try {
            await (0, db_1.query)(`UPDATE sessions
           SET payment_method = :payment_method,
               payment_status = :payment_status
           WHERE id = :id`, { id: sessionId, payment_method: paymentMethod, payment_status: nextStatus });
        }
        catch {
            // fallback if payment columns do not exist
        }
        if (nextStatus === "paid") {
            await (0, notification_service_1.createNotification)(session.tutee_id, "session_confirmed", "Payment confirmed", "Your payment was confirmed automatically. You can now leave feedback.", "/dashboard/sessions");
            await (0, notification_service_1.createNotification)(session.tutor_user_id, "session_confirmed", "Payment confirmed", "Payment was confirmed automatically for the completed session.", "/dashboard/sessions");
        }
        else {
            await (0, notification_service_1.createNotification)(session.tutor_user_id, "session_confirmed", "Payment initiated", "A student selected cash payment for the completed session.", "/dashboard/sessions");
        }
        try {
            const tutorProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutor_user_id });
            const tuteeProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutee_id });
            const tutorEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutor_user_id });
            const tuteeEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutee_id });
            const tutorName = formatName(tutorProfile[0]);
            const tuteeName = formatName(tuteeProfile[0]);
            if (tuteeEmailRows[0]) {
                await (0, mailer_1.sendPaymentStatusEmail)({
                    to: tuteeEmailRows[0].email,
                    recipientName: tuteeName,
                    statusLabel: nextStatus === "paid" ? "Payment confirmed" : "Payment method set to cash",
                    courseName: session.course_name,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                });
            }
            if (tutorEmailRows[0]) {
                await (0, mailer_1.sendPaymentStatusEmail)({
                    to: tutorEmailRows[0].email,
                    recipientName: tutorName,
                    statusLabel: nextStatus === "paid" ? "Payment confirmed" : "Student selected cash payment",
                    courseName: session.course_name,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                });
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send payment status email");
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/payment", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(updatePaymentSchema), async (req, res, next) => {
    try {
        const sessionId = req.params.id;
        const { paymentStatus } = req.body;
        const rows = await (0, db_1.query)(`SELECT s.id, s.status, s.payment_status, s.tutee_id, tp.user_id AS tutor_user_id,
                c.name AS course_name
         FROM sessions s
         JOIN tutor_profiles tp ON s.tutor_id = tp.id
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = :id`, { id: sessionId });
        const session = rows[0];
        if (!session) {
            throw (0, http_1.notFound)("Session not found");
        }
        const isAdmin = req.user.roles.includes("admin");
        const isTutor = session.tutor_user_id === req.user.id;
        if (!isAdmin && !isTutor) {
            throw (0, http_1.forbidden)("Only the tutor can confirm payment");
        }
        if (session.status !== "completed") {
            throw (0, http_1.badRequest)("Session must be completed before confirming payment");
        }
        if (session.payment_status === "paid") {
            res.json({ ok: true });
            return;
        }
        await (0, db_1.query)(`UPDATE sessions
         SET payment_status = :payment_status
         WHERE id = :id`, { id: sessionId, payment_status: paymentStatus });
        await (0, notification_service_1.createNotification)(session.tutee_id, "session_confirmed", "Payment confirmed", "Payment has been marked as received. You can now leave feedback.", "/dashboard/sessions");
        try {
            const tutorProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutor_user_id });
            const tuteeProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: session.tutee_id });
            const tutorEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutor_user_id });
            const tuteeEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: session.tutee_id });
            const tutorName = formatName(tutorProfile[0]);
            const tuteeName = formatName(tuteeProfile[0]);
            if (tuteeEmailRows[0]) {
                await (0, mailer_1.sendPaymentStatusEmail)({
                    to: tuteeEmailRows[0].email,
                    recipientName: tuteeName,
                    statusLabel: "Payment confirmed",
                    courseName: session.course_name,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                });
            }
            if (tutorEmailRows[0]) {
                await (0, mailer_1.sendPaymentStatusEmail)({
                    to: tutorEmailRows[0].email,
                    recipientName: tutorName,
                    statusLabel: "Payment confirmed",
                    courseName: session.course_name,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                });
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send payment confirmation email");
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
