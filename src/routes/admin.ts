import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roles";
import { query } from "../db";
import { badRequest, notFound } from "../utils/http";
import { validate } from "../middleware/validate";

const router = Router();

router.use(requireAuth, requireRole(["admin"]));

router.get("/applications", async (_req, res, next) => {
  try {
    const rows = await query<any[]>(
      `SELECT tp.id AS tutor_id, p.first_name, p.last_name, p.gpa, tp.created_at
       FROM tutor_profiles tp
       JOIN profiles p ON tp.user_id = p.user_id
       WHERE tp.is_verified = FALSE
       ORDER BY tp.created_at DESC
       LIMIT 50`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

router.get("/reports", async (_req, res, next) => {
  try {
    const rows = await query<any[]>(
      `SELECT r.id, r.type, r.status, r.created_at, p.first_name, p.last_name
       FROM reports r
       JOIN profiles p ON r.reporter_id = p.user_id
       ORDER BY r.created_at DESC
       LIMIT 50`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

const departmentSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1).max(10),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

const departmentUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).max(10).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});

router.get("/departments", async (_req, res, next) => {
  try {
    const rows = await query<any[]>(
      "SELECT id, name, code, description, is_active, created_at FROM departments ORDER BY name"
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/departments", validate(departmentSchema), async (req, res, next) => {
  try {
    const idRows = await query<any[]>("SELECT UUID() as id");
    const id = idRows[0]?.id;
    await query(
      `INSERT INTO departments (id, name, code, description, is_active)
       VALUES (:id, :name, :code, :description, :is_active)`,
      {
        id,
        name: req.body.name,
        code: req.body.code,
        description: req.body.description ?? null,
        is_active: typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : 1,
      }
    );
    res.status(201).json({ id });
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/departments/:id", validate(departmentUpdateSchema), async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await query<any>(
      `UPDATE departments
       SET name = COALESCE(:name, name),
           code = COALESCE(:code, code),
           description = COALESCE(:description, description),
           is_active = COALESCE(:is_active, is_active)
       WHERE id = :id`,
      {
        id,
        name: req.body.name ?? null,
        code: req.body.code ?? null,
        description: req.body.description ?? null,
        is_active:
          typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : null,
      }
    );
    if (result.affectedRows === 0) {
      throw notFound("Department not found");
    }
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.delete("/departments/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await query<any>(
      "UPDATE departments SET is_active = FALSE WHERE id = :id",
      { id }
    );
    if (result.affectedRows === 0) {
      throw notFound("Department not found");
    }
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

const courseSchema = z.object({
  body: z.object({
    departmentId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    credits: z.number().int().optional(),
    difficultyLevel: z.enum(["introductory", "intermediate", "advanced", "graduate"]).optional(),
    isActive: z.boolean().optional(),
  }),
});

const courseUpdateSchema = z.object({
  body: z.object({
    departmentId: z.string().uuid().optional(),
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    credits: z.number().int().optional(),
    difficultyLevel: z.enum(["introductory", "intermediate", "advanced", "graduate"]).optional(),
    isActive: z.boolean().optional(),
  }),
});

router.get("/courses", async (req, res, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const rows = await query<any[]>(
      `SELECT id, department_id, code, name, description, credits, difficulty_level, is_active
       FROM courses
       WHERE (:departmentId IS NULL OR department_id = :departmentId)
       ORDER BY name`,
      { departmentId: departmentId ?? null }
    );
    res.json({ data: rows });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/courses", validate(courseSchema), async (req, res, next) => {
  try {
    const idRows = await query<any[]>("SELECT UUID() as id");
    const id = idRows[0]?.id;
    await query(
      `INSERT INTO courses (id, department_id, code, name, description, credits, difficulty_level, is_active)
       VALUES (:id, :department_id, :code, :name, :description, :credits, :difficulty_level, :is_active)`,
      {
        id,
        department_id: req.body.departmentId,
        code: req.body.code,
        name: req.body.name,
        description: req.body.description ?? null,
        credits: req.body.credits ?? 3,
        difficulty_level: req.body.difficultyLevel ?? "intermediate",
        is_active: typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : 1,
      }
    );
    res.status(201).json({ id });
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/courses/:id", validate(courseUpdateSchema), async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await query<any>(
      `UPDATE courses
       SET department_id = COALESCE(:department_id, department_id),
           code = COALESCE(:code, code),
           name = COALESCE(:name, name),
           description = COALESCE(:description, description),
           credits = COALESCE(:credits, credits),
           difficulty_level = COALESCE(:difficulty_level, difficulty_level),
           is_active = COALESCE(:is_active, is_active)
       WHERE id = :id`,
      {
        id,
        department_id: req.body.departmentId ?? null,
        code: req.body.code ?? null,
        name: req.body.name ?? null,
        description: req.body.description ?? null,
        credits: req.body.credits ?? null,
        difficulty_level: req.body.difficultyLevel ?? null,
        is_active:
          typeof req.body.isActive === "boolean" ? (req.body.isActive ? 1 : 0) : null,
      }
    );
    if (result.affectedRows === 0) {
      throw notFound("Course not found");
    }
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.delete("/courses/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await query<any>(
      "UPDATE courses SET is_active = FALSE WHERE id = :id",
      { id }
    );
    if (result.affectedRows === 0) {
      throw notFound("Course not found");
    }
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const search = (req.query.search as string | undefined) ?? null;
    const rows = await query<any[]>(
      `SELECT u.id, u.email, u.is_active, p.first_name, p.last_name, tp.is_featured
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       LEFT JOIN tutor_profiles tp ON u.id = tp.user_id
       WHERE (:search IS NULL OR u.email LIKE CONCAT('%', :search, '%') 
              OR p.first_name LIKE CONCAT('%', :search, '%')
              OR p.last_name LIKE CONCAT('%', :search, '%'))
       ORDER BY u.created_at DESC
       LIMIT 100`,
      { search }
    );
    const roles = await query<any[]>(
      `SELECT user_id, role FROM user_roles`
    );
    const roleMap = roles.reduce<Record<string, string[]>>((acc, row) => {
      acc[row.user_id] = acc[row.user_id] || [];
      acc[row.user_id].push(row.role);
      return acc;
    }, {});
    const data = rows.map((row) => ({
      ...row,
      roles: roleMap[row.id] ?? [],
    }));
    res.json({ data });
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const isActive = req.body?.isActive;
    if (typeof isActive !== "boolean") {
      throw badRequest("isActive is required");
    }
    const result = await query<any>(
      "UPDATE users SET is_active = :is_active WHERE id = :id",
      { id, is_active: isActive ? 1 : 0 }
    );
    if (result.affectedRows === 0) {
      throw notFound("User not found");
    }
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/tutors/:id/feature", async (req, res, next) => {
  try {
    const userId = req.params.id;
    const isFeatured = req.body?.isFeatured;
    if (typeof isFeatured !== "boolean") {
      throw badRequest("isFeatured is required");
    }
    const result = await query<any>(
      `UPDATE tutor_profiles
       SET is_featured = :is_featured
       WHERE user_id = :user_id`,
      { user_id: userId, is_featured: isFeatured }
    );
    if (result.affectedRows === 0) {
      throw notFound("Tutor profile not found");
    }
    await query(
      `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_values)
       VALUES (:admin_id, 'feature_tutor', 'tutor_profiles', :entity_id, JSON_OBJECT('is_featured', :is_featured))`,
      { admin_id: req.user!.id, entity_id: userId, is_featured: isFeatured }
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post("/users/:id/roles", async (req, res, next) => {
  try {
    const id = req.params.id;
    const role = req.body?.role as string | undefined;
    if (!role || !["admin", "tutor", "tutee"].includes(role)) {
      throw badRequest("role is required");
    }
    await query(
      "INSERT IGNORE INTO user_roles (user_id, role) VALUES (:user_id, :role)",
      { user_id: id, role }
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.delete("/users/:id/roles/:role", async (req, res, next) => {
  try {
    const id = req.params.id;
    const role = req.params.role;
    if (!["admin", "tutor", "tutee"].includes(role)) {
      throw badRequest("Invalid role");
    }
    await query(
      "DELETE FROM user_roles WHERE user_id = :user_id AND role = :role",
      { user_id: id, role }
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/tutors/:id/approve", async (req, res, next) => {
  try {
    const tutorId = req.params.id;
    const adminId = req.user!.id;
    const result = await query<any>(
      `UPDATE tutor_profiles
       SET is_verified = TRUE, verification_date = NOW(), verified_by = :admin_id
       WHERE id = :id`,
      { id: tutorId, admin_id: adminId }
    );
    if (result.affectedRows === 0) {
      throw notFound("Tutor application not found");
    }
    await query(
      `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_values)
       VALUES (:admin_id, 'approve_tutor', 'tutor_profiles', :entity_id, JSON_OBJECT('is_verified', true))`,
      { admin_id: adminId, entity_id: tutorId }
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/reports/:id/resolve", async (req, res, next) => {
  try {
    const reportId = req.params.id;
    const adminId = req.user!.id;
    const resolution = (req.body?.resolution as string | undefined) ?? "";
    if (!resolution) {
      throw badRequest("resolution is required");
    }
    const result = await query<any>(
      `UPDATE reports
       SET status = 'resolved', resolution = :resolution, resolved_by = :admin_id, resolved_at = NOW()
       WHERE id = :id`,
      { id: reportId, resolution, admin_id: adminId }
    );
    if (result.affectedRows === 0) {
      throw notFound("Report not found");
    }
    await query(
      `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_values)
       VALUES (:admin_id, 'resolve_report', 'reports', :entity_id, JSON_OBJECT('status', 'resolved'))`,
      { admin_id: adminId, entity_id: reportId }
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

export default router;
