"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const socket_1 = require("./realtime/socket");
const session_reminders_1 = require("./jobs/session-reminders");
const server = http_1.default.createServer(app_1.app);
(0, socket_1.initSocket)(server);
const reminderInterval = env_1.env.NODE_ENV === "test" ? null : (0, session_reminders_1.startSessionReminderJob)();
server.listen(env_1.env.PORT, () => {
    logger_1.logger.info(`API listening on port ${env_1.env.PORT}`);
});
const shutdown = (signal) => {
    logger_1.logger.info({ signal }, "Shutting down");
    if (reminderInterval) {
        clearInterval(reminderInterval);
    }
    server.close(() => {
        process.exit(0);
    });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
