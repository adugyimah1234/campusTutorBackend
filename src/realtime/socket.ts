import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { verifyAccessToken } from "../utils/jwt";

let io: SocketIOServer | null = null;

export function initSocket(server: http.Server) {
  if (io) return io;
  const corsOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new SocketIOServer(server, {
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
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.roles = payload.roles;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
      logger.info({ userId, socketId: socket.id }, "Socket connected");
    }
    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Socket disconnected");
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}
