import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

export async function runSqlFile(connection: mysql.Connection, filePath: string) {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const statements = splitSqlStatements(content);

  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    await connection.query(trimmed);
  }
}

function splitSqlStatements(sql: string) {
  const lines = sql.split(/\r?\n/);
  let delimiter = ";";
  let buffer = "";
  const statements: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      buffer += "\n";
      continue;
    }
    if (line.startsWith("--")) {
      continue;
    }
    if (/^DELIMITER\s+/i.test(line)) {
      const parts = line.split(/\s+/);
      delimiter = parts[1] ?? ";";
      continue;
    }

    buffer += rawLine + "\n";
    if (buffer.trim().endsWith(delimiter)) {
      const statement = buffer.trim().slice(0, -delimiter.length);
      statements.push(statement);
      buffer = "";
    }
  }

  if (buffer.trim()) {
    statements.push(buffer.trim());
  }

  return statements;
}
