"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const verified_1 = require("../middleware/verified");
const roles_1 = require("../middleware/roles");
const validate_1 = require("../middleware/validate");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const pool_1 = require("../db/pool");
const notification_service_1 = require("../services/notification-service");
const mailer_1 = require("../utils/mailer");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const formatName = (profile) => profile?.display_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    "CampusTutor user";
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        tutorId: zod_1.z.string().uuid(),
        courseId: zod_1.z.string().uuid(),
        preferredDates: zod_1.z
            .array(zod_1.z.object({
            date: zod_1.z.string(),
            startTime: zod_1.z.string(),
            endTime: zod_1.z.string(),
        }))
            .min(1),
        message: zod_1.z.string().optional(),
        locationType: zod_1.z.enum(["online", "in_person"]).optional(),
        locationDetails: zod_1.z.string().max(255).optional(),
        paymentMethod: zod_1.z.enum(["cash", "paystack"]).optional(),
    }),
});
router.post("/", auth_1.requireAuth, verified_1.requireVerified, (0, roles_1.requireRole)(["tutee", "admin"]), (0, validate_1.validate)(createSchema), async (req, res, next) => {
    try {
        const { tutorId, courseId, preferredDates, message } = req.body;
        const requestId = crypto_1.default.randomUUID();
        const activeSessions = await (0, db_1.query)(`SELECT id FROM sessions
       WHERE status = 'in_progress'
         AND session_date = CURDATE()
         AND start_time <= CURTIME() AND end_time > CURTIME()
         AND (tutor_id = :tutor_id OR tutee_id = :tutee_id)
       LIMIT 1`, { tutor_id: tutorId, tutee_id: req.user.id });
        if (activeSessions.length > 0) {
            throw (0, http_1.badRequest)("A session is currently in progress. Please try again after it ends.");
        }
        const params = {
            id: requestId,
            tutor_id: tutorId,
            tutee_id: req.user.id,
            course_id: courseId,
            preferred_dates: JSON.stringify(preferredDates),
            message: message ?? null,
            location_type: req.body.locationType ?? null,
            location_details: req.body.locationDetails ?? null,
            payment_method: req.body.paymentMethod ?? "cash",
        };
        try {
            await (0, db_1.query)(`INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message, location_type, location_details, payment_method)
         VALUES (:id, :tutor_id, :tutee_id, :course_id, :preferred_dates, :message, :location_type, :location_details, :payment_method)`, params);
        }
        catch {
            try {
                await (0, db_1.query)(`INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message, payment_method)
           VALUES (:id, :tutor_id, :tutee_id, :course_id, :preferred_dates, :message, :payment_method)`, params);
            }
            catch {
                await (0, db_1.query)(`INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message)
           VALUES (:id, :tutor_id, :tutee_id, :course_id, :preferred_dates, :message)`, params);
            }
        }
        const tutorInfo = await (0, db_1.query)(`SELECT tp.user_id, u.email, p.display_name, p.first_name, p.last_name
       FROM tutor_profiles tp
       JOIN users u ON u.id = tp.user_id
       JOIN profiles p ON p.user_id = u.id
       WHERE tp.id = :tutor_id`, { tutor_id: tutorId });
        const tuteeInfo = await (0, db_1.query)(`SELECT u.email, p.display_name, p.first_name, p.last_name
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = :user_id`, { user_id: req.user.id });
        const courseInfo = await (0, db_1.query)("SELECT name FROM courses WHERE id = :id", { id: courseId });
        const tuteeName = formatName(tuteeInfo[0]);
        const tutorName = formatName(tutorInfo[0]);
        const courseName = courseInfo[0]?.name ?? "your course";
        if (tutorInfo[0]) {
            await (0, notification_service_1.createNotification)(tutorInfo[0].user_id, "session_request", "New session request", `${tuteeName} asked for a session`, `/dashboard/tutor-hub`, { requestId, locationType: req.body.locationType ?? null, locationDetails: req.body.locationDetails ?? null });
        }
        if (tutorInfo[0] && tuteeInfo[0]) {
            try {
                await (0, mailer_1.sendSessionRequestEmails)({
                    tutorEmail: tutorInfo[0].email,
                    tutorName,
                    tuteeEmail: tuteeInfo[0].email,
                    tuteeName,
                    courseName,
                    message: message ?? null,
                    locationType: req.body.locationType ?? null,
                    locationDetails: req.body.locationDetails ?? null,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/tutor-hub`,
                });
            }
            catch (err) {
                logger_1.logger.warn({ err }, "Failed to send session request emails");
            }
        }
        res.status(201).json({ id: requestId });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/accept", auth_1.requireAuth, verified_1.requireVerified, (0, roles_1.requireRole)(["tutor", "admin"]), async (req, res, next) => {
    const requestId = req.params.id;
    const connection = await pool_1.pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(`SELECT * FROM session_requests WHERE id = ? FOR UPDATE`, [requestId]);
        const request = rows[0];
        if (!request) {
            throw (0, http_1.notFound)("Session request not found");
        }
        if (!req.user.roles.includes("admin")) {
            const [tutorRows] = await connection.query("SELECT id FROM tutor_profiles WHERE user_id = ?", [req.user.id]);
            const tutorId = tutorRows[0]?.id;
            if (!tutorId || tutorId !== request.tutor_id) {
                throw (0, http_1.badRequest)("Not authorized for this request");
            }
        }
        if (request.status !== "pending") {
            throw (0, http_1.badRequest)("Session request is no longer pending");
        }
        const preferred = typeof request.preferred_dates === "string"
            ? JSON.parse(request.preferred_dates || "[]")
            : request.preferred_dates ?? [];
        const slot = preferred[0];
        if (!slot) {
            throw (0, http_1.badRequest)("No preferred dates available");
        }
        const [conflicts] = await connection.query(`SELECT id FROM sessions
         WHERE session_date = ?
           AND status IN ('pending','confirmed','in_progress')
           AND (tutor_id = ? OR tutee_id = ?)
           AND (start_time < ? AND end_time > ?)
         LIMIT 1 FOR UPDATE`, [slot.date, request.tutor_id, request.tutee_id, slot.endTime, slot.startTime]);
        if (conflicts.length > 0) {
            throw (0, http_1.badRequest)("This time is no longer available.");
        }
        const sessionId = crypto_1.default.randomUUID();
        try {
            await connection.query(`INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, status, payment_method, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'unpaid')`, [
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
            ]);
        }
        catch {
            await connection.query(`INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`, [
                sessionId,
                request.tutor_id,
                request.tutee_id,
                request.course_id,
                slot.date,
                slot.startTime,
                slot.endTime,
                request.location_type ?? "online",
                request.location_details ?? null,
            ]);
        }
        await connection.query(`UPDATE session_requests
         SET status = 'accepted', responded_at = NOW()
         WHERE id = ?`, [requestId]);
        await connection.commit();
        const tutorInfo = await (0, db_1.query)(`SELECT tp.user_id, u.email, p.display_name, p.first_name, p.last_name
         FROM tutor_profiles tp
         JOIN users u ON u.id = tp.user_id
         JOIN profiles p ON p.user_id = u.id
         WHERE tp.id = :tutor_id`, { tutor_id: request.tutor_id });
        const tuteeInfo = await (0, db_1.query)(`SELECT u.email, p.display_name, p.first_name, p.last_name
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         WHERE u.id = :user_id`, { user_id: request.tutee_id });
        const courseInfo = await (0, db_1.query)("SELECT name FROM courses WHERE id = :id", { id: request.course_id });
        const tutorName = formatName(tutorInfo[0]);
        const tuteeName = formatName(tuteeInfo[0]);
        const courseName = courseInfo[0]?.name ?? "your course";
        const slotText = slot ? `${slot.date} ${slot.startTime}-${slot.endTime}` : undefined;
        await (0, notification_service_1.createNotification)(request.tutee_id, "session_confirmed", "Request accepted", `${tutorName} accepted your request`, `/sessions/${sessionId}`);
        if (tutorInfo[0]) {
            await (0, notification_service_1.createNotification)(tutorInfo[0].user_id, "session_confirmed", "Session confirmed", `You accepted ${tuteeName}'s request`, `/dashboard/sessions`);
        }
        if (tutorInfo[0] && tuteeInfo[0]) {
            try {
                await (0, mailer_1.sendSessionStatusEmails)({
                    tutorEmail: tutorInfo[0].email,
                    tutorName,
                    tuteeEmail: tuteeInfo[0].email,
                    tuteeName,
                    courseName,
                    status: "accepted",
                    slotText,
                    actionUrl: `${env_1.env.FRONTEND_URL}/sessions/${sessionId}`,
                });
            }
            catch (err) {
                logger_1.logger.warn({ err }, "Failed to send session status emails");
            }
        }
        res.json({ sessionId });
    }
    catch (err) {
        await connection.rollback();
        next(err);
    }
    finally {
        connection.release();
    }
});
router.patch("/:id/decline", auth_1.requireAuth, verified_1.requireVerified, (0, roles_1.requireRole)(["tutor", "admin"]), async (req, res, next) => {
    try {
        const requestId = req.params.id;
        const isAdmin = req.user.roles.includes("admin");
        if (!isAdmin) {
            const tutor = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
            const tutorId = tutor[0]?.id;
            if (!tutorId) {
                throw (0, http_1.badRequest)("Not authorized for this request");
            }
            const result = await (0, db_1.query)(`UPDATE session_requests
           SET status = 'declined', responded_at = NOW()
           WHERE id = :id AND status = 'pending' AND tutor_id = :tutor_id`, { id: requestId, tutor_id: tutorId });
            if (result.affectedRows === 0) {
                throw (0, http_1.notFound)("Session request not found");
            }
        }
        else {
            const result = await (0, db_1.query)(`UPDATE session_requests
           SET status = 'declined', responded_at = NOW()
           WHERE id = :id AND status = 'pending'`, { id: requestId });
            if (result.affectedRows === 0) {
                throw (0, http_1.notFound)("Session request not found");
            }
        }
        const requestRows = await (0, db_1.query)("SELECT tutor_id, tutee_id, course_id FROM session_requests WHERE id = :id", { id: requestId });
        const request = requestRows[0];
        if (request) {
            const tutorInfo = await (0, db_1.query)(`SELECT tp.user_id, u.email, p.display_name, p.first_name, p.last_name
           FROM tutor_profiles tp
           JOIN users u ON u.id = tp.user_id
           JOIN profiles p ON p.user_id = u.id
           WHERE tp.id = :tutor_id`, { tutor_id: request.tutor_id });
            const tuteeInfo = await (0, db_1.query)(`SELECT u.email, p.display_name, p.first_name, p.last_name
           FROM users u
           JOIN profiles p ON p.user_id = u.id
           WHERE u.id = :user_id`, { user_id: request.tutee_id });
            const courseInfo = await (0, db_1.query)("SELECT name FROM courses WHERE id = :id", { id: request.course_id });
            const tutorName = formatName(tutorInfo[0]);
            const tuteeName = formatName(tuteeInfo[0]);
            const courseName = courseInfo[0]?.name ?? "your course";
            await (0, notification_service_1.createNotification)(request.tutee_id, "session_cancelled", "Request declined", "Your tutor declined the request", `/requests`);
            if (tutorInfo[0]) {
                await (0, notification_service_1.createNotification)(tutorInfo[0].user_id, "session_cancelled", "Request declined", `You declined ${tuteeName}'s request`, `/dashboard/requests`);
            }
            if (tutorInfo[0] && tuteeInfo[0]) {
                try {
                    await (0, mailer_1.sendSessionStatusEmails)({
                        tutorEmail: tutorInfo[0].email,
                        tutorName,
                        tuteeEmail: tuteeInfo[0].email,
                        tuteeName,
                        courseName,
                        status: "declined",
                        actionUrl: `${env_1.env.FRONTEND_URL}/requests`,
                    });
                }
                catch (err) {
                    logger_1.logger.warn({ err }, "Failed to send session status emails");
                }
            }
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
