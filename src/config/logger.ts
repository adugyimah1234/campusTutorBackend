import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";
const usePrettyTransport = !isProduction && !isVercel;

export const logger = pino({
  level: isProduction ? "info" : "debug",
  redact: {
    paths: ["req.headers.authorization", "password", "password_hash"],
    remove: true,
  },
  ...(usePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});
