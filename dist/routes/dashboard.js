"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const dashboard_service_1 = require("../services/dashboard-service");
const router = (0, express_1.Router)();
router.get("/tutee", auth_1.requireAuth, (0, roles_1.requireRole)(["tutee", "admin"]), async (req, res, next) => {
    try {
        const data = await (0, dashboard_service_1.getTuteeDashboard)(req.user.id);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get("/tutor", auth_1.requireAuth, (0, roles_1.requireRole)(["tutor", "admin"]), async (req, res, next) => {
    try {
        const range = typeof req.query.range === "string" ? req.query.range : undefined;
        const data = await (0, dashboard_service_1.getTutorDashboard)(req.user.id, range);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get("/admin", auth_1.requireAuth, (0, roles_1.requireRole)(["admin"]), async (_req, res, next) => {
    try {
        const data = await (0, dashboard_service_1.getAdminDashboard)();
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
