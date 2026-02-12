"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const rate_limit_1 = require("./middleware/rate-limit");
const error_handler_1 = require("./middleware/error-handler");
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const tutors_1 = __importDefault(require("./routes/tutors"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const admin_1 = __importDefault(require("./routes/admin"));
const catalog_1 = __importDefault(require("./routes/catalog"));
const session_requests_1 = __importDefault(require("./routes/session-requests"));
const availability_1 = __importDefault(require("./routes/availability"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const messages_1 = __importDefault(require("./routes/messages"));
const profile_1 = __importDefault(require("./routes/profile"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const contact_1 = __importDefault(require("./routes/contact"));
exports.app = (0, express_1.default)();
exports.app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
exports.app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
const corsOrigins = env_1.env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (corsOrigins.includes(origin))
            return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
exports.app.use((0, compression_1.default)());
exports.app.use(express_1.default.json({ limit: "2mb" }));
exports.app.use(rate_limit_1.apiRateLimiter);
exports.app.use("/uploads", express_1.default.static(path_1.default.resolve(process.cwd(), "uploads")));
exports.app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: env_1.env.NODE_ENV });
});
exports.app.use("/auth", auth_1.default);
exports.app.use("/dashboard", dashboard_1.default);
exports.app.use("/tutors", tutors_1.default);
exports.app.use("/sessions", sessions_1.default);
exports.app.use("/session-requests", session_requests_1.default);
exports.app.use("/availability", availability_1.default);
exports.app.use("/analytics", analytics_1.default);
exports.app.use("/messages", messages_1.default);
exports.app.use("/notifications", notifications_1.default);
exports.app.use("/admin", admin_1.default);
exports.app.use("/catalog", catalog_1.default);
exports.app.use("/profile", profile_1.default);
exports.app.use("/reviews", reviews_1.default);
exports.app.use("/contact", contact_1.default);
exports.app.use(error_handler_1.errorHandler);
