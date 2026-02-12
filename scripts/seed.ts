import "dotenv/config";
import crypto from "crypto";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../src/utils/password";

type UserRow = RowDataPacket & { id: string; email: string };
type TutorRow = RowDataPacket & { id: string; user_id: string };
type DeptRow = RowDataPacket & { id: string; code: string };
type CourseRow = RowDataPacket & { id: string; code: string; dept_code: string };

const PASSWORD = "Password123!";
const ADMIN_EMAIL = "admin@campus.edu";
const TUTOR_EMAILS = ["tutor@campus.edu", ...Array.from({ length: 5 }, (_, i) => `tutor${i + 2}@campus.edu`)];
const TUTEE_EMAILS = ["tutee@campus.edu", ...Array.from({ length: 11 }, (_, i) => `student${i + 2}@campus.edu`)];

const DEPARTMENTS = [
  { code: "MATH", name: "Mathematics" },
  { code: "CS", name: "Computer Science" },
  { code: "PHYS", name: "Physics" },
  { code: "CHEM", name: "Chemistry" },
  { code: "BIO", name: "Biology" },
  { code: "ENG", name: "English" },
  { code: "ECON", name: "Economics" },
];

const COURSES = [
  { dept: "MATH", code: "MATH101", name: "Calculus I" },
  { dept: "MATH", code: "MATH201", name: "Linear Algebra" },
  { dept: "MATH", code: "MATH221", name: "Statistics" },
  { dept: "CS", code: "CS101", name: "Intro Programming" },
  { dept: "CS", code: "CS201", name: "Data Structures" },
  { dept: "CS", code: "CS220", name: "Database Systems" },
  { dept: "PHYS", code: "PHYS101", name: "General Physics I" },
  { dept: "PHYS", code: "PHYS201", name: "Electricity & Magnetism" },
  { dept: "CHEM", code: "CHEM101", name: "General Chemistry I" },
  { dept: "BIO", code: "BIO101", name: "Intro Biology" },
  { dept: "ENG", code: "ENG101", name: "Academic Writing" },
  { dept: "ECON", code: "ECON101", name: "Microeconomics" },
];

function ph(n: number) {
  return Array.from({ length: n }, () => "?").join(", ");
}

function pad(v: number) {
  return String(v).padStart(2, "0");
}

function dateShift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "campus_tutoring",
  });

  try {
    await connection.beginTransaction();

    const passwordHash = await hashPassword(PASSWORD);
    await seedDepartments(connection);
    const deptByCode = await getDeptMap(connection);
    await seedCourses(connection, deptByCode);
    const courseByKey = await getCourseMap(connection);

    const users = [ADMIN_EMAIL, ...TUTOR_EMAILS, ...TUTEE_EMAILS];
    for (const email of users) {
      await connection.query(
        `INSERT INTO users (id, email, password_hash, email_verified, is_active)
         VALUES (UUID(), ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), email_verified = TRUE, is_active = TRUE`,
        [email, passwordHash]
      );
    }

    const [userRows] = await connection.query<UserRow[]>(
      `SELECT id, email FROM users WHERE email IN (${ph(users.length)})`,
      users
    );
    const userByEmail = new Map(userRows.map((row) => [row.email, row.id]));

    await upsertProfiles(connection, userByEmail);
    await upsertRoles(connection, userByEmail);
    await upsertTutorProfiles(connection, userByEmail);

    const [tutorRows] = await connection.query<TutorRow[]>(
      `SELECT id, user_id FROM tutor_profiles WHERE user_id IN (${ph(TUTOR_EMAILS.length)})`,
      TUTOR_EMAILS.map((email) => userByEmail.get(email) ?? "")
    );
    const tutorByUserId = new Map(tutorRows.map((row) => [row.user_id, row.id]));
    const tutorIds = [...tutorByUserId.values()];
    const userIds = [...userByEmail.values()];

    await clearOldSeedData(connection, userIds, tutorIds);
    await seedTutorCourses(connection, userByEmail, tutorByUserId, courseByKey);
    await seedAvailability(connection, tutorIds);

    const sessions = await seedSessions(connection, userByEmail, tutorByUserId, courseByKey);
    await seedSessionRequests(connection, userByEmail, tutorByUserId, courseByKey);
    await seedReviews(connection, sessions);
    await refreshTutorStats(connection, tutorIds);

    await connection.commit();

    const completed = sessions.filter((s) => s.status === "completed").length;
    const paid = sessions.filter((s) => s.payment_status === "paid").length;
    console.log("Seed complete.");
    console.log(`Users: ${users.length}, Tutors: ${TUTOR_EMAILS.length}, Students: ${TUTEE_EMAILS.length}`);
    console.log(`Sessions: ${sessions.length} (completed: ${completed}, paid: ${paid})`);
    console.log(`Requests: 24, Reviews: 20`);
    console.log("");
    console.log("Credentials:");
    console.log(`- Password for all: ${PASSWORD}`);
    console.log(`- Admin: ${ADMIN_EMAIL}`);
    console.log(`- Tutor: ${TUTOR_EMAILS[0]}`);
    console.log(`- Student: ${TUTEE_EMAILS[0]}`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.end();
  }
}

