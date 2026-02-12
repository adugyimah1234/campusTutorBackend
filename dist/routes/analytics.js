"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const db_1 = require("../db");
const router = (0, express_1.Router)();
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const parseRange = (value) => {
    if (value === "day" || value === "week" || value === "month")
        return value;
    return "month";
};
const parseDate = (value) => {
    if (typeof value !== "string")
        return null;
    if (!DATE_PATTERN.test(value))
        return null;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()))
        return null;
    const normalized = date.toISOString().slice(0, 10);
    return normalized === value ? value : null;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
const resolveRange = (rangeParam, startParam, endParam) => {
    const range = parseRange(rangeParam);
    const startInput = parseDate(startParam);
    const endInput = parseDate(endParam);
    if (startInput && endInput) {
        let startDate = new Date(`${startInput}T00:00:00Z`);
        let endDate = new Date(`${endInput}T00:00:00Z`);
        if (startDate > endDate) {
            const swap = startDate;
            startDate = endDate;
            endDate = swap;
        }
        const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
        if (diffDays > 366)
            return null;
        return { start: formatDate(startDate), end: formatDate(endDate) };
    }
    const now = new Date();
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const daysBack = range === "day" ? 0 : range === "week" ? 6 : 29;
    const startDate = addDays(endDate, -daysBack);
    return { start: formatDate(startDate), end: formatDate(endDate) };
};
const buildDateSeries = (start, end) => {
    const days = [];
    let cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) {
        days.push(formatDate(cursor));
        cursor = addDays(cursor, 1);
    }
    return days;
};
const getDefaultRole = (roles) => {
    if (roles.includes("admin"))
        return "admin";
    if (roles.includes("tutor"))
        return "tutor";
    return "tutee";
};
router.get("/tutee", auth_1.requireAuth, (0, roles_1.requireRole)(["tutee", "admin"]), async (req, res, next) => {
    try {
        const range = typeof req.query.range === "string" ? req.query.range : "month";
        const daysBack = range === "day" ? 0 : range === "week" ? 6 : 29;
        const rows = await (0, db_1.query)(`SELECT d.day, COALESCE(s.count, 0) AS count
       FROM (
         SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) AS day
         FROM (
           SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
           SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
           SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL
           SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
           SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL
           SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
         ) nums
       ) d
       LEFT JOIN (
         SELECT session_date AS day, COUNT(*) AS count
         FROM sessions
         WHERE tutee_id = :user_id
           AND session_date >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
         GROUP BY session_date
       ) s ON s.day = d.day
       WHERE d.day >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
       ORDER BY d.day ASC`, { user_id: req.user.id, days_back: daysBack });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get("/tutor", auth_1.requireAuth, (0, roles_1.requireRole)(["tutor", "admin"]), async (req, res, next) => {
    try {
        const range = typeof req.query.range === "string" ? req.query.range : "month";
        const daysBack = range === "day" ? 0 : range === "week" ? 6 : 29;
        const tutor = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
        const tutorId = tutor[0]?.id;
        if (!tutorId) {
            return res.json({ data: [] });
        }
        const rows = await (0, db_1.query)(`SELECT d.day, COALESCE(s.count, 0) AS count
       FROM (
         SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) AS day
         FROM (
           SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
           SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
           SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL
           SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
           SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL
           SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
         ) nums
       ) d
       LEFT JOIN (
         SELECT session_date AS day, COUNT(*) AS count
         FROM sessions
         WHERE tutor_id = :tutor_id
           AND session_date >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
         GROUP BY session_date
       ) s ON s.day = d.day
       WHERE d.day >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
       ORDER BY d.day ASC`, { tutor_id: tutorId, days_back: daysBack });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get("/admin", auth_1.requireAuth, (0, roles_1.requireRole)(["admin"]), async (_req, res, next) => {
    try {
        const range = typeof _req.query.range === "string" ? _req.query.range : "month";
        const daysBack = range === "day" ? 0 : range === "week" ? 6 : 29;
        const rows = await (0, db_1.query)(`SELECT d.day, COALESCE(s.count, 0) AS count
       FROM (
         SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) AS day
         FROM (
           SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
           SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
           SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL
           SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL
           SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL
           SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
         ) nums
       ) d
       LEFT JOIN (
         SELECT session_date AS day, COUNT(*) AS count
         FROM sessions
         WHERE session_date >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
         GROUP BY session_date
       ) s ON s.day = d.day
       WHERE d.day >= DATE_SUB(CURDATE(), INTERVAL :days_back DAY)
       ORDER BY d.day ASC`, { days_back: daysBack });
        res.json({ data: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get("/report", auth_1.requireAuth, async (req, res, next) => {
    try {
        const roles = req.user.roles;
        const defaultRole = getDefaultRole(roles);
        const requestedRole = typeof req.query.role === "string" ? req.query.role : null;
        const allowedRoles = ["admin", "tutor", "tutee"];
        if (requestedRole && !allowedRoles.includes(requestedRole)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        if (requestedRole && !(roles.includes("admin") || roles.includes(requestedRole))) {
            return res.status(403).json({ message: "You are not allowed to view that role." });
        }
        const role = (requestedRole ?? defaultRole);
        const range = resolveRange(req.query.range, req.query.start, req.query.end);
        if (!range) {
            return res.status(400).json({ message: "Invalid date range." });
        }
        const params = {
            start: range.start,
            end: range.end,
        };
        const filters = ["s.session_date BETWEEN :start AND :end"];
        if (role === "tutee") {
            filters.push("s.tutee_id = :user_id");
            params.user_id = req.user.id;
        }
        if (role === "tutor") {
            const tutorRows = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: req.user.id });
            const tutorId = tutorRows[0]?.id ?? req.user.id;
            filters.push("s.tutor_id IN (:tutor_id, :tutor_user_id)");
            params.tutor_id = tutorId;
            params.tutor_user_id = req.user.id;
        }
        const whereSql = `WHERE ${filters.join(" AND ")}`;
        const seriesRows = await (0, db_1.query)(`SELECT s.session_date AS day,
              COUNT(*) AS count,
              COALESCE(SUM(
                CASE
                  WHEN s.status = 'completed' AND s.payment_status IN ('paid', 'due')
                  THEN (TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time) / 60) * COALESCE(tp.hourly_rate, 0)
                  ELSE 0
                END
              ), 0) AS revenue
       FROM sessions s
       LEFT JOIN tutor_profiles tp ON tp.id = s.tutor_id OR tp.user_id = s.tutor_id
       ${whereSql}
       GROUP BY s.session_date
       ORDER BY s.session_date ASC`, params);
        const seriesIndex = new Map(seriesRows.map((row) => [row.day, { count: Number(row.count), revenue: Number(row.revenue) }]));
        const series = buildDateSeries(range.start, range.end).map((day) => {
            const row = seriesIndex.get(day);
            return {
                day,
                count: row?.count ?? 0,
                revenue: row?.revenue ?? 0,
            };
        });
        const summaryRows = await (0, db_1.query)(`SELECT
          COUNT(*) AS total_sessions,
          SUM(s.status = 'completed') AS completed_sessions,
          SUM(s.status IN ('pending', 'confirmed')) AS upcoming_sessions,
          SUM(s.status = 'in_progress') AS in_progress_sessions,
          SUM(s.status IN ('cancelled', 'no_show')) AS cancelled_sessions,
          SUM(s.status = 'completed' AND s.payment_status = 'paid') AS paid_count,
          SUM(s.status = 'completed' AND s.payment_status = 'due') AS due_count,
          SUM(s.status = 'completed' AND s.payment_status = 'unpaid') AS unpaid_count,
          COALESCE(SUM(
            CASE
              WHEN s.status = 'completed' AND s.payment_status IN ('paid', 'due')
              THEN (TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time) / 60) * COALESCE(tp.hourly_rate, 0)
              ELSE 0
            END
          ), 0) AS revenue_total
       FROM sessions s
       LEFT JOIN tutor_profiles tp ON tp.id = s.tutor_id OR tp.user_id = s.tutor_id
       ${whereSql}`, params);
        const summaryRow = summaryRows[0] ?? {};
        const statusRows = await (0, db_1.query)(`SELECT s.status AS status, COUNT(*) AS count
       FROM sessions s
       ${whereSql}
       GROUP BY s.status`, params);
        const paymentRows = await (0, db_1.query)(`SELECT s.payment_status AS status, COUNT(*) AS count
       FROM sessions s
       ${whereSql} AND s.status = 'completed'
       GROUP BY s.payment_status`, params);
        res.json({
            role,
            range,
            summary: {
                total_sessions: Number(summaryRow.total_sessions ?? 0),
                completed_sessions: Number(summaryRow.completed_sessions ?? 0),
                upcoming_sessions: Number(summaryRow.upcoming_sessions ?? 0),
                in_progress_sessions: Number(summaryRow.in_progress_sessions ?? 0),
                cancelled_sessions: Number(summaryRow.cancelled_sessions ?? 0),
                paid_count: Number(summaryRow.paid_count ?? 0),
                due_count: Number(summaryRow.due_count ?? 0),
                unpaid_count: Number(summaryRow.unpaid_count ?? 0),
                revenue_total: Number(summaryRow.revenue_total ?? 0),
            },
            status_breakdown: statusRows.map((row) => ({
                status: row.status,
                count: Number(row.count ?? 0),
            })),
            payment_breakdown: paymentRows.map((row) => ({
                status: row.status,
                count: Number(row.count ?? 0),
            })),
            series,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
