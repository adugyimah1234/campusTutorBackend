"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const http_1 = require("../utils/http");
function requireRole(roles) {
    return (req, _res, next) => {
        if (!req.user || !req.user.roles) {
            return next((0, http_1.forbidden)());
        }
        const has = roles.some((role) => req.user?.roles.includes(role));
        if (!has) {
            return next((0, http_1.forbidden)());
        }
        return next();
    };
}
