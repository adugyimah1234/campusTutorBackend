import { query } from "../db";
import { canSendEmails, sendSessionReminderEmail } from "../utils/mailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const WINDOW_MINUTES = 15;

type ReminderRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location_type: "online" | "in_person" | null;
  location_details: string | null;
  meeting_link: string | null;
  course_name: string;
  tutor_email: string;
  tutee_email: string;
  tutor_first_name: string | null;
  tutor_last_name: string | null;
  tutee_first_name: string | null;
  tutee_last_name: string | null;
};

const formatName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName ?? ""} ${lastName ?? ""}`.trim() || "CampusTutor user";

const getLocationLine = (row: ReminderRow) => {
  if (row.location_type === "in_person") {
    return row.location_details ?? "TBA";
  }
  if (row.meeting_link) {
    return row.meeting_link;
  }
  return "Online (link TBA)";
};

const buildWindow = (hoursAhead: number) => {
  const start = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const end = new Date(start.getTime() + WINDOW_MINUTES * 60 * 1000);
  return { start, end };
};

async function sendReminders(hoursAhead: number, column: "reminder_24h_sent_at" | "reminder_1h_sent_at") {
  if (!canSendEmails()) {
    return;
  }
  const { start, end } = buildWindow(hoursAhead);
  const rows = await query<ReminderRow[]>(
    `SELECT s.id, s.session_date, s.start_time, s.end_time,
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
       AND s.${column} IS NULL`,
    { start, end }
  );

  for (const row of rows) {
    const sessionTime = `${row.start_time}-${row.end_time}`;
    const locationLine = getLocationLine(row);
    const tutorName = formatName(row.tutor_first_name, row.tutor_last_name);
    const tuteeName = formatName(row.tutee_first_name, row.tutee_last_name);
    try {
      await Promise.all([
        sendSessionReminderEmail({
          to: row.tutor_email,
          recipientName: tutorName,
          counterpartName: tuteeName,
          courseName: row.course_name,
          sessionDate: row.session_date,
          sessionTime,
          locationLine,
          hoursBefore: hoursAhead,
          actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
        }),
        sendSessionReminderEmail({
          to: row.tutee_email,
          recipientName: tuteeName,
          counterpartName: tutorName,
          courseName: row.course_name,
          sessionDate: row.session_date,
          sessionTime,
          locationLine,
          hoursBefore: hoursAhead,
          actionUrl: `${env.FRONTEND_URL}/dashboard/sessions`,
        }),
      ]);
      await query(
        `UPDATE sessions
         SET ${column} = NOW()
         WHERE id = :id`,
        { id: row.id }
      );
    } catch (err) {
      logger.warn({ err, sessionId: row.id }, "Failed to send session reminder email");
    }
  }
}

export async function runSessionReminders() {
  await sendReminders(24, "reminder_24h_sent_at");
  await sendReminders(1, "reminder_1h_sent_at");
}

export function startSessionReminderJob() {
  const intervalMs = WINDOW_MINUTES * 60 * 1000;
  const run = () => {
    runSessionReminders().catch((err) => {
      logger.warn({ err }, "Session reminder job failed");
    });
  };
  run();
  return setInterval(run, intervalMs);
}
