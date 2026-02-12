"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validate_1 = require("../middleware/validate");
const env_1 = require("../config/env");
const auth_service_1 = require("../services/auth-service");
const mailer_1 = require("../utils/mailer");
const rate_limit_1 = require("../middleware/rate-limit");
const http_1 = require("../utils/http");
const logger_1 = require("../config/logger");
const db_1 = require("../db");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(8),
        firstName: zod_1.z.string().min(1),
        lastName: zod_1.z.string().min(1),
        role: zod_1.z.enum(["tutee", "tutor", "admin"]).default("tutee"),
    }),
});
const loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(8),
    }),
});
const refreshSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(20),
    }),
});
const forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
    }),
});
const resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(10),
        password: zod_1.z.string().min(8),
    }),
});
const verifyEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(10),
    }),
});
const resendVerificationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
    }),
});
router.post("/register", rate_limit_1.authRateLimiter, (0, validate_1.validate)(registerSchema), async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        const userId = await (0, auth_service_1.registerUser)({ email, password, firstName, lastName, role });
        try {
            const verificationToken = await (0, auth_service_1.createEmailVerificationToken)(userId);
            const verifyLink = `${env_1.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
            await (0, mailer_1.sendEmailVerificationEmail)(email, verifyLink);
        }
        catch (err) {
            await (0, auth_service_1.deleteUser)(userId);
            throw (0, http_1.badRequest)("Unable to send verification email. Please try again.");
        }
        res.status(201).json({ userId });
    }
    catch (err) {
        next(err);
    }
});
router.post("/login", rate_limit_1.authRateLimiter, (0, validate_1.validate)(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await (0, auth_service_1.loginUser)(email, password);
        try {
            const userAgent = req.headers["user-agent"] ?? "Unknown device";
            const ip = req.ip ?? "Unknown IP";
            await (0, mailer_1.sendSecurityAlertEmail)({
                to: email,
                title: "New login to your CampusTutor account",
                message: `We detected a new login. IP: ${ip}. Device: ${userAgent}.`,
            });
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send login security alert email");
        }
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post("/refresh", (0, validate_1.validate)(refreshSchema), async (req, res, next) => {
    try {
        const result = await (0, auth_service_1.rotateRefreshToken)(req.body.refreshToken);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post("/logout", (0, validate_1.validate)(refreshSchema), async (req, res, next) => {
    try {
        await (0, auth_service_1.revokeRefreshToken)(req.body.refreshToken);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
router.post("/forgot-password", rate_limit_1.authRateLimiter, (0, validate_1.validate)(forgotPasswordSchema), async (req, res, next) => {
    try {
        const token = await (0, auth_service_1.requestPasswordReset)(req.body.email);
        if (token) {
            const resetLink = `${env_1.env.FRONTEND_URL}/reset-password?token=${token}`;
            await (0, mailer_1.sendPasswordResetEmail)(req.body.email, resetLink);
        }
        res.json({ message: "If the account exists, a reset link has been sent." });
    }
    catch (err) {
        next(err);
    }
});
router.post("/reset-password", rate_limit_1.authRateLimiter, (0, validate_1.validate)(resetPasswordSchema), async (req, res, next) => {
    try {
        const userId = await (0, auth_service_1.resetPassword)(req.body.token, req.body.password);
        try {
            const rows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: userId });
            if (rows[0]) {
                await (0, mailer_1.sendSecurityAlertEmail)({
                    to: rows[0].email,
                    title: "Your CampusTutor password was changed",
                    message: "Your password was just updated. If this was not you, please reset it immediately.",
                });
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send password change email");
        }
        res.json({ message: "Password reset successful" });
    }
    catch (err) {
        next(err);
    }
});
router.post("/verify-email", rate_limit_1.authRateLimiter, (0, validate_1.validate)(verifyEmailSchema), async (req, res, next) => {
    try {
        await (0, auth_service_1.verifyEmail)(req.body.token);
        res.json({ message: "Email verified" });
    }
    catch (err) {
        next(err);
    }
});
router.post("/resend-verification", rate_limit_1.authRateLimiter, (0, validate_1.validate)(resendVerificationSchema), async (req, res, next) => {
    try {
        const token = await (0, auth_service_1.requestEmailVerification)(req.body.email);
        if (token) {
            try {
                const verifyLink = `${env_1.env.FRONTEND_URL}/verify-email?token=${token}`;
                await (0, mailer_1.sendEmailVerificationEmail)(req.body.email, verifyLink);
            }
            catch (err) {
                throw (0, http_1.badRequest)("Unable to send verification email. Please try again.");
            }
        }
        res.json({ message: "If the account exists, a verification email has been sent." });
    }
    catch (err) {
        next(err);
    }
});
router.get("/verify-email", rate_limit_1.authRateLimiter, async (req, res, next) => {
    const token = typeof req.query.token === "string" ? req.query.token : null;
    if (!token) {
        res.redirect(`${env_1.env.FRONTEND_URL}/auth`);
        return;
    }
    try {
        await (0, auth_service_1.verifyEmail)(token);
        res.redirect(`${env_1.env.FRONTEND_URL}/auth`);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
