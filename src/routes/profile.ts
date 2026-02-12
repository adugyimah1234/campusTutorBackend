import { Router } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireVerified } from "../middleware/verified";
import { validate } from "../middleware/validate";
import { query } from "../db";
import { badRequest } from "../utils/http";
import {
  confirmAccountDeletion,
  confirmEmailChange,
  requestAccountDeletion,
  requestEmailChange,
} from "../services/auth-service";
import {
  sendAccountDeletionEmail,
  sendEmailChangeVerificationEmail,
  sendSecurityAlertEmail,
} from "../utils/mailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const router = Router();

const updateAvatarSchema = z.object({
  body: z.object({
    avatarData: z.string().max(1_500_000).nullable(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    displayName: z.string().max(100).nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
    bio: z.string().max(1000).nullable().optional(),
  }),
});

const emailChangeSchema = z.object({
  body: z.object({
    email: z.string().email().max(255),
  }),
});

const confirmEmailChangeSchema = z.object({
  body: z.object({
    token: z.string().min(10),
  }),
});

const requestDeleteSchema = z.object({
  body: z.object({}).optional(),
});

const confirmDeleteSchema = z.object({
  body: z.object({
    token: z.string().min(10),
  }),
});

const avatarDir = path.resolve(process.cwd(), "uploads", "avatars");

const removeLocalAvatar = async (avatarUrl: string | null) => {
  if (!avatarUrl) return;
  try {
    const url = avatarUrl.startsWith("http") ? new URL(avatarUrl) : null;
    const pathname = url ? url.pathname : avatarUrl;
    if (!pathname.startsWith("/uploads/avatars/")) return;
    const fileName = path.basename(pathname);
    await fs.unlink(path.join(avatarDir, fileName));
  } catch {
    // ignore cleanup errors
  }
};

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const rows = await query<
      {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        display_name: string | null;
        avatar_url: string | null;
        phone: string | null;
        bio: string | null;
      }[]
    >(
      `SELECT u.id, u.email, p.first_name, p.last_name, p.display_name, p.avatar_url, p.phone, p.bio
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id = :user_id`,
      { user_id: userId }
    );
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
  } catch (err) {
    next(err as Error);
  }
});

router.post(
  "/email-change",
  requireAuth,
  requireVerified,
  validate(emailChangeSchema),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const newEmail = req.body.email.trim();
      const currentRows = await query<{ email: string }[]>(
        "SELECT email FROM users WHERE id = :id",
        { id: userId }
      );
      const currentEmail = currentRows[0]?.email;
      if (!currentEmail) {
        return res.status(404).json({ message: "Profile not found" });
      }
      if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
        throw badRequest("New email must be different from your current email.");
      }
      const token = await requestEmailChange(userId!, newEmail);
      const confirmLink = `${env.FRONTEND_URL}/confirm-email-change?token=${token}`;
      await sendEmailChangeVerificationEmail({ to: newEmail, verifyLink: confirmLink });
      try {
        await sendSecurityAlertEmail({
          to: currentEmail,
          title: "Email change requested",
          message: `A request was made to change your email to ${newEmail}. If this was not you, please secure your account.`,
        });
      } catch (err) {
        logger.warn({ err }, "Failed to send email change security alert");
      }
      res.json({ ok: true });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.post("/confirm-email-change", validate(confirmEmailChangeSchema), async (req, res, next) => {
  try {
    const result = await confirmEmailChange(req.body.token);
    try {
      await query(
        "UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE user_id = :user_id",
        { user_id: result.userId }
      );
    } catch {
      // ignore if refresh_tokens table is not available
    }
    try {
      await sendSecurityAlertEmail({
        to: result.oldEmail,
        title: "Email updated",
        message: `Your CampusTutor email was changed to ${result.newEmail}. If this was not you, please contact support.`,
      });
    } catch (err) {
      logger.warn({ err }, "Failed to send email change confirmation");
    }
    res.json({ ok: true, email: result.newEmail });
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/me", requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, displayName, phone, bio } = req.body;
    await query(
      `UPDATE profiles
       SET first_name = COALESCE(:first_name, first_name),
           last_name = COALESCE(:last_name, last_name),
           display_name = COALESCE(:display_name, display_name),
           phone = COALESCE(:phone, phone),
           bio = COALESCE(:bio, bio)
       WHERE user_id = :user_id`,
      {
        user_id: userId,
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        display_name: displayName ?? null,
        phone: phone ?? null,
        bio: bio ?? null,
      }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err as Error);
  }
});

