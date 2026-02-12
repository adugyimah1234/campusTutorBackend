"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const http_1 = require("../utils/http");
const logger_1 = require("../config/logger");
function errorHandler(err, _req, res, _next) {
    const status = err instanceof http_1.HttpError ? err.status : 500;
    const payload = {
        message: err.message || "Internal Server Error",
    };
    if (process.env.NODE_ENV !== "production") {
        payload.stack = err.stack;
    }
    if (err instanceof http_1.HttpError && err.details) {
        payload.details = err.details;
    }
    if (status >= 500) {
        logger_1.logger.error({ err }, "Unhandled error");
    }
    res.status(status).json(payload);
}
