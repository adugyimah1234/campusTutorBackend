import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/http";
import { logger } from "../config/logger";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err instanceof HttpError ? err.status : 500;
  const payload: Record<string, unknown> = {
    message: err.message || "Internal Server Error",
  };
  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }
  if (err instanceof HttpError && err.details) {
    payload.details = err.details;
  }
  if (status >= 500) {
    logger.error({ err }, "Unhandled error");
  }
  res.status(status).json(payload);
}
