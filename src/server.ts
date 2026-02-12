import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { initSocket } from "./realtime/socket";
import { startSessionReminderJob } from "./jobs/session-reminders";

const server = http.createServer(app);
initSocket(server);
const reminderInterval = env.NODE_ENV === "test" ? null : startSessionReminderJob();

server.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`);
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down");
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
