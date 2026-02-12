"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const validate_1 = require("../middleware/validate");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    body: zod_1.z.object({
        dayOfWeek: zod_1.z.enum([
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]),
        startTime: zod_1.z.string(),
        endTime: zod_1.z.string(),
        isRecurring: zod_1.z.boolean().default(true),
    }),
});
router.get("/", auth_1.requireAuth, (0, roles_1.requireRole)(["tutor", "admin"]), async (req, res, next) => {
    try {
        const tutor = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
        const tutorId = tutor[0]?.id;
        if (!tutorId) {
            throw (0, http_1.badRequest)("Tutor profile not found");
        }
        const rows = await (0, db_1.query)(`SELECT id, day_of_week, start_time, end_time, is_recurring
       FROM tutor_availability
       WHERE tutor_id = :tutor_id
       ORDER BY FIELD(day_of_week,'monday','tuesday','wednesday','thursday','friday','saturday','sunday'), start_time`, { tutor_id: tutorId });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.post("/", auth_1.requireAuth, (0, roles_1.requireRole)(["tutor", "admin"]), (0, validate_1.validate)(createSchema), async (req, res, next) => {
    try {
        const tutor = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
        const tutorId = tutor[0]?.id;
        if (!tutorId) {
            throw (0, http_1.badRequest)("Tutor profile not found");
        }
        const slotIdRows = await (0, db_1.query)("SELECT UUID() as id");
        const slotId = slotIdRows[0]?.id;
        await (0, db_1.query)(`INSERT INTO tutor_availability (id, tutor_id, day_of_week, start_time, end_time, is_recurring)
       VALUES (:id, :tutor_id, :day_of_week, :start_time, :end_time, :is_recurring)`, {
            id: slotId,
            tutor_id: tutorId,
            day_of_week: req.body.dayOfWeek,
            start_time: req.body.startTime,
            end_time: req.body.endTime,
            is_recurring: req.body.isRecurring ? 1 : 0,
        });
        res.status(201).json({ id: slotId });
    }
    catch (err) {
        next(err);
    }
});
router.delete("/:id", auth_1.requireAuth, (0, roles_1.requireRole)(["tutor", "admin"]), async (req, res, next) => {
    try {
        const tutor = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
        const tutorId = tutor[0]?.id;
        if (!tutorId) {
            throw (0, http_1.badRequest)("Tutor profile not found");
        }
        await (0, db_1.query)("DELETE FROM tutor_availability WHERE id = :id AND tutor_id = :tutor_id", { id: req.params.id, tutor_id: tutorId });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
