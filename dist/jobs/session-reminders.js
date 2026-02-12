"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSessionReminders = runSessionReminders;
exports.startSessionReminderJob = startSessionReminderJob;
const db_1 = require("../db");
const mailer_1 = require("../utils/mailer");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const WINDOW_MINUTES = 15;
const formatName = (firstName, lastName) => `${firstName ?? ""} ${lastName ?? ""}`.trim() || "CampusTutor user";
const getLocationLine = (row) => {
    if (row.location_type === "in_person") {
        return row.location_details ?? "TBA";
    }
    if (row.meeting_link) {
        return row.meeting_link;
    }
    return "Online (link TBA)";
};
const buildWindow = (hoursAhead) => {
    const start = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
    const end = new Date(start.getTime() + WINDOW_MINUTES * 60 * 1000);
    return { start, end };
};
async function sendReminders(hoursAhead, column) {
    if (!(0, mailer_1.canSendEmails)()) {
        return;
    }
    const { start, end } = buildWindow(hoursAhead);
    const rows = await (0, db_1.query)(`SELECT s.id, s.session_date, s.start_time, s.end_time,
            s.location_type, s.location_details, s.meeting_link,
            c.name AS course_name,
            tut.email AS tutor_email,
            tutProf.first_name AS tutor_first_name,
            tutProf.last_name AS tutor_last_name,
            stu.email AS tutee_email,
            stuProf.first_name AS tutee_first_name,
            stuProf.last_name AS tutee_last_name
     FROM sessions s
     JOIN tutor_profiles tp ON s.tutor_id = tp.id
     JOIN users tut ON tp.user_id = tut.id
     JOIN profiles tutProf ON tutProf.user_id = tut.id
     JOIN users stu ON s.tutee_id = stu.id
     JOIN profiles stuProf ON stuProf.user_id = stu.id
     JOIN courses c ON s.course_id = c.id
     WHERE s.status = 'confirmed'
       AND TIMESTAMP(s.session_date, s.start_time) >= :start
       AND TIMESTAMP(s.session_date, s.start_time) < :end
       AND s.${column} IS NULL`, { start, end });
    for (const row of rows) {
        const sessionTime = `${row.start_time}-${row.end_time}`;
        const locationLine = getLocationLine(row);
        const tutorName = formatName(row.tutor_first_name, row.tutor_last_name);
        const tuteeName = formatName(row.tutee_first_name, row.tutee_last_name);
        try {
            await Promise.all([
                (0, mailer_1.sendSessionReminderEmail)({
                    to: row.tutor_email,
                    recipientName: tutorName,
                    counterpartName: tuteeName,
                    courseName: row.course_name,
                    sessionDate: row.session_date,
                    sessionTime,
                    locationLine,
                    hoursBefore: hoursAhead,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                }),
                (0, mailer_1.sendSessionReminderEmail)({
                    to: row.tutee_email,
                    recipientName: tuteeName,
                    counterpartName: tutorName,
                    courseName: row.course_name,
                    sessionDate: row.session_date,
                    sessionTime,
                    locationLine,
                    hoursBefore: hoursAhead,
                    actionUrl: `${env_1.env.FRONTEND_URL}/dashboard/sessions`,
                }),
            ]);
            await (0, db_1.query)(`UPDATE sessions
         SET ${column} = NOW()
         WHERE id = :id`, { id: row.id });
        }
        catch (err) {
            logger_1.logger.warn({ err, sessionId: row.id }, "Failed to send session reminder email");
        }
    }
}
async function runSessionReminders() {
    await sendReminders(24, "reminder_24h_sent_at");
    await sendReminders(1, "reminder_1h_sent_at");
}
function startSessionReminderJob() {
    const intervalMs = WINDOW_MINUTES * 60 * 1000;
    const run = () => {
        runSessionReminders().catch((err) => {
            logger_1.logger.warn({ err }, "Session reminder job failed");
        });
    };
    run();
    return setInterval(run, intervalMs);
}
