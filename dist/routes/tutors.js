"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const auth_1 = require("../middleware/auth");
const verified_1 = require("../middleware/verified");
const roles_1 = require("../middleware/roles");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const phone_1 = require("../utils/phone");
const router = (0, express_1.Router)();
const searchSchema = zod_1.z.object({
    query: zod_1.z.object({
        search: zod_1.z.string().optional(),
        courseId: zod_1.z.string().uuid().optional(),
        departmentId: zod_1.z.string().uuid().optional(),
        minRating: zod_1.z.coerce.number().min(0).max(5).optional(),
        featured: zod_1.z.coerce.boolean().optional(),
        limit: zod_1.z.coerce.number().min(1).max(50).default(20),
        offset: zod_1.z.coerce.number().min(0).default(0),
    }),
});
router.get("/", (0, validate_1.validate)(searchSchema), async (req, res, next) => {
    try {
        const { search, courseId, departmentId, minRating, featured, limit, offset } = req.query;
        const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
        const safeOffset = Math.max(0, Number(offset) || 0);
        const rows = await (0, db_1.query)(`SELECT 
          tp.id AS tutor_id,
          ANY_VALUE(p.first_name) AS first_name,
          ANY_VALUE(p.last_name) AS last_name,
          ANY_VALUE(p.display_name) AS display_name,
          ANY_VALUE(p.avatar_url) AS avatar_url,
          ANY_VALUE(tp.headline) AS headline,
          ANY_VALUE(tp.about_me) AS about_me,
          ANY_VALUE(tp.is_available) AS is_available,
          ANY_VALUE(tp.is_featured) AS is_featured,
          ANY_VALUE(tp.average_rating) AS average_rating,
          ANY_VALUE(tp.total_sessions) AS total_sessions,
          GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS courses
       FROM tutor_profiles tp
       JOIN users u ON tp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       LEFT JOIN tutor_courses tc ON tp.id = tc.tutor_id
       LEFT JOIN courses c ON tc.course_id = c.id
       WHERE u.is_active = TRUE
         AND u.email_verified = TRUE
         AND (:search IS NULL OR 
              p.first_name LIKE CONCAT('%', :search, '%') OR
              p.last_name LIKE CONCAT('%', :search, '%') OR
              c.name LIKE CONCAT('%', :search, '%'))
         AND (:courseId IS NULL OR tc.course_id = :courseId)
         AND (:departmentId IS NULL OR c.department_id = :departmentId)
         AND (:minRating IS NULL OR tp.average_rating >= :minRating)
         AND (:featured IS NULL OR tp.is_featured = :featured)
       GROUP BY tp.id
       ORDER BY ANY_VALUE(tp.is_featured) DESC, ANY_VALUE(tp.average_rating) DESC, ANY_VALUE(tp.total_sessions) DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`, {
            search: search ?? null,
            courseId: courseId ?? null,
            departmentId: departmentId ?? null,
            minRating: minRating ?? null,
            featured: typeof featured === "boolean" ? (featured ? 1 : 0) : null,
        });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
const updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        headline: zod_1.z.string().max(120).optional(),
        aboutMe: zod_1.z.string().max(2000).optional(),
        hourlyRate: zod_1.z.coerce.number().min(0).max(500).optional(),
        isAvailable: zod_1.z.coerce.boolean().optional(),
        phone: zod_1.z
            .string()
            .max(20)
            .optional()
            .refine((value) => !value || (0, phone_1.isValidGhanaPhone)(value), {
            message: "Invalid Ghana phone number",
        }),
    }),
});
const updateCoursesSchema = zod_1.z.object({
    body: zod_1.z.object({
        courseIds: zod_1.z.array(zod_1.z.string().uuid()).max(20),
    }),
});
router.get("/me", auth_1.requireAuth, verified_1.requireVerified, (0, roles_1.requireRole)(["tutor"]), async (req, res, next) => {
    try {
        const rows = await (0, db_1.query)(`SELECT 
          tp.id AS tutor_id,
          tp.headline,
          tp.about_me,
          tp.hourly_rate,
          tp.is_available,
          p.phone
       FROM tutor_profiles tp
       JOIN profiles p ON p.user_id = tp.user_id
       WHERE tp.user_id = :user_id`, { user_id: req.user.id });
        let tutor = rows[0];
        if (!tutor) {
            await (0, db_1.query)("INSERT INTO tutor_profiles (user_id, headline, is_verified, is_available) VALUES (:user_id, :headline, FALSE, FALSE)", { user_id: req.user.id, headline: "New Tutor" });
            const created = await (0, db_1.query)(`SELECT 
            tp.id AS tutor_id,
            tp.headline,
            tp.about_me,
            tp.hourly_rate,
            tp.is_available,
            p.phone
         FROM tutor_profiles tp
         JOIN profiles p ON p.user_id = tp.user_id
         WHERE tp.user_id = :user_id`, { user_id: req.user.id });
            tutor = created[0];
        }
        const courses = await (0, db_1.query)(`SELECT course_id 
       FROM tutor_courses 
       WHERE tutor_id = :tutor_id`, { tutor_id: tutor.tutor_id });
        res.json({ tutor, courses: courses.map((row) => row.course_id) });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/me", auth_1.requireAuth, verified_1.requireVerified, (0, roles_1.requireRole)(["tutor"]), (0, validate_1.validate)(updateProfileSchema), async (req, res, next) => {
    try {
        const rows = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
        const tutorId = rows[0]?.id;
        if (!tutorId) {
            return next((0, http_1.notFound)("Tutor profile not found"));
        }
        await (0, db_1.query)(`UPDATE tutor_profiles
         SET headline = COALESCE(:headline, headline),
             about_me = COALESCE(:about_me, about_me),
             hourly_rate = COALESCE(:hourly_rate, hourly_rate),
             is_available = COALESCE(:is_available, is_available)
         WHERE id = :id`, {
            id: tutorId,
            headline: req.body.headline ?? null,
            about_me: req.body.aboutMe ?? null,
            hourly_rate: req.body.hourlyRate ?? null,
            is_available: typeof req.body.isAvailable === "boolean"
                ? req.body.isAvailable
                : null,
        });
        if (typeof req.body.phone === "string") {
            await (0, db_1.query)("UPDATE profiles SET phone = :phone WHERE user_id = :user_id", { phone: req.body.phone, user_id: req.user.id });
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.put("/me/courses", auth_1.requireAuth, verified_1.requireVerified, (0, roles_1.requireRole)(["tutor"]), (0, validate_1.validate)(updateCoursesSchema), async (req, res, next) => {
    try {
        const rows = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
        const tutorId = rows[0]?.id;
        if (!tutorId) {
            return next((0, http_1.notFound)("Tutor profile not found"));
        }
        await (0, db_1.query)("DELETE FROM tutor_courses WHERE tutor_id = :tutor_id", {
            tutor_id: tutorId,
        });
        const courseIds = req.body.courseIds ?? [];
        for (const courseId of courseIds) {
            await (0, db_1.query)("INSERT INTO tutor_courses (id, tutor_id, course_id) VALUES (UUID(), :tutor_id, :course_id)", { tutor_id: tutorId, course_id: courseId });
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.get("/:id", async (req, res, next) => {
    try {
        const id = req.params.id;
        const tutors = await (0, db_1.query)(`SELECT 
          tp.id AS tutor_id,
          u.id AS user_id,
          p.first_name,
          p.last_name,
          p.display_name,
          p.avatar_url,
          p.phone,
          p.major,
          p.year_of_study,
          tp.headline,
          tp.about_me,
          tp.hourly_rate,
          tp.is_verified,
          tp.is_available,
          tp.is_featured,
          tp.average_rating,
          tp.total_reviews,
          tp.total_sessions,
          tp.total_hours
       FROM tutor_profiles tp
       JOIN users u ON tp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE tp.id = :id
         AND u.is_active = TRUE
         AND u.email_verified = TRUE`, { id });
        const tutor = tutors[0];
        if (!tutor) {
            return next((0, http_1.notFound)("Tutor not found"));
        }
        const courses = await (0, db_1.query)(`SELECT c.id, c.name, c.code, d.name AS department
       FROM tutor_courses tc
       JOIN courses c ON tc.course_id = c.id
       JOIN departments d ON c.department_id = d.id
       WHERE tc.tutor_id = :id
       ORDER BY c.name`, { id });
        const reviews = await (0, db_1.query)(`SELECT r.id, r.overall_rating, r.review_text, r.created_at,
              p.first_name, p.last_name, p.avatar_url
       FROM reviews r
       JOIN profiles p ON r.tutee_id = p.user_id
       WHERE r.tutor_id = :id AND r.is_visible = TRUE
       ORDER BY r.created_at DESC
       LIMIT 10`, { id });
        res.json({ tutor, courses, reviews });
    }
    catch (err) {
        next(err);
    }
});
router.get("/:id/availability", async (req, res, next) => {
    try {
        const id = req.params.id;
        const date = req.query.date;
        if (!date) {
            return next((0, http_1.badRequest)("date is required"));
        }
        const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        const rows = await (0, db_1.query)(`SELECT 
          ta.start_time,
          ta.end_time
       FROM tutor_availability ta
       JOIN tutor_profiles tp ON ta.tutor_id = tp.id
       JOIN users u ON tp.user_id = u.id
       WHERE ta.tutor_id = :tutor_id
         AND u.is_active = TRUE
         AND u.email_verified = TRUE
         AND ta.day_of_week = :day_of_week
         AND (ta.effective_from IS NULL OR ta.effective_from <= :date)
         AND (ta.effective_until IS NULL OR ta.effective_until >= :date)
         AND NOT EXISTS (
         SELECT 1 FROM tutor_blocked_dates tbd
         WHERE tbd.tutor_id = :tutor_id
           AND tbd.blocked_date = :date
           AND (
             (tbd.start_time IS NULL) OR
             (ta.start_time < tbd.end_time AND ta.end_time > tbd.start_time)
           )
        )
        AND NOT EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.tutor_id = :tutor_id
            AND s.session_date = :date
            AND s.status IN ('pending','confirmed','in_progress')
            AND (ta.start_time < s.end_time AND ta.end_time > s.start_time)
        )`, { tutor_id: id, date, day_of_week: dayOfWeek });
        res.json({ data: rows ?? [] });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
