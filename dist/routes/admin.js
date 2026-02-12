"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, roles_1.requireRole)(["admin"]));
router.get("/applications", async (_req, res, next) => {
    try {
        const rows = await (0, db_1.query)(`SELECT tp.id AS tutor_id, p.first_name, p.last_name, p.gpa, tp.created_at
       FROM tutor_profiles tp
       JOIN profiles p ON tp.user_id = p.user_id
       WHERE tp.is_verified = FALSE
       ORDER BY tp.created_at DESC
       LIMIT 50`);
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get("/reports", async (_req, res, next) => {
    try {
        const rows = await (0, db_1.query)(`SELECT r.id, r.type, r.status, r.created_at, p.first_name, p.last_name
       FROM reports r
       JOIN profiles p ON r.reporter_id = p.user_id
       ORDER BY r.created_at DESC
       LIMIT 50`);
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
const departmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1),
        code: zod_1.z.string().min(1).max(10),
        description: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
const departmentUpdateSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        code: zod_1.z.string().min(1).max(10).optional(),
        description: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
router.get("/departments", async (_req, res, next) => {
    try {
        const rows = await (0, db_1.query)("SELECT id, name, code, description, is_active, created_at FROM departments ORDER BY name");
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.post("/departments", (0, validate_1.validate)(departmentSchema), async (req, res, next) => {
    try {
        const idRows = await (0, db_1.query)("SELECT UUID() as id");
        const id = idRows[0]?.id;
        await (0, db_1.query)(`INSERT INTO departments (id, name, code, description, is_active)
       VALUES (:id, :name, :code, :description, :is_active)`, {
            id,
            name: req.body.name,
            code: req.body.code,
            description: req.body.description ?? null,
            is_active: typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : 1,
        });
        res.status(201).json({ id });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/departments/:id", (0, validate_1.validate)(departmentUpdateSchema), async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await (0, db_1.query)(`UPDATE departments
       SET name = COALESCE(:name, name),
           code = COALESCE(:code, code),
           description = COALESCE(:description, description),
           is_active = COALESCE(:is_active, is_active)
       WHERE id = :id`, {
            id,
            name: req.body.name ?? null,
            code: req.body.code ?? null,
            description: req.body.description ?? null,
            is_active: typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : null,
        });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Department not found");
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.delete("/departments/:id", async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await (0, db_1.query)("UPDATE departments SET is_active = FALSE WHERE id = :id", { id });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Department not found");
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
const courseSchema = zod_1.z.object({
    body: zod_1.z.object({
        departmentId: zod_1.z.string().uuid(),
        code: zod_1.z.string().min(1),
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        credits: zod_1.z.number().int().optional(),
        difficultyLevel: zod_1.z.enum(["introductory", "intermediate", "advanced", "graduate"]).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
const courseUpdateSchema = zod_1.z.object({
    body: zod_1.z.object({
        departmentId: zod_1.z.string().uuid().optional(),
        code: zod_1.z.string().min(1).optional(),
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        credits: zod_1.z.number().int().optional(),
        difficultyLevel: zod_1.z.enum(["introductory", "intermediate", "advanced", "graduate"]).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
router.get("/courses", async (req, res, next) => {
    try {
        const departmentId = req.query.departmentId;
        const rows = await (0, db_1.query)(`SELECT id, department_id, code, name, description, credits, difficulty_level, is_active
       FROM courses
       WHERE (:departmentId IS NULL OR department_id = :departmentId)
       ORDER BY name`, { departmentId: departmentId ?? null });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.post("/courses", (0, validate_1.validate)(courseSchema), async (req, res, next) => {
    try {
        const idRows = await (0, db_1.query)("SELECT UUID() as id");
        const id = idRows[0]?.id;
        await (0, db_1.query)(`INSERT INTO courses (id, department_id, code, name, description, credits, difficulty_level, is_active)
       VALUES (:id, :department_id, :code, :name, :description, :credits, :difficulty_level, :is_active)`, {
            id,
            department_id: req.body.departmentId,
            code: req.body.code,
            name: req.body.name,
            description: req.body.description ?? null,
            credits: req.body.credits ?? 3,
            difficulty_level: req.body.difficultyLevel ?? "intermediate",
            is_active: typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : 1,
        });
        res.status(201).json({ id });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/courses/:id", (0, validate_1.validate)(courseUpdateSchema), async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await (0, db_1.query)(`UPDATE courses
       SET department_id = COALESCE(:department_id, department_id),
           code = COALESCE(:code, code),
           name = COALESCE(:name, name),
           description = COALESCE(:description, description),
           credits = COALESCE(:credits, credits),
           difficulty_level = COALESCE(:difficulty_level, difficulty_level),
           is_active = COALESCE(:is_active, is_active)
       WHERE id = :id`, {
            id,
            department_id: req.body.departmentId ?? null,
            code: req.body.code ?? null,
            name: req.body.name ?? null,
            description: req.body.description ?? null,
            credits: req.body.credits ?? null,
            difficulty_level: req.body.difficultyLevel ?? null,
            is_active: typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : null,
        });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Course not found");
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.delete("/courses/:id", async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await (0, db_1.query)("UPDATE courses SET is_active = FALSE WHERE id = :id", { id });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Course not found");
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.get("/users", async (req, res, next) => {
    try {
        const search = req.query.search ?? null;
        const rows = await (0, db_1.query)(`SELECT u.id, u.email, u.is_active, p.first_name, p.last_name, tp.is_featured
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN tutor_profiles tp ON u.id = tp.user_id
       WHERE (:search IS NULL OR u.email LIKE CONCAT('%', :search, '%') 
              OR p.first_name LIKE CONCAT('%', :search, '%')
              OR p.last_name LIKE CONCAT('%', :search, '%'))
       ORDER BY u.created_at DESC
       LIMIT 100`, { search });
        const roles = await (0, db_1.query)(`SELECT user_id, role FROM user_roles`);
        const roleMap = roles.reduce((acc, row) => {
            acc[row.user_id] = acc[row.user_id] || [];
            acc[row.user_id].push(row.role);
            return acc;
        }, {});
        const data = rows.map((row) => ({
            ...row,
            roles: roleMap[row.id] ?? [],
        }));
        res.json({ data });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/users/:id", async (req, res, next) => {
    try {
        const id = req.params.id;
        const isActive = req.body?.isActive;
        if (typeof isActive !== "boolean") {
            throw (0, http_1.badRequest)("isActive is required");
        }
        const result = await (0, db_1.query)("UPDATE users SET is_active = :is_active WHERE id = :id", { id, is_active: isActive ? 1 : 0 });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("User not found");
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.patch("/tutors/:id/feature", async (req, res, next) => {
    try {
        const userId = req.params.id;
        const isFeatured = req.body?.isFeatured;
        if (typeof isFeatured !== "boolean") {
            throw (0, http_1.badRequest)("isFeatured is required");
        }
        const result = await (0, db_1.query)(`UPDATE tutor_profiles
       SET is_featured = :is_featured
       WHERE user_id = :user_id`, { user_id: userId, is_featured: isFeatured });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Tutor profile not found");
        }
        await (0, db_1.query)(`INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_values)
       VALUES (:admin_id, 'feature_tutor', 'tutor_profiles', :entity_id, JSON_OBJECT('is_featured', :is_featured))`, { admin_id: req.user.id, entity_id: userId, is_featured: isFeatured });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.post("/users/:id/roles", async (req, res, next) => {
    try {
        const id = req.params.id;
        const role = req.body?.role;
        if (!role || !["admin", "tutor", "tutee"].includes(role)) {
            throw (0, http_1.badRequest)("role is required");
        }
        await (0, db_1.query)("INSERT IGNORE INTO user_roles (user_id, role) VALUES (:user_id, :role)", { user_id: id, role });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.delete("/users/:id/roles/:role", async (req, res, next) => {
    try {
        const id = req.params.id;
        const role = req.params.role;
        if (!["admin", "tutor", "tutee"].includes(role)) {
            throw (0, http_1.badRequest)("Invalid role");
        }
        await (0, db_1.query)("DELETE FROM user_roles WHERE user_id = :user_id AND role = :role", { user_id: id, role });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.patch("/tutors/:id/approve", async (req, res, next) => {
    try {
        const tutorId = req.params.id;
        const adminId = req.user.id;
        const result = await (0, db_1.query)(`UPDATE tutor_profiles
       SET is_verified = TRUE, verification_date = NOW(), verified_by = :admin_id
       WHERE id = :id`, { id: tutorId, admin_id: adminId });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Tutor application not found");
        }
        await (0, db_1.query)(`INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_values)
       VALUES (:admin_id, 'approve_tutor', 'tutor_profiles', :entity_id, JSON_OBJECT('is_verified', true))`, { admin_id: adminId, entity_id: tutorId });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.patch("/reports/:id/resolve", async (req, res, next) => {
    try {
        const reportId = req.params.id;
        const adminId = req.user.id;
        const resolution = req.body?.resolution ?? "";
        if (!resolution) {
            throw (0, http_1.badRequest)("resolution is required");
        }
        const result = await (0, db_1.query)(`UPDATE reports
       SET status = 'resolved', resolution = :resolution, resolved_by = :admin_id, resolved_at = NOW()
       WHERE id = :id`, { id: reportId, resolution, admin_id: adminId });
        if (result.affectedRows === 0) {
            throw (0, http_1.notFound)("Report not found");
        }
        await (0, db_1.query)(`INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_values)
       VALUES (:admin_id, 'resolve_report', 'reports', :entity_id, JSON_OBJECT('status', 'resolved'))`, { admin_id: adminId, entity_id: reportId });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
