"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.forbidden = exports.unauthorized = exports.badRequest = exports.HttpError = void 0;
class HttpError extends Error {
    status;
    details;
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.HttpError = HttpError;
const badRequest = (message, details) => new HttpError(400, message, details);
exports.badRequest = badRequest;
const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
exports.unauthorized = unauthorized;
const forbidden = (message = "Forbidden") => new HttpError(403, message);
exports.forbidden = forbidden;
const notFound = (message = "Not Found") => new HttpError(404, message);
exports.notFound = notFound;
