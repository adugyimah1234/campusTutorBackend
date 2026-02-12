import crypto from "crypto";
import { query } from "../db";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { badRequest, unauthorized } from "../utils/http";

type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "tutor" | "tutee" | "admin";
};

export async function registerUser(input: RegisterInput) {
  const existing = await query<{ id: string }[]>(
    "SELECT id FROM users WHERE email = :email",
    { email: input.email }
  );
  if (existing.length > 0) {
    throw badRequest("Email already registered");
  }
  const passwordHash = await hashPassword(input.password);
  await query(
    "INSERT INTO users (email, password_hash) VALUES (:email, :password_hash)",
    { email: input.email, password_hash: passwordHash }
  );
  const users = await query<{ id: string }[]>(
    "SELECT id FROM users WHERE email = :email",
    { email: input.email }
  );
  const userId = users[0]?.id;
  if (!userId) {
    throw badRequest("Failed to create user");
  }
  await query(
    "INSERT INTO profiles (user_id, first_name, last_name, display_name) VALUES (:user_id, :first_name, :last_name, :display_name)",
    {
      user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      display_name: `${input.firstName} ${input.lastName}`,
    }
  );
  await query(
    "INSERT INTO user_roles (user_id, role) VALUES (:user_id, :role)",
    { user_id: userId, role: input.role }
  );
  if (input.role === "tutor") {
    await query(
      "INSERT IGNORE INTO tutor_profiles (user_id, headline, is_verified, is_available) VALUES (:user_id, :headline, FALSE, FALSE)",
      { user_id: userId, headline: "New Tutor" }
    );
  }
  return userId;
}

export async function loginUser(email: string, password: string) {
  const rows = await query<
    { id: string; password_hash: string; is_active: number; email_verified: number }[]
  >("SELECT id, password_hash, is_active, email_verified FROM users WHERE email = :email", { email });
  const user = rows[0];
  if (!user || !user.is_active) {
    throw unauthorized("Invalid credentials");
  }
  if (!user.email_verified) {
    throw unauthorized("Please verify your email before signing in.");
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw unauthorized("Invalid credentials");
  }
  try {
    await query("UPDATE users SET last_login = NOW() WHERE id = :id", { id: user.id });
  } catch {
    // ignore if column is missing
  }
  const roles = await query<{ role: string }[]>(
    "SELECT role FROM user_roles WHERE user_id = :user_id",
    { user_id: user.id }
  );
  const roleList = roles.map((r) => r.role);
  const accessToken = signAccessToken({ sub: user.id, roles: roleList });
  const refreshToken = signRefreshToken({ sub: user.id, roles: roleList });

  const refreshHash = hashToken(refreshToken);
  await query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    { user_id: user.id, token_hash: refreshHash }
  );
  return { accessToken, refreshToken, roles: roleList, userId: user.id };
}

export async function createEmailVerificationToken(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await query(
    "UPDATE users SET email_verified = FALSE, email_verification_token = :token WHERE id = :id",
    { token: tokenHash, id: userId }
  );
  return token;
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const rows = await query<{ id: string }[]>(
    "SELECT id FROM users WHERE email_verification_token = :token AND email_verified = FALSE",
    { token: tokenHash }
  );
  const user = rows[0];
  if (!user) {
    throw badRequest("Invalid or expired verification link");
  }
  await query(
    "UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE id = :id",
    { id: user.id }
  );
}

export async function requestEmailVerification(email: string) {
  const rows = await query<{ id: string; email_verified: number; is_active: number }[]>(
    "SELECT id, email_verified, is_active FROM users WHERE email = :email",
    { email }
  );
  const user = rows[0];
  if (!user || !user.is_active || user.email_verified) {
    return null;
  }
  return createEmailVerificationToken(user.id);
}

export async function deleteUser(userId: string) {
  await query("DELETE FROM users WHERE id = :id", { id: userId });
}

