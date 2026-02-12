import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { env } from "../config/env";
import {
  createEmailVerificationToken,
  deleteUser,
  loginUser,
  requestEmailVerification,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  requestPasswordReset,
  verifyEmail,
  resetPassword,
} from "../services/auth-service";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
} from "../utils/mailer";
import { authRateLimiter } from "../middleware/rate-limit";
import { badRequest } from "../utils/http";
import { logger } from "../config/logger";
import { query } from "../db";

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(["tutee", "tutor", "admin"]).default("tutee"),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    password: z.string().min(8),
  }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(10),
  }),
});

const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

router.post("/register", authRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    const userId = await registerUser({ email, password, firstName, lastName, role });
    try {
      const verificationToken = await createEmailVerificationToken(userId);
      const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await sendEmailVerificationEmail(email, verifyLink);
    } catch (err) {
      await deleteUser(userId);
      throw badRequest("Unable to send verification email. Please try again.");
    }
    res.status(201).json({ userId });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/login", authRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    try {
      const userAgent = req.headers["user-agent"] ?? "Unknown device";
      const ip = req.ip ?? "Unknown IP";
      await sendSecurityAlertEmail({
        to: email,
        title: "New login to your CampusTutor account",
        message: `We detected a new login. IP: ${ip}. Device: ${userAgent}.`,
      });
    } catch (err) {
      logger.warn({ err }, "Failed to send login security alert email");
    }
    res.json(result);
  } catch (err) {
    next(err as Error);
  }
});

router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await rotateRefreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err as Error);
  }
});

router.post("/logout", validate(refreshSchema), async (req, res, next) => {
  try {
    await revokeRefreshToken(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post("/forgot-password", authRateLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const token = await requestPasswordReset(req.body.email);
    if (token) {
      const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;
      await sendPasswordResetEmail(req.body.email, resetLink);
    }
    res.json({ message: "If the account exists, a reset link has been sent." });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const userId = await resetPassword(req.body.token, req.body.password);
    try {
      const rows = await query<{ email: string }[]>(
        "SELECT email FROM users WHERE id = :id",
        { id: userId }
      );
      if (rows[0]) {
        await sendSecurityAlertEmail({
          to: rows[0].email,
          title: "Your CampusTutor password was changed",
          message: "Your password was just updated. If this was not you, please reset it immediately.",
        });
      }
    } catch (err) {
      logger.warn({ err }, "Failed to send password change email");
    }
    res.json({ message: "Password reset successful" });
  } catch (err) {
    next(err as Error);
  }
});

router.post("/verify-email", authRateLimiter, validate(verifyEmailSchema), async (req, res, next) => {
  try {
    await verifyEmail(req.body.token);
    res.json({ message: "Email verified" });
  } catch (err) {
    next(err as Error);
  }
});

router.post(
  "/resend-verification",
  authRateLimiter,
  validate(resendVerificationSchema),
  async (req, res, next) => {
    try {
      const token = await requestEmailVerification(req.body.email);
      if (token) {
        try {
          const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${token}`;
          await sendEmailVerificationEmail(req.body.email, verifyLink);
        } catch (err) {
          throw badRequest("Unable to send verification email. Please try again.");
        }
      }
      res.json({ message: "If the account exists, a verification email has been sent." });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.get("/verify-email", authRateLimiter, async (req, res, next) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.redirect(`${env.FRONTEND_URL}/auth`);
    return;
  }
  try {
    await verifyEmail(token);
    res.redirect(`${env.FRONTEND_URL}/auth`);
  } catch (err) {
    next(err as Error);
  }
});

export default router;
