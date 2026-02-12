"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const mailer_1 = require("../utils/mailer");
const router = (0, express_1.Router)();
const contactSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(120),
        email: zod_1.z.string().email().max(200),
        message: zod_1.z.string().min(10).max(4000),
    }),
});
router.post("/", (0, validate_1.validate)(contactSchema), async (req, res, next) => {
    try {
        const { name, email, message } = req.body;
        await (0, mailer_1.sendContactEmail)({ name, email, message });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