router.patch("/avatar", requireAuth, validate(updateAvatarSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const avatarData = req.body.avatarData as string | null;
    const current = await query<{ avatar_url: string | null }[]>(
      "SELECT avatar_url FROM profiles WHERE user_id = :user_id",
      { user_id: userId }
    );
    const currentAvatar = current[0]?.avatar_url ?? null;

    if (!avatarData) {
      await query(
        "UPDATE profiles SET avatar_url = NULL WHERE user_id = :user_id",
        { user_id: userId }
      );
      await removeLocalAvatar(currentAvatar);
      res.json({ avatarUrl: null });
      return;
    }

    const match = avatarData.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!match) {
      throw badRequest("Avatar must be a PNG, JPG, or WebP image.");
    }
    const [, extRaw, base64Data] = match;
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > 1_000_000) {
      throw badRequest("Avatar image must be under 1MB.");
    }

    await fs.mkdir(avatarDir, { recursive: true });
    const ext = extRaw.toLowerCase() === "jpeg" ? "jpg" : extRaw.toLowerCase();
    const fileName = `avatar-${userId}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(avatarDir, fileName);
    await fs.writeFile(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}`;

    await query(
      "UPDATE profiles SET avatar_url = :avatar_url WHERE user_id = :user_id",
      { avatar_url: avatarUrl, user_id: userId }
    );
    await removeLocalAvatar(currentAvatar);
    res.json({ avatarUrl });
  } catch (err) {
    next(err as Error);
  }
});

router.post(
  "/request-delete",
  requireAuth,
  requireVerified,
  validate(requestDeleteSchema),
  async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const rows = await query<{ email: string }[]>(
        "SELECT email FROM users WHERE id = :id",
        { id: userId }
      );
      const email = rows[0]?.email;
      if (!email) {
        return res.status(404).json({ message: "Profile not found" });
      }
      const token = await requestAccountDeletion(userId!);
      const confirmLink = `${env.FRONTEND_URL}/confirm-account-deletion?token=${token}`;
      await sendAccountDeletionEmail({ to: email, confirmLink });
      res.json({ ok: true });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.post("/confirm-delete", validate(confirmDeleteSchema), async (req, res, next) => {
  try {
    const result = await confirmAccountDeletion(req.body.token);
    try {
      await query(
        "UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE user_id = :user_id",
        { user_id: result.userId }
      );
    } catch {
      // ignore if refresh_tokens table is not available
    }
    try {
      await sendSecurityAlertEmail({
        to: result.email,
        title: "Account deleted",
        message: "Your CampusTutor account has been deleted. If this was not you, contact support immediately.",
      });
    } catch (err) {
      logger.warn({ err }, "Failed to send account deletion confirmation");
    }
    res.json({ ok: true });
  } catch (err) {
    next(err as Error);
  }
});

router.delete("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const rows = await query<{ email: string }[]>(
      "SELECT email FROM users WHERE id = :id",
      { id: userId }
    );
    const email = rows[0]?.email;
    if (!email) {
      return res.status(404).json({ message: "Profile not found" });
    }
    const token = await requestAccountDeletion(userId!);
    const confirmLink = `${env.FRONTEND_URL}/confirm-account-deletion?token=${token}`;
    await sendAccountDeletionEmail({ to: email, confirmLink });
    res.json({ ok: true, message: "Confirmation email sent." });
  } catch (err) {
    next(err as Error);
  }
});

export default router;
