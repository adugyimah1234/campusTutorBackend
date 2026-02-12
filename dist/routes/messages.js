"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const verified_1 = require("../middleware/verified");
const validate_1 = require("../middleware/validate");
const http_1 = require("../utils/http");
const notification_service_1 = require("../services/notification-service");
const mailer_1 = require("../utils/mailer");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const threadCreateSchema = zod_1.z.object({
    body: zod_1.z.object({
        peerUserId: zod_1.z.string().uuid(),
    }),
});
const sendMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string().min(1).max(2000),
    }),
});
function sortParticipants(a, b) {
    return a < b ? [a, b] : [b, a];
}
const formatName = (profile) => profile?.display_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    "CampusTutor user";
router.post("/threads", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(threadCreateSchema), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const peerUserId = req.body.peerUserId;
        if (peerUserId === userId) {
            return next((0, http_1.badRequest)("Cannot create conversation with yourself"));
        }
        const [p1, p2] = sortParticipants(userId, peerUserId);
        const existing = await (0, db_1.query)("SELECT id FROM conversations WHERE participant_one = :p1 AND participant_two = :p2", { p1, p2 });
        if (existing[0]) {
            return res.json({ conversationId: existing[0].id });
        }
        await (0, db_1.query)("INSERT INTO conversations (participant_one, participant_two, last_message_at) VALUES (:p1, :p2, NOW())", { p1, p2 });
        const created = await (0, db_1.query)("SELECT id FROM conversations WHERE participant_one = :p1 AND participant_two = :p2", { p1, p2 });
        res.json({ conversationId: created[0]?.id });
    }
    catch (err) {
        next(err);
    }
});
router.get("/threads", auth_1.requireAuth, verified_1.requireVerified, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rows = await (0, db_1.query)(`SELECT 
          c.id,
          c.last_message_at,
          CASE 
            WHEN c.participant_one = :user_id THEN c.participant_two 
            ELSE c.participant_one 
          END AS peer_id,
          p.display_name,
          p.first_name,
          p.last_name,
          p.avatar_url,
          m.content AS last_message,
          m.created_at AS last_message_time
       FROM conversations c
       JOIN profiles p ON p.user_id = CASE 
            WHEN c.participant_one = :user_id THEN c.participant_two 
            ELSE c.participant_one 
          END
       LEFT JOIN messages m ON m.id = (
          SELECT id FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
       )
       WHERE c.participant_one = :user_id OR c.participant_two = :user_id
       ORDER BY c.last_message_at DESC, c.created_at DESC`, { user_id: userId });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get("/threads/:id", auth_1.requireAuth, verified_1.requireVerified, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;
        const convo = await (0, db_1.query)("SELECT participant_one, participant_two FROM conversations WHERE id = :id", { id: conversationId });
        const record = convo[0];
        if (!record) {
            return next((0, http_1.notFound)("Conversation not found"));
        }
        if (record.participant_one !== userId && record.participant_two !== userId) {
            return next((0, http_1.unauthorized)("Not a participant"));
        }
        const messages = await (0, db_1.query)(`SELECT 
          m.id,
          m.sender_id,
          m.content,
          m.created_at,
          p.first_name,
          p.last_name,
          p.avatar_url
       FROM messages m
       JOIN profiles p ON p.user_id = m.sender_id
       WHERE m.conversation_id = :conversation_id
       ORDER BY m.created_at ASC
       LIMIT 200`, { conversation_id: conversationId });
        res.json({ data: messages });
    }
    catch (err) {
        next(err);
    }
});
router.post("/threads/:id", auth_1.requireAuth, verified_1.requireVerified, (0, validate_1.validate)(sendMessageSchema), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;
        const convo = await (0, db_1.query)("SELECT participant_one, participant_two FROM conversations WHERE id = :id", { id: conversationId });
        const record = convo[0];
        if (!record) {
            return next((0, http_1.notFound)("Conversation not found"));
        }
        if (record.participant_one !== userId && record.participant_two !== userId) {
            return next((0, http_1.unauthorized)("Not a participant"));
        }
        await (0, db_1.query)("INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES (:conversation_id, :sender_id, :content, NOW())", { conversation_id: conversationId, sender_id: userId, content: req.body.content });
        const peerId = record.participant_one === userId ? record.participant_two : record.participant_one;
        const senderName = await (0, db_1.query)("SELECT display_name, first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: userId });
        const name = senderName[0]?.display_name ||
            `${senderName[0]?.first_name ?? ""} ${senderName[0]?.last_name ?? ""}`.trim() ||
            "Someone";
        await (0, notification_service_1.createNotification)(peerId, "new_message", "New message", `${name} sent you a message`, `/messages/${conversationId}`, { conversationId, senderId: userId });
        try {
            const peerProfile = await (0, db_1.query)("SELECT display_name, first_name, last_name FROM profiles WHERE user_id = :user_id", { user_id: peerId });
            const peerEmailRows = await (0, db_1.query)("SELECT email FROM users WHERE id = :id", { id: peerId });
            if (peerEmailRows[0]) {
                const content = req.body.content;
                const trimmed = content.length > 160 ? `${content.slice(0, 157)}...` : content;
                await (0, mailer_1.sendNewMessageEmail)({
                    to: peerEmailRows[0].email,
                    recipientName: formatName(peerProfile[0]),
                    senderName: name,
                    messagePreview: trimmed,
                    actionUrl: `${env_1.env.FRONTEND_URL}/messages/${conversationId}`,
                });
            }
        }
        catch (err) {
            logger_1.logger.warn({ err }, "Failed to send new message email");
        }
        await (0, db_1.query)("UPDATE conversations SET last_message_at = NOW() WHERE id = :id", { id: conversationId });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
