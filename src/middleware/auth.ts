import { Request, Response, NextFunction } from "express";
import { unauthorized } from "../utils/http";
import { verifyAccessToken } from "../utils/jwt";

export type AuthUser = {
  id: string;
  roles: string[];
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(unauthorized());
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, roles: payload.roles };
    return next();
  } catch {
    return next(unauthorized());
  }
}
