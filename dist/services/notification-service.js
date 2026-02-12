"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.listNotifications = listNotifications;
exports.markNotificationsRead = markNotificationsRead;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../db");
const socket_1 = require("../realtime/socket");
const logger_1 = require("../config/logger");
async function createNotification(userId, type, title, body, link, payload) {
    const id = crypto_1.default.randomUUID();
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
        await (0, db_1.query)(`INSERT INTO notifications (id, user_id, type, title, body, payload, link)
       VALUES (:id, :user_id, :type, :title, :body, :payload, :link)`, params);
    }
    catch (err) {
        try {
            await (0, db_1.query)(`INSERT INTO notifications (id, user_id, type, title, message, data, action_url)
         VALUES (:id, :user_id, :type, :title, :body, :payload, :link)`, params);
        }
        catch (fallbackErr) {
            logger_1.logger.warn({ err: fallbackErr }, "Unable to persist notification");
        }
    }
    (0, socket_1.emitToUser)(userId, "notification:new", {
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
async function listNotifications(userId, limit = 10) {
    try {
        return await (0, db_1.query)(`SELECT id, type, title, body, payload, link, is_read, created_at
       FROM notifications
       WHERE user_id = :user_id
       ORDER BY created_at DESC
       LIMIT :limit`, { user_id: userId, limit });
    }
    catch (err) {
        try {
            return await (0, db_1.query)(`SELECT id, type, title, message AS body, data AS payload, action_url AS link, is_read, created_at
         FROM notifications
         WHERE user_id = :user_id
         ORDER BY created_at DESC
         LIMIT :limit`, { user_id: userId, limit });
        }
        catch (fallbackErr) {
            logger_1.logger.warn({ err: fallbackErr }, "Unable to load notifications");
            return [];
        }
    }
}
async function markNotificationsRead(userId, ids) {
    if (!ids.length)
        return;
    try {
        await (0, db_1.query)(`UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = :user_id AND id IN (${ids.map((_, idx) => `:id_${idx}`).join(", ")})`, ids.reduce((acc, id, idx) => ({ ...acc, [`id_${idx}`]: id }), { user_id: userId }));
    }
    catch (err) {
        logger_1.logger.warn({ err }, "Unable to mark notifications read");
    }
}
