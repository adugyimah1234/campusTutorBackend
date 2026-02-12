import { Request, Response, NextFunction } from "express";
import { forbidden } from "../utils/http";

export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !req.user.roles) {
      return next(forbidden());
    }
    const has = roles.some((role) => req.user?.roles.includes(role));
    if (!has) {
      return next(forbidden());
    }
    return next();
  };
}
