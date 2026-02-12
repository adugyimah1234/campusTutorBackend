"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get("/departments", async (_req, res, next) => {
    try {
        const rows = await (0, db_1.query)("SELECT id, name, code FROM departments WHERE is_active = TRUE ORDER BY name");
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get("/courses", async (req, res, next) => {
    try {
        const departmentId = req.query.departmentId;
        const rows = await (0, db_1.query)(`SELECT id, name, code, department_id 
       FROM courses 
       WHERE is_active = TRUE AND (:departmentId IS NULL OR department_id = :departmentId)
       ORDER BY name`, { departmentId: departmentId ?? null });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
