import crypto from "crypto";
import { query } from "../db";
import { emitToUser } from "../realtime/socket";
import { logger } from "../config/logger";

type NotificationPayload = Record<string, unknown> | null;
type ListNotificationsOptions = {
  limit?: number;
  since?: string;
  before?: string;
};
type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  link: string | null;
  is_read: boolean;
  created_at: string | Date;
};

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
  payload?: NotificationPayload
) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const params = {
    id,
    user_id: userId,
    type,
    title,
    body,
    payload: payload ? JSON.stringify(payload) : null,
    link: link ?? null,
  };
  try {
    await query(
      `INSERT INTO notifications (id, user_id, type, title, body, payload, link)
       VALUES (:id, :user_id, :type, :title, :body, :payload, :link)`,
      params
    );
  } catch (err) {
    try {
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, data, action_url)
         VALUES (:id, :user_id, :type, :title, :body, :payload, :link)`,
        params
      );
    } catch (fallbackErr) {
      logger.warn({ err: fallbackErr }, "Unable to persist notification");
    }
  }
  emitToUser(userId, "notification:new", {
    id,
    type,
    title,
    body,
    payload: payload ?? null,
    link: link ?? null,
    is_read: false,
    created_at: createdAt,
  });
  return id;
}

export async function listNotifications(userId: string, options: ListNotificationsOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const where: string[] = ["user_id = :user_id"];
  const params: Record<string, unknown> = { user_id: userId, limit };

  if (options.since) {
    where.push("created_at >= :since");
    params.since = options.since;
  }

  if (options.before) {
    where.push("created_at < :before");
    params.before = options.before;
  }

  const whereClause = where.join(" AND ");

  try {
    return await query<NotificationRow[]>(
      `SELECT id, type, title, body, payload, link, is_read, created_at
       FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT :limit`,
      params
    );
  } catch (err) {
    try {
      return await query<NotificationRow[]>(
        `SELECT id, type, title, message AS body, data AS payload, action_url AS link, is_read, created_at
         FROM notifications
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT :limit`,
        params
      );
    } catch (fallbackErr) {
      logger.warn({ err: fallbackErr }, "Unable to load notifications");
      return [];
    }
  }
}

export async function markNotificationsRead(userId: string, ids: string[]) {
  if (!ids.length) return;
  try {
    await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = :user_id AND id IN (${ids.map((_, idx) => `:id_${idx}`).join(", ")})`,
      ids.reduce(
        (acc, id, idx) => ({ ...acc, [`id_${idx}`]: id }),
        { user_id: userId }
      )
    );
  } catch (err) {
    logger.warn({ err }, "Unable to mark notifications read");
  }
}
