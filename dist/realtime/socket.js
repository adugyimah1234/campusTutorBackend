"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.emitToUser = emitToUser;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const jwt_1 = require("../utils/jwt");
let io = null;
function initSocket(server) {
    if (io)
        return io;
    const corsOrigins = env_1.env.CORS_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    io = new socket_io_1.Server(server, {
        cors: {
            origin: corsOrigins.length ? corsOrigins : true,
            credentials: true,
        },
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
        if (!token || typeof token !== "string") {
            return next(new Error("Unauthorized"));
        }
        try {
            const payload = (0, jwt_1.verifyAccessToken)(token);
            socket.data.userId = payload.sub;
            socket.data.roles = payload.roles;
            return next();
        }
        catch {
            return next(new Error("Unauthorized"));
        }
    });
    io.on("connection", (socket) => {
        const userId = socket.data.userId;
        if (userId) {
            socket.join(`user:${userId}`);
            logger_1.logger.info({ userId, socketId: socket.id }, "Socket connected");
        }
        socket.on("disconnect", (reason) => {
            logger_1.logger.info({ socketId: socket.id, reason }, "Socket disconnected");
        });
    });
    return io;
}
function emitToUser(userId, event, payload) {
    if (!io)
        return;
    io.to(`user:${userId}`).emit(event, payload);
}
