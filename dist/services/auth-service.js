"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.createEmailVerificationToken = createEmailVerificationToken;
exports.verifyEmail = verifyEmail;
exports.requestEmailVerification = requestEmailVerification;
exports.deleteUser = deleteUser;
exports.rotateRefreshToken = rotateRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
exports.requestEmailChange = requestEmailChange;
exports.confirmEmailChange = confirmEmailChange;
exports.requestAccountDeletion = requestAccountDeletion;
exports.confirmAccountDeletion = confirmAccountDeletion;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const http_1 = require("../utils/http");
async function registerUser(input) {
    const existing = await (0, db_1.query)("SELECT id FROM users WHERE email = :email", { email: input.email });
    if (existing.length > 0) {
        throw (0, http_1.badRequest)("Email already registered");
    }
    const passwordHash = await (0, password_1.hashPassword)(input.password);
    await (0, db_1.query)("INSERT INTO users (email, password_hash) VALUES (:email, :password_hash)", { email: input.email, password_hash: passwordHash });
    const users = await (0, db_1.query)("SELECT id FROM users WHERE email = :email", { email: input.email });
    const userId = users[0]?.id;
    if (!userId) {
        throw (0, http_1.badRequest)("Failed to create user");
    }
    await (0, db_1.query)("INSERT INTO profiles (user_id, first_name, last_name, display_name) VALUES (:user_id, :first_name, :last_name, :display_name)", {
        user_id: userId,
        first_name: input.firstName,
        last_name: input.lastName,
        display_name: `${input.firstName} ${input.lastName}`,
    });
    await (0, db_1.query)("INSERT INTO user_roles (user_id, role) VALUES (:user_id, :role)", { user_id: userId, role: input.role });
    if (input.role === "tutor") {
        await (0, db_1.query)("INSERT IGNORE INTO tutor_profiles (user_id, headline, is_verified, is_available) VALUES (:user_id, :headline, FALSE, FALSE)", { user_id: userId, headline: "New Tutor" });
    }
    return userId;
}
async function loginUser(email, password) {
    const rows = await (0, db_1.query)("SELECT id, password_hash, is_active, email_verified FROM users WHERE email = :email", { email });
    const user = rows[0];
    if (!user || !user.is_active) {
        throw (0, http_1.unauthorized)("Invalid credentials");
    }
    if (!user.email_verified) {
        throw (0, http_1.unauthorized)("Please verify your email before signing in.");
    }
    const ok = await (0, password_1.verifyPassword)(password, user.password_hash);
    if (!ok) {
        throw (0, http_1.unauthorized)("Invalid credentials");
    }
    try {
        await (0, db_1.query)("UPDATE users SET last_login = NOW() WHERE id = :id", { id: user.id });
    }
    catch {
        // ignore if column is missing
    }
    const roles = await (0, db_1.query)("SELECT role FROM user_roles WHERE user_id = :user_id", { user_id: user.id });
    const roleList = roles.map((r) => r.role);
    const accessToken = (0, jwt_1.signAccessToken)({ sub: user.id, roles: roleList });
    const refreshToken = (0, jwt_1.signRefreshToken)({ sub: user.id, roles: roleList });
    const refreshHash = hashToken(refreshToken);
    await (0, db_1.query)("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 7 DAY))", { user_id: user.id, token_hash: refreshHash });
    return { accessToken, refreshToken, roles: roleList, userId: user.id };
}
async function createEmailVerificationToken(userId) {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    await (0, db_1.query)("UPDATE users SET email_verified = FALSE, email_verification_token = :token WHERE id = :id", { token: tokenHash, id: userId });
    return token;
}
async function verifyEmail(token) {
    const tokenHash = hashToken(token);
    const rows = await (0, db_1.query)("SELECT id FROM users WHERE email_verification_token = :token AND email_verified = FALSE", { token: tokenHash });
    const user = rows[0];
    if (!user) {
        throw (0, http_1.badRequest)("Invalid or expired verification link");
    }
    await (0, db_1.query)("UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE id = :id", { id: user.id });
}
async function requestEmailVerification(email) {
    const rows = await (0, db_1.query)("SELECT id, email_verified, is_active FROM users WHERE email = :email", { email });
    const user = rows[0];
    if (!user || !user.is_active || user.email_verified) {
        return null;
    }
    return createEmailVerificationToken(user.id);
}
async function deleteUser(userId) {
    await (0, db_1.query)("DELETE FROM users WHERE id = :id", { id: userId });
}
async function rotateRefreshToken(refreshToken) {
    const refreshHash = hashToken(refreshToken);
    const rows = await (0, db_1.query)("SELECT user_id, is_revoked FROM refresh_tokens WHERE token_hash = :token_hash", { token_hash: refreshHash });
    const stored = rows[0];
    if (!stored || stored.is_revoked) {
        throw (0, http_1.unauthorized)("Invalid refresh token");
    }
    await (0, db_1.query)("UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE token_hash = :token_hash", { token_hash: refreshHash });
    const roles = await (0, db_1.query)("SELECT role FROM user_roles WHERE user_id = :user_id", { user_id: stored.user_id });
    const roleList = roles.map((r) => r.role);
    const accessToken = (0, jwt_1.signAccessToken)({ sub: stored.user_id, roles: roleList });
    const newRefreshToken = (0, jwt_1.signRefreshToken)({ sub: stored.user_id, roles: roleList });
    await (0, db_1.query)("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 7 DAY))", { user_id: stored.user_id, token_hash: hashToken(newRefreshToken) });
    return { accessToken, refreshToken: newRefreshToken };
}
async function revokeRefreshToken(refreshToken) {
    await (0, db_1.query)("UPDATE refresh_tokens SET is_revoked = 1, revoked_at = NOW() WHERE token_hash = :token_hash", { token_hash: hashToken(refreshToken) });
}
async function requestPasswordReset(email) {
    const rows = await (0, db_1.query)("SELECT id, is_active FROM users WHERE email = :email", { email });
    const user = rows[0];
    if (!user || !user.is_active) {
        return null;
    }
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    await (0, db_1.query)("UPDATE users SET password_reset_token = :token, password_reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = :id", { token: tokenHash, id: user.id });
    return token;
}
async function resetPassword(token, newPassword) {
    const tokenHash = hashToken(token);
    const rows = await (0, db_1.query)("SELECT id FROM users WHERE password_reset_token = :token AND password_reset_expires > NOW()", { token: tokenHash });
    const user = rows[0];
    if (!user) {
        throw (0, http_1.badRequest)("Invalid or expired reset token");
    }
    const passwordHash = await (0, password_1.hashPassword)(newPassword);
    await (0, db_1.query)("UPDATE users SET password_hash = :password_hash, password_reset_token = NULL, password_reset_expires = NULL WHERE id = :id", { password_hash: passwordHash, id: user.id });
    return user.id;
}
async function requestEmailChange(userId, newEmail) {
    const existing = await (0, db_1.query)("SELECT id FROM users WHERE email = :email", { email: newEmail });
    if (existing[0]) {
        throw (0, http_1.badRequest)("Email already registered");
    }
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    await (0, db_1.query)(`UPDATE users
     SET pending_email = :pending_email,
         pending_email_token = :token,
         pending_email_expires = DATE_ADD(NOW(), INTERVAL 2 HOUR)
     WHERE id = :id`, { pending_email: newEmail, token: tokenHash, id: userId });
    return token;
}
async function confirmEmailChange(token) {
    const tokenHash = hashToken(token);
    const rows = await (0, db_1.query)(`SELECT id, email, pending_email
     FROM users
     WHERE pending_email_token = :token
       AND pending_email_expires > NOW()`, { token: tokenHash });
    const user = rows[0];
    if (!user || !user.pending_email) {
        throw (0, http_1.badRequest)("Invalid or expired email change link");
    }
    await (0, db_1.query)(`UPDATE users
     SET email = :email,
         email_verified = TRUE,
         pending_email = NULL,
         pending_email_token = NULL,
         pending_email_expires = NULL
     WHERE id = :id`, { id: user.id, email: user.pending_email });
    return { userId: user.id, oldEmail: user.email, newEmail: user.pending_email };
}
async function requestAccountDeletion(userId) {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    await (0, db_1.query)(`UPDATE users
     SET delete_account_token = :token,
         delete_account_expires = DATE_ADD(NOW(), INTERVAL 2 HOUR)
     WHERE id = :id`, { token: tokenHash, id: userId });
    return token;
}
async function confirmAccountDeletion(token) {
    const tokenHash = hashToken(token);
    const rows = await (0, db_1.query)(`SELECT id, email
     FROM users
     WHERE delete_account_token = :token
       AND delete_account_expires > NOW()`, { token: tokenHash });
    const user = rows[0];
    if (!user) {
        throw (0, http_1.badRequest)("Invalid or expired deletion link");
    }
    await (0, db_1.query)(`UPDATE users
     SET is_active = FALSE,
         delete_account_token = NULL,
         delete_account_expires = NULL
     WHERE id = :id`, { id: user.id });
    return { userId: user.id, email: user.email };
}
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
