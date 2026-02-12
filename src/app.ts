import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { apiRateLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";
import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import tutorRoutes from "./routes/tutors";
import sessionRoutes from "./routes/sessions";
import adminRoutes from "./routes/admin";
import catalogRoutes from "./routes/catalog";
import sessionRequestRoutes from "./routes/session-requests";
import availabilityRoutes from "./routes/availability";
import analyticsRoutes from "./routes/analytics";
import messageRoutes from "./routes/messages";
import profileRoutes from "./routes/profile";
import notificationRoutes from "./routes/notifications";
import reviewRoutes from "./routes/reviews";
import contactRoutes from "./routes/contact";

export const app = express();

app.use(pinoHttp());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(apiRateLimiter);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/tutors", tutorRoutes);
app.use("/sessions", sessionRoutes);
app.use("/session-requests", sessionRequestRoutes);
app.use("/availability", availabilityRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/messages", messageRoutes);
app.use("/notifications", notificationRoutes);
app.use("/admin", adminRoutes);
app.use("/catalog", catalogRoutes);
app.use("/profile", profileRoutes);
app.use("/reviews", reviewRoutes);
app.use("/contact", contactRoutes);

app.use(errorHandler);