export async function rotateRefreshToken(refreshToken: string) {
  const refreshHash = hashToken(refreshToken);
  const rows = await query<{ user_id: string; is_revoked: number }[]>(
    "SELECT user_id, is_revoked FROM refresh_tokens WHERE token_hash = :token_hash",
    { token_hash: refreshHash }
  );
  const stored = rows[0];
  if (!stored || stored.is_revoked) {
    throw unauthorized("Invalid refresh token");
  }
  await query(
    "UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE token_hash = :token_hash",
    { token_hash: refreshHash }
  );
  const roles = await query<{ role: string }[]>(
    "SELECT role FROM user_roles WHERE user_id = :user_id",
    { user_id: stored.user_id }
  );
  const roleList = roles.map((r) => r.role);
  const accessToken = signAccessToken({ sub: stored.user_id, roles: roleList });
  const newRefreshToken = signRefreshToken({ sub: stored.user_id, roles: roleList });
  await query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    { user_id: stored.user_id, token_hash: hashToken(newRefreshToken) }
  );
  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeRefreshToken(refreshToken: string) {
  await query(
    "UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE token_hash = :token_hash",
    { token_hash: hashToken(refreshToken) }
  );
}

export async function requestPasswordReset(email: string) {
  const rows = await query<{ id: string; is_active: number }[]>(
    "SELECT id, is_active FROM users WHERE email = :email",
    { email }
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    return null;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await query(
    "UPDATE users SET password_reset_token = :token, password_reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = :id",
    { token: tokenHash, id: user.id }
  );
  return token;
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const rows = await query<{ id: string }[]>(
    "SELECT id FROM users WHERE password_reset_token = :token AND password_reset_expires > NOW()",
    { token: tokenHash }
  );
  const user = rows[0];
  if (!user) {
    throw badRequest("Invalid or expired reset token");
  }
  const passwordHash = await hashPassword(newPassword);
  await query(
    "UPDATE users SET password_hash = :password_hash, password_reset_token = NULL, password_reset_expires = NULL WHERE id = :id",
    { password_hash: passwordHash, id: user.id }
  );
  return user.id;
}

export async function requestEmailChange(userId: string, newEmail: string) {
  const existing = await query<{ id: string }[]>(
    "SELECT id FROM users WHERE email = :email",
    { email: newEmail }
  );
  if (existing[0]) {
    throw badRequest("Email already registered");
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await query(
    `UPDATE users
     SET pending_email = :pending_email,
         pending_email_token = :token,
         pending_email_expires = DATE_ADD(NOW(), INTERVAL 2 HOUR)
     WHERE id = :id`,
    { pending_email: newEmail, token: tokenHash, id: userId }
  );
  return token;
}

export async function confirmEmailChange(token: string) {
  const tokenHash = hashToken(token);
  const rows = await query<{ id: string; email: string; pending_email: string | null }[]>(
    `SELECT id, email, pending_email
     FROM users
     WHERE pending_email_token = :token
       AND pending_email_expires > NOW()`,
    { token: tokenHash }
  );
  const user = rows[0];
  if (!user || !user.pending_email) {
    throw badRequest("Invalid or expired email change link");
  }
  await query(
    `UPDATE users
     SET email = :email,
         email_verified = TRUE,
         pending_email = NULL,
         pending_email_token = NULL,
         pending_email_expires = NULL
     WHERE id = :id`,
    { id: user.id, email: user.pending_email }
  );
  return { userId: user.id, oldEmail: user.email, newEmail: user.pending_email };
}

export async function requestAccountDeletion(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await query(
    `UPDATE users
     SET delete_account_token = :token,
         delete_account_expires = DATE_ADD(NOW(), INTERVAL 2 HOUR)
     WHERE id = :id`,
    { token: tokenHash, id: userId }
  );
  return token;
}

export async function confirmAccountDeletion(token: string) {
  const tokenHash = hashToken(token);
  const rows = await query<{ id: string; email: string }[]>(
    `SELECT id, email
     FROM users
     WHERE delete_account_token = :token
       AND delete_account_expires > NOW()`,
    { token: tokenHash }
  );
  const user = rows[0];
  if (!user) {
    throw badRequest("Invalid or expired deletion link");
  }
  await query(
    `UPDATE users
     SET is_active = FALSE,
         delete_account_token = NULL,
         delete_account_expires = NULL
     WHERE id = :id`,
    { id: user.id }
  );
  return { userId: user.id, email: user.email };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
