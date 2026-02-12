import { Request, Response, NextFunction } from "express";
import { query } from "../db";
import { unauthorized } from "../utils/http";

export async function requireVerified(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(unauthorized());
    }
    const rows = await query<{ email_verified: number; is_active: number }[]>(
      "SELECT email_verified, is_active FROM users WHERE id = :id",
      { id: userId }
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return next(unauthorized("Account is not active"));
    }
    if (!user.email_verified) {
      return next(unauthorized("Please verify your email to continue."));
    }
    return next();
  } catch (err) {
    return next(err as Error);
  }
}