async function seedDepartments(connection: Connection) {
  for (const dept of DEPARTMENTS) {
    await connection.query(
      `INSERT INTO departments (id, name, code, description, is_active)
       VALUES (UUID(), ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = TRUE`,
      [dept.name, dept.code, `${dept.name} department`]
    );
  }
}

async function getDeptMap(connection: Connection) {
  const [rows] = await connection.query<DeptRow[]>("SELECT id, code FROM departments");
  return new Map(rows.map((row) => [row.code, row.id]));
}

async function seedCourses(connection: Connection, deptByCode: Map<string, string>) {
  for (const course of COURSES) {
    const deptId = deptByCode.get(course.dept);
    if (!deptId) continue;
    await connection.query(
      `INSERT INTO courses (id, department_id, code, name, description, difficulty_level, is_active)
       VALUES (UUID(), ?, ?, ?, ?, 'intermediate', TRUE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = TRUE`,
      [deptId, course.code, course.name, `${course.name} seeded for testing`]
    );
  }
}

async function getCourseMap(connection: Connection) {
  const [rows] = await connection.query<CourseRow[]>(
    `SELECT c.id, c.code, d.code AS dept_code
     FROM courses c JOIN departments d ON c.department_id = d.id`
  );
  return new Map(rows.map((row) => [`${row.dept_code}:${row.code}`, row.id]));
}

async function upsertProfiles(connection: Connection, userByEmail: Map<string, string>) {
  const all = [ADMIN_EMAIL, ...TUTOR_EMAILS, ...TUTEE_EMAILS];
  for (let i = 0; i < all.length; i += 1) {
    const email = all[i];
    const userId = userByEmail.get(email);
    if (!userId) continue;
    await connection.query(
      `INSERT INTO profiles (id, user_id, first_name, last_name, display_name, major, year_of_study, phone, bio)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), display_name = VALUES(display_name), major = VALUES(major), year_of_study = VALUES(year_of_study), phone = VALUES(phone), bio = VALUES(bio)`,
      [userId, `User${i + 1}`, "Seed", `User${i + 1}`, "Computer Science", "junior", `+1555000${pad(i + 1)}00`, "Seed profile"]
    );
  }
}

async function upsertRoles(connection: Connection, userByEmail: Map<string, string>) {
  const adminId = userByEmail.get(ADMIN_EMAIL);
  if (adminId) {
    await connection.query("INSERT IGNORE INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin')", [adminId]);
  }
  for (const email of TUTOR_EMAILS) {
    const id = userByEmail.get(email);
    if (id) await connection.query("INSERT IGNORE INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'tutor')", [id]);
  }
  for (const email of TUTEE_EMAILS) {
    const id = userByEmail.get(email);
    if (id) await connection.query("INSERT IGNORE INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'tutee')", [id]);
  }
}

