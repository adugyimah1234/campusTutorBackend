"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTuteeDashboard = getTuteeDashboard;
exports.getTutorDashboard = getTutorDashboard;
exports.getAdminDashboard = getAdminDashboard;
const db_1 = require("../db");
async function getTuteeDashboard(userId) {
    let upcoming = [];
    let past = [];
    try {
        upcoming = await (0, db_1.query)(`SELECT s.id AS id, p.first_name AS tutor_first_name, p.last_name AS tutor_last_name,
              c.name AS course_name, s.session_date, s.start_time, s.status, s.payment_status,
              s.meeting_link, s.location_type, s.location_details
       FROM sessions s
       JOIN tutor_profiles tp ON s.tutor_id = tp.id
       JOIN users u ON tp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       JOIN courses c ON s.course_id = c.id
       WHERE s.tutee_id = :user_id
         AND s.session_date >= CURDATE()
         AND s.status IN ('pending','confirmed','in_progress')
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 10`, { user_id: userId });
        past = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.status, s.payment_status, c.name AS course_name,
              p.first_name AS tutor_first_name, p.last_name AS tutor_last_name,
              r.id AS review_id
       FROM sessions s
       JOIN tutor_profiles tp ON s.tutor_id = tp.id
       JOIN users u ON tp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       JOIN courses c ON s.course_id = c.id
       LEFT JOIN reviews r ON r.session_id = s.id
       WHERE s.tutee_id = :user_id AND s.status = 'completed'
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 10`, { user_id: userId });
    }
    catch {
        upcoming = await (0, db_1.query)(`SELECT s.id AS id, p.first_name AS tutor_first_name, p.last_name AS tutor_last_name,
              c.name AS course_name, s.session_date, s.start_time, s.status,
              s.meeting_link, s.location_type, s.location_details
       FROM sessions s
       JOIN tutor_profiles tp ON s.tutor_id = tp.id
       JOIN users u ON tp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       JOIN courses c ON s.course_id = c.id
       WHERE s.tutee_id = :user_id
         AND s.session_date >= CURDATE()
         AND s.status IN ('pending','confirmed','in_progress')
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 10`, { user_id: userId });
        past = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.status, c.name AS course_name,
              p.first_name AS tutor_first_name, p.last_name AS tutor_last_name,
              r.id AS review_id
       FROM sessions s
       JOIN tutor_profiles tp ON s.tutor_id = tp.id
       JOIN users u ON tp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       JOIN courses c ON s.course_id = c.id
       LEFT JOIN reviews r ON r.session_id = s.id
       WHERE s.tutee_id = :user_id AND s.status = 'completed'
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 10`, { user_id: userId });
    }
    const stats = await (0, db_1.query)(`SELECT
        SUM(CASE WHEN status IN ('pending','confirmed','in_progress') AND session_date >= CURDATE() THEN 1 ELSE 0 END) AS upcoming_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN course_id END) AS subjects_studied,
        (SELECT COUNT(*) FROM reviews WHERE tutee_id = :user_id) AS reviews_given
     FROM sessions
     WHERE tutee_id = :user_id`, { user_id: userId });
    return {
        upcoming,
        past,
        stats: stats[0] ?? {
            upcoming_count: 0,
            completed_count: 0,
            subjects_studied: 0,
            reviews_given: 0,
        },
    };
}
async function getTutorDashboard(userId, earningsRange) {
    const tutor = await (0, db_1.query)("SELECT id FROM tutor_profiles WHERE user_id = :user_id", { user_id: userId });
    const tutorId = tutor[0]?.id;
    if (!tutorId) {
        return { upcoming: [], past: [], requests: [], stats: {} };
    }
    const range = earningsRange === "day" || earningsRange === "week" || earningsRange === "month"
        ? earningsRange
        : "month";
    const rangeFilter = range === "day"
        ? "s.session_date = CURDATE()"
        : range === "week"
            ? "s.session_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND s.session_date <= CURDATE()"
            : "YEAR(s.session_date) = YEAR(CURDATE()) AND MONTH(s.session_date) = MONTH(CURDATE())";
    let upcoming = [];
    let past = [];
    try {
        upcoming = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.status, s.payment_status, c.name AS course_name,
              p.first_name AS tutee_first_name, p.last_name AS tutee_last_name,
              s.meeting_link, s.location_type, s.location_details
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN profiles p ON s.tutee_id = p.user_id
       WHERE s.tutor_id IN (:tutor_id, :tutor_user_id)       AND s.session_date >= CURDATE()
         AND s.status IN ('pending','confirmed','in_progress')
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 10`, { tutor_id: tutorId, tutor_user_id: userId });
        past = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.status, s.payment_status, c.name AS course_name,
              p.first_name AS tutee_first_name, p.last_name AS tutee_last_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN profiles p ON s.tutee_id = p.user_id
       WHERE s.tutor_id IN (:tutor_id, :tutor_user_id) AND s.status = 'completed'
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 10`, { tutor_id: tutorId, tutor_user_id: userId });
    }
    catch {
        upcoming = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.status, c.name AS course_name,
              p.first_name AS tutee_first_name, p.last_name AS tutee_last_name,
              s.meeting_link, s.location_type, s.location_details
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN profiles p ON s.tutee_id = p.user_id
       WHERE s.tutor_id IN (:tutor_id, :tutor_user_id)       AND s.session_date >= CURDATE()
         AND s.status IN ('pending','confirmed','in_progress')
       ORDER BY s.session_date ASC, s.start_time ASC
       LIMIT 10`, { tutor_id: tutorId, tutor_user_id: userId });
        past = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.status, c.name AS course_name,
              p.first_name AS tutee_first_name, p.last_name AS tutee_last_name
       FROM sessions s
       JOIN courses c ON s.course_id = c.id
       JOIN profiles p ON s.tutee_id = p.user_id
       WHERE s.tutor_id IN (:tutor_id, :tutor_user_id) AND s.status = 'completed'
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 10`, { tutor_id: tutorId, tutor_user_id: userId });
    }
    let requests = [];
    try {
        requests = await (0, db_1.query)(`SELECT sr.id, sr.created_at, c.name AS course_name,
              p.first_name AS tutee_first_name, p.last_name AS tutee_last_name,
              sr.location_type, sr.location_details
       FROM session_requests sr
       JOIN courses c ON sr.course_id = c.id
       JOIN profiles p ON sr.tutee_id = p.user_id
       WHERE sr.tutor_id = :tutor_id AND sr.status = 'pending'
       ORDER BY sr.created_at DESC
       LIMIT 10`, { tutor_id: tutorId, tutor_user_id: userId });
    }
    catch {
        requests = await (0, db_1.query)(`SELECT sr.id, sr.created_at, c.name AS course_name,
              p.first_name AS tutee_first_name, p.last_name AS tutee_last_name
       FROM session_requests sr
       JOIN courses c ON sr.course_id = c.id
       JOIN profiles p ON sr.tutee_id = p.user_id
       WHERE sr.tutor_id = :tutor_id AND sr.status = 'pending'
       ORDER BY sr.created_at DESC
       LIMIT 10`, { tutor_id: tutorId, tutor_user_id: userId });
    }
    let stats = [];
    try {
        stats = await (0, db_1.query)(`SELECT 
          tp.total_sessions, 
          tp.total_hours, 
          tp.average_rating,
          (SELECT COUNT(DISTINCT tutee_id) FROM sessions WHERE tutor_id IN (:tutor_id, :tutor_user_id)) AS active_students,
          (SELECT ROUND(
              (COALESCE(SUM(TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time)), 0) / 60) * COALESCE(tp.hourly_rate, 0),
              2
            )
           FROM sessions s
                      WHERE s.tutor_id IN (:tutor_id, :tutor_user_id)
             AND s.status = 'completed'
             AND s.payment_status = 'paid'
             AND ${rangeFilter}) AS month_earnings
       FROM tutor_profiles tp
       WHERE tp.id = :tutor_id`, { tutor_id: tutorId, tutor_user_id: userId });
    }
    catch {
        stats = await (0, db_1.query)(`SELECT 
          tp.total_sessions, 
          tp.total_hours, 
          tp.average_rating,
          (SELECT COUNT(DISTINCT tutee_id) FROM sessions WHERE tutor_id IN (:tutor_id, :tutor_user_id)) AS active_students,
          (SELECT ROUND(
              (COALESCE(SUM(TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time)), 0) / 60) * COALESCE(tp.hourly_rate, 0),
              2
            )
           FROM sessions s
                      WHERE s.tutor_id IN (:tutor_id, :tutor_user_id)
             AND s.status = 'completed'
             AND ${rangeFilter}) AS month_earnings
       FROM tutor_profiles tp
       WHERE tp.id = :tutor_id`, { tutor_id: tutorId, tutor_user_id: userId });
    }
    return {
        upcoming,
        past,
        requests,
        stats: stats[0] ?? {
            total_sessions: 0,
            total_hours: 0,
            average_rating: 0,
            active_students: 0,
            month_earnings: 0,
        },
    };
}
async function getAdminDashboard() {
    const stats = await (0, db_1.query)(`SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM tutor_profiles WHERE is_verified = TRUE) AS active_tutors,
        (SELECT COUNT(*) FROM sessions WHERE session_date = CURDATE()) AS sessions_today,
        (SELECT COUNT(*) FROM reports WHERE status IN ('pending','under_review')) AS open_reports`);
    const applications = await (0, db_1.query)(`SELECT tp.id AS tutor_id, p.first_name, p.last_name, p.gpa, tp.created_at
     FROM tutor_profiles tp
     JOIN profiles p ON tp.user_id = p.user_id
     WHERE tp.is_verified = FALSE
     ORDER BY tp.created_at DESC
     LIMIT 10`);
    const reports = await (0, db_1.query)(`SELECT r.id, r.type, r.status, r.created_at, p.first_name, p.last_name
     FROM reports r
     JOIN profiles p ON r.reporter_id = p.user_id
     ORDER BY r.created_at DESC
     LIMIT 10`);
    return { stats: stats[0], applications, reports };
}
