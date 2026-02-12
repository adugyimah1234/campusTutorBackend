import mysql from "mysql2/promise";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});

pool.on("connection", () => {
  logger.debug("MySQL pool connection established");
});
