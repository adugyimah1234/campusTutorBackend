"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const verified_1 = require("../middleware/verified");
const validate_1 = require("../middleware/validate");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const notification_service_1 = require("../services/notification-service");
const mailer_1 = require("../utils/mailer");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const formatName = (profile) => `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "CampusTutor user";
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        sessionId: zod_1.z.string().uuid(),
        overallRating: zod_1.z.coerce.number().min(1).max(5),
        reviewText: zod_1.z.string().max(2000).optional(),
    }),
});
router.post("/", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(createSchema), async (req, res, next) => {
    try {
        const { sessionId, overallRating, reviewText } = req.body;
        const sessionRows = await (0, db_1.query)("SELECT id, status, tutee_id, tutor_id, payment_status FROM sessions WHERE id = :id", {
            id: sessionId,
        });
        const session = sessionRows[0];
        if (!session) {
            throw (0, http_1.notFound)("Session not found");
        }
        if (session.tutee_id !== req.user.id) {
            throw (0, http_1.forbidden)("Only the tutee can leave a review");
        }
        if (session.status !== "completed") {
            throw (0, http_1.badRequest)("Session must be completed before leaving a review");
        }
        if (session.payment_status && session.payment_status !== "paid") {
            throw (0, http_1.badRequest)("Payment must be confirmed before leaving a review");
        }
        const existing = await (0, db_1.query)("SELECT id FROM reviews WHERE session_id = :session_id", { session_id: sessionId });
        if (existing[0]) {
            throw (0, http_1.badRequest)("Review already submitted");
        }
        const reviewId = crypto_1.default.randomUUID();
        await (0, db_1.query)(`INSERT INTO reviews (id, session_id, tutor_id, tutee_id, overall_rating, review_text)
       VALUES (:id, :session_id, :tutor_id, :tutee_id, :overall_rating, :review_text)`, {
            id: reviewId,
            session_id: sessionId,
            tutor_id: session.tutor_id,
            tutee_id: req.user.id,
            overall_rating: overallRating,
            review_text: reviewText ?? null,
        });
        const tutorUser = await (0, db_1.query)("SELECT user_id FROM tutor_profiles WHERE id = :id", { id: session.tutor_id });
        if (tutorUser[0]) {
            await (0, notification_service_1.createNotification)(tutorUser[0].user_id, "new_review", "New review received", "A student left a review for your session.", "/dashboard");
            try {
                const tutorProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: tutorUser[0].user_id });
                const tuteeProfile = await (0, db_1.query)("SELECT first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: req.user.id });
                const tutorEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: tutorUser[0].user_id });
                if (tutorEmailRows[0]) {
                    await (0, mailer_1.sendReviewReceivedEmail)({
                        to: tutorEmailRows[0].email,
                        tutorName: formatName(tutorProfile[0]),
                        tuteeName: formatName(tuteeProfile[0]),
                        rating: overallRating,
                        reviewText: reviewText ?? null,
                        actionUrl: `${env_1.env.FRONTEND_URL}/dashboard`,
                    });
                }
            }
            catch (err) {
                logger_1.logger.warn({ err }, "Failed to send review email");
            }
        }
        res.status(201).json({ id: reviewId });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
