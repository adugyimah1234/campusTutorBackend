"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireVerified = requireVerified;
const db_1 = require("../db");
const http_1 = require("../utils/http");
async function requireVerified(req, _res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return next((0, http_1.unauthorized)());
        }
        const rows = await (0, db_1.query)("SELECT email_verified, is_active FROM users WHERE id = :id", { id: userId });
        const user = rows[0];
        if (!user || !user.is_active) {
            return next((0, http_1.unauthorized)("Account is not active"));
        }
        if (!user.email_verified) {
            return next((0, http_1.unauthorized)("Please verify your email to continue."));
        }
        return next();
    }
    catch (err) {
        return next(err);
    }
}
