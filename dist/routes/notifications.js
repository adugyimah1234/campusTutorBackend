"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const zod_1 = require("zod");
const notification_service_1 = require("../services/notification-service");
const router = (0, express_1.Router)();
const markReadSchema = zod_1.z.object({
    body: zod_1.z.object({
        ids: zod_1.z.array(zod_1.z.string().uuid()).min(1),
    }),
});
router.get("/", auth_1.requireAuth, async (req, res, next) => {
    try {
        const notifications = await (0, notification_service_1.listNotifications)(req.user.id);
        res.json({ data: notifications });
    }
    catch (err) {
        next(err);
    }
});
router.post("/mark-read", auth_1.requireAuth, (0, validate_1.validate)(markReadSchema), async (req, res, next) => {
    try {
        await (0, notification_service_1.markNotificationsRead)(req.user.id, req.body.ids);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