async function upsertTutorProfiles(connection: Connection, userByEmail: Map<string, string>) {
  for (let i = 0; i < TUTOR_EMAILS.length; i += 1) {
    const userId = userByEmail.get(TUTOR_EMAILS[i]);
    if (!userId) continue;
    await connection.query(
      `INSERT INTO tutor_profiles (id, user_id, headline, about_me, hourly_rate, is_verified, is_available, is_featured)
       VALUES (UUID(), ?, ?, ?, ?, TRUE, TRUE, ?)
       ON DUPLICATE KEY UPDATE headline = VALUES(headline), about_me = VALUES(about_me), hourly_rate = VALUES(hourly_rate), is_verified = TRUE, is_available = TRUE, is_featured = VALUES(is_featured)`,
      [userId, `Tutor Headline ${i + 1}`, "Seeded tutor profile for testing.", 30 + i, i % 2]
    );
  }
}

async function clearOldSeedData(connection: Connection, userIds: string[], tutorIds: string[]) {
  await connection.query(`DELETE FROM reviews WHERE tutee_id IN (${ph(userIds.length)}) OR tutor_id IN (${ph(tutorIds.length)})`, [...userIds, ...tutorIds]);
  await connection.query(`DELETE FROM session_requests WHERE tutee_id IN (${ph(userIds.length)}) OR tutor_id IN (${ph(tutorIds.length)})`, [...userIds, ...tutorIds]);
  await connection.query(`DELETE FROM sessions WHERE tutee_id IN (${ph(userIds.length)}) OR tutor_id IN (${ph(tutorIds.length)})`, [...userIds, ...tutorIds]);
  await connection.query(`DELETE FROM tutor_availability WHERE tutor_id IN (${ph(tutorIds.length)})`, tutorIds);
  await connection.query(`DELETE FROM tutor_courses WHERE tutor_id IN (${ph(tutorIds.length)})`, tutorIds);
}

async function seedTutorCourses(connection: Connection, userByEmail: Map<string, string>, tutorByUserId: Map<string, string>, courseByKey: Map<string, string>) {
  const keys = COURSES.map((course) => `${course.dept}:${course.code}`);
  for (let i = 0; i < TUTOR_EMAILS.length; i += 1) {
    const userId = userByEmail.get(TUTOR_EMAILS[i]);
    const tutorId = userId ? tutorByUserId.get(userId) : null;
    if (!tutorId) continue;
    for (let j = 0; j < 4; j += 1) {
      const courseId = courseByKey.get(keys[(i + j) % keys.length]);
      if (!courseId) continue;
      await connection.query(`INSERT IGNORE INTO tutor_courses (id, tutor_id, course_id, proficiency_level, is_verified) VALUES (UUID(), ?, ?, 'advanced', TRUE)`, [tutorId, courseId]);
    }
  }
}

async function seedAvailability(connection: Connection, tutorIds: string[]) {
  const slots = [["monday", "09:00:00", "11:00:00"], ["wednesday", "13:00:00", "15:00:00"], ["friday", "10:00:00", "12:00:00"]];
  for (const tutorId of tutorIds) {
    for (const [day, start, end] of slots) {
      await connection.query(`INSERT INTO tutor_availability (id, tutor_id, day_of_week, start_time, end_time, is_recurring) VALUES (UUID(), ?, ?, ?, ?, TRUE)`, [tutorId, day, start, end]);
    }
  }
}

