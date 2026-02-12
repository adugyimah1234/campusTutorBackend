import { pool } from "./pool";

export async function query<T = any>(sql: string, params?: any) {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}
