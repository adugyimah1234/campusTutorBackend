"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const http_1 = require("../utils/http");
const jwt_1 = require("../utils/jwt");
function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return next((0, http_1.unauthorized)());
    }
    const token = header.slice(7);
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = { id: payload.sub, roles: payload.roles };
        return next();
    }
    catch {
        return next((0, http_1.unauthorized)());
    }
}