async function seedSessions(connection: Connection, userByEmail: Map<string, string>, tutorByUserId: Map<string, string>, courseByKey: Map<string, string>) {
  const tutorIds = TUTOR_EMAILS.map((email) => tutorByUserId.get(userByEmail.get(email) ?? "") ?? "").filter(Boolean);
  const tuteeIds = TUTEE_EMAILS.map((email) => userByEmail.get(email) ?? "").filter(Boolean);
  const courseIds = [...courseByKey.values()];
  const sessions: Array<{ id: string; status: string; payment_status: string; tutor_id: string }> = [];

  for (let i = 0; i < 32; i += 1) {
    const status = i < 24 ? "completed" : i < 29 ? "confirmed" : i === 29 ? "in_progress" : i === 30 ? "cancelled" : "no_show";
    const paymentStatus = i < 20 ? "paid" : i < 24 ? "due" : "unpaid";
    const id = crypto.randomUUID();
    const tutorId = tutorIds[i % tutorIds.length];
    const tuteeId = tuteeIds[(i * 3) % tuteeIds.length];
    const courseId = courseIds[i % courseIds.length];
    const dayOffset = status === "completed" || status === "no_show" ? -(i + 1) : i - 24;
    const sessionDate = dateShift(dayOffset);
    const start = `${pad(9 + (i % 6))}:00:00`;
    const end = `${pad(10 + (i % 6))}:00:00`;
    await connection.query(
      `INSERT INTO sessions (id, tutor_id, tutee_id, course_id, session_date, start_time, end_time, location_type, location_details, meeting_link, payment_method, payment_status, status, cancellation_reason, cancelled_by, cancelled_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tutorId, tuteeId, courseId, sessionDate, start, end, i % 2 ? "in_person" : "online", i % 2 ? "Library Room 2" : null, i % 2 ? null : "https://meet.google.com/seed-room", i % 3 ? "cash" : "paystack", paymentStatus, status, status === "cancelled" ? "Scheduling conflict" : null, status === "cancelled" ? tuteeId : null, status === "cancelled" ? new Date() : null, "Seeded session for testing"]
    );
    sessions.push({ id, status, payment_status: paymentStatus, tutor_id: tutorId });
  }
  return sessions;
}

async function seedSessionRequests(connection: Connection, userByEmail: Map<string, string>, tutorByUserId: Map<string, string>, courseByKey: Map<string, string>) {
  const tutorIds = TUTOR_EMAILS.map((email) => tutorByUserId.get(userByEmail.get(email) ?? "") ?? "").filter(Boolean);
  const tuteeIds = TUTEE_EMAILS.map((email) => userByEmail.get(email) ?? "").filter(Boolean);
  const courseIds = [...courseByKey.values()];
  for (let i = 0; i < 24; i += 1) {
    const status = i < 10 ? "pending" : i < 18 ? "accepted" : "declined";
    const preferred = JSON.stringify([{ date: dateShift(i + 2), startTime: "10:00:00", endTime: "11:00:00" }]);
    await connection.query(
      `INSERT INTO session_requests (id, tutor_id, tutee_id, course_id, preferred_dates, message, location_type, location_details, payment_method, status, responded_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), tutorIds[i % tutorIds.length], tuteeIds[(i * 2) % tuteeIds.length], courseIds[i % courseIds.length], preferred, "Seeded request to test request handling.", i % 2 ? "in_person" : "online", i % 2 ? "Science Block 4" : null, i % 3 ? "cash" : "paystack", status, status === "pending" ? null : new Date(), dateShift(i + 10)]
    );
  }
}

async function seedReviews(connection: Connection, sessions: Array<{ id: string; status: string; payment_status: string; tutor_id: string }>) {
  const targets = sessions.filter((s) => s.status === "completed" && s.payment_status === "paid").slice(0, 20);
  for (let i = 0; i < targets.length; i += 1) {
    const score = i % 2 ? 5 : 4;
    const [rows] = await connection.query<(RowDataPacket & { tutee_id: string; tutor_id: string })[]>(
      "SELECT tutee_id, tutor_id FROM sessions WHERE id = ?",
      [targets[i].id]
    );
    const row = rows[0];
    if (!row) continue;
    await connection.query(
      `INSERT INTO reviews (id, session_id, tutor_id, tutee_id, overall_rating, knowledge_rating, communication_rating, punctuality_rating, helpfulness_rating, review_text, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [crypto.randomUUID(), targets[i].id, row.tutor_id, row.tutee_id, score, score, 5, 4, 5, "Great session with clear explanations."]
    );
  }
}

async function refreshTutorStats(connection: Connection, tutorIds: string[]) {
  await connection.query(
    `UPDATE tutor_profiles tp
     SET total_sessions = (SELECT COUNT(*) FROM sessions s WHERE s.tutor_id = tp.id AND s.status = 'completed'),
         total_hours = (SELECT COALESCE(ROUND(SUM(TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time)) / 60, 2), 0) FROM sessions s WHERE s.tutor_id = tp.id AND s.status = 'completed'),
         average_rating = (SELECT COALESCE(ROUND(AVG(r.overall_rating), 2), 0) FROM reviews r WHERE r.tutor_id = tp.id AND r.is_visible = TRUE),
         total_reviews = (SELECT COUNT(*) FROM reviews r WHERE r.tutor_id = tp.id AND r.is_visible = TRUE)
     WHERE tp.id IN (${ph(tutorIds.length)})`,
    tutorIds
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
