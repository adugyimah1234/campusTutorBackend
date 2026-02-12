import "dotenv/config";
import path from "path";
import fs from "fs";
import mysql from "mysql2/promise";
import { runSqlFile } from "./sql-runner";

type MigrationRow = { filename: string };

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });

  await connection.query(
    "CREATE DATABASE IF NOT EXISTS ??",
    [process.env.DB_NAME || "campus_tutoring"]
  );
  await connection.query("USE ??", [process.env.DB_NAME || "campus_tutoring"]);

  await connection.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
  );

  const rootDir = path.resolve(__dirname, "..", "..");
  const migrationsDir = path.join(rootDir, "database", "migrations");
  let files: string[] = [];
  if (fs.existsSync(migrationsDir)) {
    files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
  }

  if (files.length === 0) {
    files = [path.join(rootDir, "database", "schema.sql")];
  } else {
    files = files.map((file) => path.join(migrationsDir, file));
  }

  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT filename FROM schema_migrations"
  );
  const applied = new Set((rows as MigrationRow[]).map((row) => row.filename));

  const hasUsersTable = await tableExists(connection, process.env.DB_NAME || "campus_tutoring", "users");

  for (const file of files) {
    const filename = path.basename(file);
    if (filename === "schema.sql" && hasUsersTable) {
      if (!applied.has(filename)) {
        await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
      }
      continue;
    }
    if (applied.has(filename)) continue;
    await runSqlFile(connection, file);
    await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
  }

  await connection.end();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function tableExists(connection: mysql.Connection, dbName: string, tableName: string) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     LIMIT 1`,
    [dbName, tableName]
  );
  return (rows as mysql.RowDataPacket[]).length > 0;
}
