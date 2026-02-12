import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { validate } from "../middleware/validate";
import { query } from "../db";
import { badRequest, forbidden, notFound } from "../utils/http";
import { createNotification } from "../services/notification-service";
import { sendReviewReceivedEmail } from "../utils/mailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const router = Router();

const formatName = (profile?: { first_name?: string | null; last_name?: string | null }) =>
  `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "CampusTutor user";

const createSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    overallRating: z.coerce.number().min(1).max(5),
    reviewText: z.string().max(2000).optional(),
  }),
});

router.post("/", requireAuth, requireVerified, validate(createSchema), async (req, res, next) => {
  try {
    const { sessionId, overallRating, reviewText } = req.body;
    const sessionRows = await query<
      {
        id: string;
        status: string;
        tutee_id: string;
        tutor_id: string;
        payment_status?: string | null;
      }[]
    >("SELECT id, status, tutee_id, tutor_id, payment_status FROM sessions WHERE id = :id", {
      id: sessionId,
    });
    const session = sessionRows[0];
    if (!session) {
      throw notFound("Session not found");
    }
    if (session.tutee_id !== req.user!.id) {
      throw forbidden("Only the tutee can leave a review");
    }
    if (session.status !== "completed") {
      throw badRequest("Session must be completed before leaving a review");
    }
    if (session.payment_status && session.payment_status !== "paid") {
      throw badRequest("Payment must be confirmed before leaving a review");
    }
    const existing = await query<{ id: string }[]>(
      "SELECT id FROM reviews WHERE session_id = :session_id",
      { session_id: sessionId }
    );
    if (existing[0]) {
      throw badRequest("Review already submitted");
    }
    const reviewId = crypto.randomUUID();
    await query(
      `INSERT INTO reviews (id, session_id, tutor_id, tutee_id, overall_rating, review_text)
       VALUES (:id, :session_id, :tutor_id, :tutee_id, :overall_rating, :review_text)`,
      {
        id: reviewId,
        session_id: sessionId,
        tutor_id: session.tutor_id,
        tutee_id: req.user!.id,
        overall_rating: overallRating,
        review_text: reviewText ?? null,
      }
    );
    const tutorUser = await query<{ user_id: string }[]>(
      "SELECT user_id FROM tutor_profiles WHERE id = :id",
      { id: session.tutor_id }
    );
    if (tutorUser[0]) {
      await createNotification(
        tutorUser[0].user_id,
        "new_review",
        "New review received",
        "A student left a review for your session.",
        "/dashboard"
      );
      try {
        const tutorProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
          "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
          { user_id: tutorUser[0].user_id }
        );
        const tuteeProfile = await query<{ first_name: string | null; last_name: string | null }[]>(
          "SELECT first_name, last_name FROM profiles WHERE user_id = :user_id",
          { user_id: req.user!.id }
        );
        const tutorEmailRows = await query<{ email: string }[]>(
          "SELECT email FROM users WHERE id = :id",
          { id: tutorUser[0].user_id }
        );
        if (tutorEmailRows[0]) {
          await sendReviewReceivedEmail({
            to: tutorEmailRows[0].email,
            tutorName: formatName(tutorProfile[0]),
            tuteeName: formatName(tuteeProfile[0]),
            rating: overallRating,
            reviewText: reviewText ?? null,
            actionUrl: `${env.FRONTEND_URL}/dashboard`,
          });
        }
      } catch (err) {
        logger.warn({ err }, "Failed to send review email");
      }
    }
    res.status(201).json({ id: reviewId });
  } catch (err) {
    next(err as Error);
  }
});

export default router;
