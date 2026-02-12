"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const verified_1 = require("../middleware/verified");
const validate_1 = require("../middleware/validate");
const db_1 = require("../db");
const http_1 = require("../utils/http");
const auth_service_1 = require("../services/auth-service");
const mailer_1 = require("../utils/mailer");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const updateAvatarSchema = zod_1.z.object({
    body: zod_1.z.object({
        avatarData: zod_1.z.string().max(1_500_000).nullable(),
    }),
});
const updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: zod_1.z.string().min(1).max(100).optional(),
        lastName: zod_1.z.string().min(1).max(100).optional(),
        displayName: zod_1.z.string().max(100).nullable().optional(),
        phone: zod_1.z.string().max(20).nullable().optional(),
        bio: zod_1.z.string().max(1000).nullable().optional(),
    }),
});
const emailChangeSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email().max(255),
    }),
});
const confirmEmailChangeSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(10),
    }),
});
const requestDeleteSchema = zod_1.z.object({
    body: zod_1.z.object({}).optional(),
});
const confirmDeleteSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(10),
    }),
});
const avatarDir = path_1.default.resolve(process.cwd(), "uploads", "avatars");
const removeLocalAvatar = async (avatarUrl) => {
    if (!avatarUrl)
        return;
    try {
        const url = avatarUrl.startsWith("http") ? new URL(avatarUrl) : null;
        const pathname = url ? url.pathname : avatarUrl;
        if (!pathname.startsWith("/uploads/avatars/"))
            return;
        const fileName = path_1.default.basename(pathname);
        await promises_1.default.unlink(path_1.default.join(avatarDir, fileName));
    }
    catch {
        // ignore cleanup errors
    }
};
router.get("/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const rows = await (0, db_1.query)(`SELECT u.id, u.email, p.first_name, p.last_name, p.display_name, p.avatar_url, p.phone, p.bio
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id = :user_id`, { user_id: userId });
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ message: "Profile not found" });
        }
        res.json({
            userId: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            phone: user.phone,
            bio: user.bio,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post("/email-change", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(emailChangeSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const newEmail = req.body.email.trim();
        const currentRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: userId });
        const currentEmail = currentRows[0]?.email;
        if (!currentEmail) {
            return res.status(404).json({ message: "Profile not found" });
        }
        if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
            throw (0, http_1.badRequest)("New email must be different from your current email.");
        }
        const token = await (0, auth_service_1.requestEmailChange)(userId, newEmail);
        const confirmLink = `${env_1.env.FRONTEND_URL}/confirm-email-change?token=${token}`;
        await (0, mailer_1.sendEmailChangeVerificationEmail)({ to: newEmail, verifyLink: confirmLink });
        try {
            await (0, mailer_1.sendSecurityAlertEmail)({
                to: currentEmail,
                title: "Email change requested",
                message: `A request was made to change your email to ${newEmail}. If this was not you, please secure your account.`,
            });
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send email change security alert");
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.post("/confirm-email-change", (0, validate_1.validate)(confirmEmailChangeSchema), async (req, res, next) => {
    try {
        const result = await (0, auth_service_1.confirmEmailChange)(req.body.token);
        try {
            await (0, db_1.query)("UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE user_id = :user_id", { user_id: result.userId });
        }
        catch {
            // ignore if refresh_tokens table is not available
        }
        try {
            await (0, mailer_1.sendSecurityAlertEmail)({
                to: result.oldEmail,
                title: "Email updated",
                message: `Your CampusTutor email was changed to ${result.newEmail}. If this was not you, please contact support.`,
            });
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send email change confirmation");
        }
        res.json({ ok: true, email: result.newEmail });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/me", auth_1.requireAuth, (0, validate_1.validate)(updateProfileSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { firstName, lastName, displayName, phone, bio } = req.body;
        await (0, db_1.query)(`UPDATE profiles
       SET first_name = COALESCE(:first_name, first_name),
           last_name = COALESCE(:last_name, last_name),
           display_name = COALESCE(:display_name, display_name),
           phone = COALESCE(:phone, phone),
           bio = COALESCE(:bio, bio)
       WHERE user_id = :user_id`, {
            user_id: userId,
            first_name: firstName ?? null,
            last_name: lastName ?? null,
            display_name: displayName ?? null,
            phone: phone ?? null,
            bio: bio ?? null,
        });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/avatar", auth_1.requireAuth, (0, validate_1.validate)(updateAvatarSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const avatarData = req.body.avatarData;
        const current = await (0, db_1.query)("SELECT avatar_url FROM profiles WHERE user_id = :user_id", { user_id: userId });
        const currentAvatar = current[0]?.avatar_url ?? null;
        if (!avatarData) {
            await (0, db_1.query)("UPDATE profiles SET avatar_url = NULL WHERE user_id = :user_id", { user_id: userId });
            await removeLocalAvatar(currentAvatar);
            res.json({ avatarUrl: null });
            return;
        }
        const match = avatarData.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
        if (!match) {
            throw (0, http_1.badRequest)("Avatar must be a PNG, JPG, or WebP image.");
        }
        const [, extRaw, base64Data] = match;
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length > 1_000_000) {
            throw (0, http_1.badRequest)("Avatar image must be under 1MB.");
        }
        await promises_1.default.mkdir(avatarDir, { recursive: true });
        const ext = extRaw.toLowerCase() === "jpeg" ? "jpg" : extRaw.toLowerCase();
        const fileName = `avatar-${userId}-${crypto_1.default.randomUUID()}.${ext}`;
        const filePath = path_1.default.join(avatarDir, fileName);
        await promises_1.default.writeFile(filePath, buffer);
        const avatarUrl = `/uploads/avatars/${fileName}`;
        await (0, db_1.query)("UPDATE profiles SET avatar_url = :avatar_url WHERE user_id = :user_id", { avatar_url: avatarUrl, user_id: userId });
        await removeLocalAvatar(currentAvatar);
        res.json({ avatarUrl });
    }
    catch (err) {
        next(err);
    }
});
router.post("/request-delete", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(requestDeleteSchema), async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const rows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: userId });
        const email = rows[0]?.email;
        if (!email) {
            return res.status(404).json({ message: "Profile not found" });
        }
        const token = await (0, auth_service_1.requestAccountDeletion)(userId);
        const confirmLink = `${env_1.env.FRONTEND_URL}/confirm-account-deletion?token=${token}`;
        await (0, mailer_1.sendAccountDeletionEmail)({ to: email, confirmLink });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.post("/confirm-delete", (0, validate_1.validate)(confirmDeleteSchema), async (req, res, next) => {
    try {
        const result = await (0, auth_service_1.confirmAccountDeletion)(req.body.token);
        try {
            await (0, db_1.query)("UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE user_id = :user_id", { user_id: result.userId });
        }
        catch {
            // ignore if refresh_tokens table is not available
        }
        try {
            await (0, mailer_1.sendSecurityAlertEmail)({
                to: result.email,
                title: "Account deleted",
                message: "Your CampusTutor account has been deleted. If this was not you, contact support immediately.",
            });
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send account deletion confirmation");
        }
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.delete("/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const rows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: userId });
        const email = rows[0]?.email;
        if (!email) {
            return res.status(404).json({ message: "Profile not found" });
        }
        const token = await (0, auth_service_1.requestAccountDeletion)(userId);
        const confirmLink = `${env_1.env.FRONTEND_URL}/confirm-account-deletion?token=${token}`;
        await (0, mailer_1.sendAccountDeletionEmail)({ to: email, confirmLink });
        res.json({ ok: true, message: "Confirmation email sent." });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
