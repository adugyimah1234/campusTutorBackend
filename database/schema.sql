 -- =====================================================
 -- Campus Peer Tutoring Platform - MySQL Database Schema
 -- Complete schema for Node.js/Express backend
 -- =====================================================
 
 -- Create database
 CREATE DATABASE IF NOT EXISTS campus_tutoring;
 USE campus_tutoring;
 
 -- =====================================================
 -- ENUMS (Using ENUM type for MySQL)
 -- =====================================================
 
 -- Note: MySQL uses ENUM directly in column definitions
 
 -- =====================================================
 -- USERS & AUTHENTICATION
 -- =====================================================
 
 -- Main users table for authentication
 CREATE TABLE users (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     email VARCHAR(255) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires DATETIME,
    pending_email VARCHAR(255),
    pending_email_token VARCHAR(255),
    pending_email_expires DATETIME,
    delete_account_token VARCHAR(255),
    delete_account_expires DATETIME,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
    INDEX idx_users_email (email),
    INDEX idx_users_verification_token (email_verification_token),
    INDEX idx_users_reset_token (password_reset_token),
    INDEX idx_users_pending_email_token (pending_email_token),
    INDEX idx_users_delete_account_token (delete_account_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- User roles table (separate for security - prevents privilege escalation)
 CREATE TABLE user_roles (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     user_id CHAR(36) NOT NULL,
     role ENUM('admin', 'tutor', 'tutee') NOT NULL,
     granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     granted_by CHAR(36),
     
     UNIQUE KEY unique_user_role (user_id, role),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_user_roles_user (user_id),
     INDEX idx_user_roles_role (role)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- User profiles table
 CREATE TABLE profiles (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     user_id CHAR(36) NOT NULL UNIQUE,
     first_name VARCHAR(100) NOT NULL,
     last_name VARCHAR(100) NOT NULL,
     display_name VARCHAR(100),
     avatar_url VARCHAR(500),
     bio TEXT,
     phone VARCHAR(20),
     university_id VARCHAR(50),
     major VARCHAR(100),
     year_of_study ENUM('freshman', 'sophomore', 'junior', 'senior', 'graduate', 'phd'),
     gpa DECIMAL(3, 2),
     timezone VARCHAR(50) DEFAULT 'America/New_York',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_profiles_user (user_id),
     INDEX idx_profiles_name (first_name, last_name),
     FULLTEXT INDEX idx_profiles_search (first_name, last_name, bio)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- COURSES & SUBJECTS
 -- =====================================================
 
 -- Departments/Categories
 CREATE TABLE departments (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     name VARCHAR(100) NOT NULL,
     code VARCHAR(10) NOT NULL UNIQUE,
     description TEXT,
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     INDEX idx_departments_code (code)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Courses table
 CREATE TABLE courses (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     department_id CHAR(36) NOT NULL,
     code VARCHAR(20) NOT NULL,
     name VARCHAR(200) NOT NULL,
     description TEXT,
     credits INT DEFAULT 3,
     difficulty_level ENUM('introductory', 'intermediate', 'advanced', 'graduate') DEFAULT 'intermediate',
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     UNIQUE KEY unique_course_code (department_id, code),
     FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
     INDEX idx_courses_department (department_id),
     INDEX idx_courses_code (code),
     FULLTEXT INDEX idx_courses_search (name, description)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- TUTOR-SPECIFIC TABLES
 -- =====================================================
 
 -- Tutor profiles (extended info for tutors)
 CREATE TABLE tutor_profiles (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     user_id CHAR(36) NOT NULL UNIQUE,
     headline VARCHAR(200),
     about_me TEXT,
     teaching_style TEXT,
     hourly_rate DECIMAL(10, 2),
     is_verified BOOLEAN DEFAULT FALSE,
     verification_date DATETIME,
     verified_by CHAR(36),
     total_sessions INT DEFAULT 0,
     total_hours DECIMAL(10, 2) DEFAULT 0,
     average_rating DECIMAL(3, 2) DEFAULT 0,
     total_reviews INT DEFAULT 0,
     is_available BOOLEAN DEFAULT TRUE,
     is_featured BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_tutor_profiles_user (user_id),
     INDEX idx_tutor_profiles_rating (average_rating DESC),
     INDEX idx_tutor_profiles_featured (is_featured, is_available)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Tutor-Course relationship (which courses a tutor can teach)
 CREATE TABLE tutor_courses (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     tutor_id CHAR(36) NOT NULL,
     course_id CHAR(36) NOT NULL,
     proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
     grade_received VARCHAR(5),
     is_verified BOOLEAN DEFAULT FALSE,
     notes TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     UNIQUE KEY unique_tutor_course (tutor_id, course_id),
     FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(id) ON DELETE CASCADE,
     FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
     INDEX idx_tutor_courses_tutor (tutor_id),
     INDEX idx_tutor_courses_course (course_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Tutor availability schedule
 CREATE TABLE tutor_availability (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     tutor_id CHAR(36) NOT NULL,
     day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
     start_time TIME NOT NULL,
     end_time TIME NOT NULL,
     is_recurring BOOLEAN DEFAULT TRUE,
     effective_from DATE,
     effective_until DATE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(id) ON DELETE CASCADE,
     INDEX idx_availability_tutor (tutor_id),
     INDEX idx_availability_day (day_of_week),
     CONSTRAINT chk_time_range CHECK (start_time < end_time)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Tutor blocked dates (vacations, exams, etc.)
 CREATE TABLE tutor_blocked_dates (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     tutor_id CHAR(36) NOT NULL,
     blocked_date DATE NOT NULL,
     start_time TIME,
     end_time TIME,
     reason VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     UNIQUE KEY unique_tutor_blocked (tutor_id, blocked_date, start_time),
     FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(id) ON DELETE CASCADE,
     INDEX idx_blocked_tutor (tutor_id),
     INDEX idx_blocked_date (blocked_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- SESSION BOOKING & MANAGEMENT
 -- =====================================================
 
 -- Tutoring sessions
 CREATE TABLE sessions (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     tutor_id CHAR(36) NOT NULL,
     tutee_id CHAR(36) NOT NULL,
     course_id CHAR(36) NOT NULL,
     session_date DATE NOT NULL,
     start_time TIME NOT NULL,
     end_time TIME NOT NULL,
     duration_minutes INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, start_time, end_time)) STORED,
     location_type ENUM('in_person', 'online') DEFAULT 'online',
     location_details VARCHAR(255),
      meeting_link VARCHAR(500),
      payment_method ENUM('cash', 'paystack') DEFAULT 'cash',
      payment_status ENUM('unpaid', 'due', 'paid') DEFAULT 'unpaid',
      status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
      reminder_24h_sent_at DATETIME,
      reminder_1h_sent_at DATETIME,
    cancellation_reason TEXT,
     cancelled_by CHAR(36),
     cancelled_at DATETIME,
     notes TEXT,
     tutee_notes TEXT,
     tutor_notes TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(id) ON DELETE RESTRICT,
     FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE RESTRICT,
     FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
     FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_sessions_tutor (tutor_id),
     INDEX idx_sessions_tutee (tutee_id),
     INDEX idx_sessions_course (course_id),
     INDEX idx_sessions_date (session_date),
     INDEX idx_sessions_status (status),
     INDEX idx_sessions_tutor_date (tutor_id, session_date),
     INDEX idx_sessions_tutee_date (tutee_id, session_date),
     CONSTRAINT chk_session_time CHECK (start_time < end_time)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Session requests (before confirmation)
 CREATE TABLE session_requests (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     tutor_id CHAR(36) NOT NULL,
     tutee_id CHAR(36) NOT NULL,
     course_id CHAR(36) NOT NULL,
     preferred_dates JSON,
     message TEXT,
     location_type ENUM('in_person', 'online') DEFAULT NULL,
       location_details VARCHAR(255),
       payment_method ENUM('cash', 'paystack') DEFAULT 'cash',
       status ENUM('pending', 'accepted', 'declined', 'expired') DEFAULT 'pending',
     response_message TEXT,
     responded_at DATETIME,
     expires_at DATETIME,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(id) ON DELETE CASCADE,
     FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
     INDEX idx_requests_tutor (tutor_id),
     INDEX idx_requests_tutee (tutee_id),
     INDEX idx_requests_status (status),
     INDEX idx_requests_expires (expires_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- FEEDBACK & RATINGS
 -- =====================================================
 
 -- Reviews/Feedback from tutees
 CREATE TABLE reviews (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     session_id CHAR(36) NOT NULL UNIQUE,
     tutor_id CHAR(36) NOT NULL,
     tutee_id CHAR(36) NOT NULL,
     overall_rating TINYINT NOT NULL,
     knowledge_rating TINYINT,
     communication_rating TINYINT,
     punctuality_rating TINYINT,
     helpfulness_rating TINYINT,
     review_text TEXT,
     is_anonymous BOOLEAN DEFAULT FALSE,
     is_visible BOOLEAN DEFAULT TRUE,
     tutor_response TEXT,
     tutor_responded_at DATETIME,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
     FOREIGN KEY (tutor_id) REFERENCES tutor_profiles(id) ON DELETE CASCADE,
     FOREIGN KEY (tutee_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_reviews_tutor (tutor_id),
     INDEX idx_reviews_tutee (tutee_id),
     INDEX idx_reviews_rating (overall_rating),
     INDEX idx_reviews_created (created_at DESC),
     CONSTRAINT chk_overall_rating CHECK (overall_rating BETWEEN 1 AND 5),
     CONSTRAINT chk_knowledge_rating CHECK (knowledge_rating IS NULL OR knowledge_rating BETWEEN 1 AND 5),
     CONSTRAINT chk_communication_rating CHECK (communication_rating IS NULL OR communication_rating BETWEEN 1 AND 5),
     CONSTRAINT chk_punctuality_rating CHECK (punctuality_rating IS NULL OR punctuality_rating BETWEEN 1 AND 5),
     CONSTRAINT chk_helpfulness_rating CHECK (helpfulness_rating IS NULL OR helpfulness_rating BETWEEN 1 AND 5)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- MESSAGING SYSTEM
 -- =====================================================
 
 -- Conversations between users
 CREATE TABLE conversations (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     participant_one CHAR(36) NOT NULL,
     participant_two CHAR(36) NOT NULL,
     last_message_at DATETIME,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     UNIQUE KEY unique_conversation (participant_one, participant_two),
     FOREIGN KEY (participant_one) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (participant_two) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_conversations_participants (participant_one, participant_two),
     INDEX idx_conversations_last_message (last_message_at DESC)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Messages
 CREATE TABLE messages (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     conversation_id CHAR(36) NOT NULL,
     sender_id CHAR(36) NOT NULL,
     content TEXT NOT NULL,
     is_read BOOLEAN DEFAULT FALSE,
     read_at DATETIME,
     is_deleted BOOLEAN DEFAULT FALSE,
     deleted_at DATETIME,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
     FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_messages_conversation (conversation_id),
     INDEX idx_messages_sender (sender_id),
     INDEX idx_messages_created (created_at DESC),
     INDEX idx_messages_unread (conversation_id, is_read)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- NOTIFICATIONS
 -- =====================================================
 
 CREATE TABLE notifications (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     user_id CHAR(36) NOT NULL,
     type ENUM(
         'session_request', 
         'session_confirmed', 
         'session_cancelled', 
         'session_reminder',
         'new_message',
         'new_review',
         'profile_verified',
         'system_announcement'
     ) NOT NULL,
     title VARCHAR(200) NOT NULL,
     message TEXT,
     data JSON,
     is_read BOOLEAN DEFAULT FALSE,
     read_at DATETIME,
     action_url VARCHAR(500),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_notifications_user (user_id),
     INDEX idx_notifications_unread (user_id, is_read),
     INDEX idx_notifications_type (type),
     INDEX idx_notifications_created (created_at DESC)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- ADMIN & REPORTING
 -- =====================================================
 
 -- Admin activity log
 CREATE TABLE admin_logs (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     admin_id CHAR(36) NOT NULL,
     action VARCHAR(100) NOT NULL,
     entity_type VARCHAR(50),
     entity_id CHAR(36),
     old_values JSON,
     new_values JSON,
     ip_address VARCHAR(45),
     user_agent VARCHAR(500),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_admin_logs_admin (admin_id),
     INDEX idx_admin_logs_action (action),
     INDEX idx_admin_logs_entity (entity_type, entity_id),
     INDEX idx_admin_logs_created (created_at DESC)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- Report issues/complaints
 CREATE TABLE reports (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     reporter_id CHAR(36) NOT NULL,
     reported_user_id CHAR(36),
     session_id CHAR(36),
     type ENUM('inappropriate_behavior', 'no_show', 'harassment', 'spam', 'other') NOT NULL,
     description TEXT NOT NULL,
     evidence_urls JSON,
     status ENUM('pending', 'under_review', 'resolved', 'dismissed') DEFAULT 'pending',
     resolution TEXT,
     resolved_by CHAR(36),
     resolved_at DATETIME,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     
     FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
     FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
     FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_reports_reporter (reporter_id),
     INDEX idx_reports_reported (reported_user_id),
     INDEX idx_reports_status (status),
     INDEX idx_reports_created (created_at DESC)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- SESSION TOKENS & SECURITY
 -- =====================================================
 
 -- Refresh tokens for JWT auth
 CREATE TABLE refresh_tokens (
     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
     user_id CHAR(36) NOT NULL,
     token_hash VARCHAR(255) NOT NULL UNIQUE,
     device_info VARCHAR(500),
     ip_address VARCHAR(45),
     expires_at DATETIME NOT NULL,
     is_revoked BOOLEAN DEFAULT FALSE,
     revoked_at DATETIME,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_refresh_tokens_user (user_id),
     INDEX idx_refresh_tokens_hash (token_hash),
     INDEX idx_refresh_tokens_expires (expires_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
 -- =====================================================
 -- VIEWS FOR COMMON QUERIES
 -- =====================================================
 
 -- View: Tutor with full details
 CREATE VIEW v_tutor_details AS
 SELECT 
     tp.id AS tutor_id,
     u.id AS user_id,
     u.email,
     p.first_name,
     p.last_name,
     p.display_name,
     p.avatar_url,
     p.major,
     p.year_of_study,
     tp.headline,
     tp.about_me,
     tp.hourly_rate,
     tp.is_verified,
     tp.is_available,
     tp.is_featured,
     tp.average_rating,
     tp.total_reviews,
     tp.total_sessions,
     tp.total_hours
 FROM tutor_profiles tp
 JOIN users u ON tp.user_id = u.id
 JOIN profiles p ON u.id = p.user_id
 WHERE u.is_active = TRUE;
 
 -- View: Sessions with participant details
 CREATE VIEW v_session_details AS
 SELECT 
     s.id AS session_id,
     s.session_date,
     s.start_time,
     s.end_time,
     s.duration_minutes,
     s.status,
     s.location_type,
     s.meeting_link,
     c.code AS course_code,
     c.name AS course_name,
     -- Tutor info
     tp.id AS tutor_id,
     tu.id AS tutor_user_id,
     tprof.first_name AS tutor_first_name,
     tprof.last_name AS tutor_last_name,
     tprof.avatar_url AS tutor_avatar,
     -- Tutee info
     s.tutee_id,
     sprof.first_name AS tutee_first_name,
     sprof.last_name AS tutee_last_name,
     sprof.avatar_url AS tutee_avatar
 FROM sessions s
 JOIN tutor_profiles tp ON s.tutor_id = tp.id
 JOIN users tu ON tp.user_id = tu.id
 JOIN profiles tprof ON tu.id = tprof.user_id
 JOIN profiles sprof ON s.tutee_id = sprof.user_id
 JOIN courses c ON s.course_id = c.id;
 
 -- =====================================================
 -- TRIGGERS
 -- =====================================================
 
 DELIMITER //
 
 -- Update tutor stats after session completion
 CREATE TRIGGER tr_update_tutor_stats_after_session
 AFTER UPDATE ON sessions
 FOR EACH ROW
 BEGIN
     IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
         UPDATE tutor_profiles 
         SET 
             total_sessions = total_sessions + 1,
             total_hours = total_hours + (NEW.duration_minutes / 60)
         WHERE id = NEW.tutor_id;
     END IF;
 END//
 
 -- Update tutor average rating after new review
 CREATE TRIGGER tr_update_tutor_rating_after_review
 AFTER INSERT ON reviews
 FOR EACH ROW
 BEGIN
     UPDATE tutor_profiles 
     SET 
         average_rating = (
             SELECT AVG(overall_rating) 
             FROM reviews 
             WHERE tutor_id = NEW.tutor_id AND is_visible = TRUE
         ),
         total_reviews = (
             SELECT COUNT(*) 
             FROM reviews 
             WHERE tutor_id = NEW.tutor_id AND is_visible = TRUE
         )
     WHERE id = NEW.tutor_id;
 END//
 
 -- Update conversation last_message_at
 CREATE TRIGGER tr_update_conversation_on_message
 AFTER INSERT ON messages
 FOR EACH ROW
 BEGIN
     UPDATE conversations 
     SET last_message_at = NEW.created_at 
     WHERE id = NEW.conversation_id;
 END//
 
 DELIMITER ;
 
 -- =====================================================
 -- STORED PROCEDURES
 -- =====================================================
 
 DELIMITER //
 
 -- Check if user has a specific role
 CREATE PROCEDURE sp_has_role(
     IN p_user_id CHAR(36),
     IN p_role VARCHAR(20),
     OUT p_has_role BOOLEAN
 )
 BEGIN
     SELECT EXISTS(
         SELECT 1 FROM user_roles 
         WHERE user_id = p_user_id AND role = p_role
     ) INTO p_has_role;
 END//
 
 -- Get tutor availability for a specific date
 CREATE PROCEDURE sp_get_tutor_availability(
     IN p_tutor_id CHAR(36),
     IN p_date DATE
 )
 BEGIN
     DECLARE v_day_of_week VARCHAR(10);
     SET v_day_of_week = LOWER(DAYNAME(p_date));
     
     SELECT 
         ta.start_time,
         ta.end_time
     FROM tutor_availability ta
     WHERE ta.tutor_id = p_tutor_id
         AND ta.day_of_week = v_day_of_week
         AND (ta.effective_from IS NULL OR ta.effective_from <= p_date)
         AND (ta.effective_until IS NULL OR ta.effective_until >= p_date)
         AND NOT EXISTS (
             SELECT 1 FROM tutor_blocked_dates tbd
             WHERE tbd.tutor_id = p_tutor_id
                 AND tbd.blocked_date = p_date
                 AND (
                     (tbd.start_time IS NULL) OR
                     (ta.start_time < tbd.end_time AND ta.end_time > tbd.start_time)
                 )
         );
 END//
 
 -- Search tutors by course or name
 CREATE PROCEDURE sp_search_tutors(
     IN p_search_term VARCHAR(100),
     IN p_course_id CHAR(36),
     IN p_min_rating DECIMAL(3,2),
     IN p_limit INT,
     IN p_offset INT
 )
 BEGIN
     SELECT 
         vt.*,
         GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ') AS courses
     FROM v_tutor_details vt
     LEFT JOIN tutor_courses tc ON vt.tutor_id = tc.tutor_id
     LEFT JOIN courses c ON tc.course_id = c.id
     WHERE vt.is_available = TRUE
         AND (p_search_term IS NULL OR 
              vt.first_name LIKE CONCAT('%', p_search_term, '%') OR
              vt.last_name LIKE CONCAT('%', p_search_term, '%') OR
              c.name LIKE CONCAT('%', p_search_term, '%'))
         AND (p_course_id IS NULL OR tc.course_id = p_course_id)
         AND (p_min_rating IS NULL OR vt.average_rating >= p_min_rating)
     GROUP BY vt.tutor_id
     ORDER BY vt.is_featured DESC, vt.average_rating DESC, vt.total_sessions DESC
     LIMIT p_limit OFFSET p_offset;
 END//
 
DELIMITER ;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    body VARCHAR(512) NOT NULL,
    payload JSON DEFAULT NULL,
    link VARCHAR(512) DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_read (user_id, is_read),
    INDEX idx_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INITIAL SEED DATA
-- =====================================================
 
 -- Insert departments
 INSERT INTO departments (id, name, code, description) VALUES
 (UUID(), 'Mathematics', 'MATH', 'Mathematics and Statistics courses'),
 (UUID(), 'Computer Science', 'CS', 'Computer Science and Programming courses'),
 (UUID(), 'Chemistry', 'CHEM', 'Chemistry and Biochemistry courses'),
 (UUID(), 'Physics', 'PHYS', 'Physics and Astronomy courses'),
 (UUID(), 'Biology', 'BIO', 'Biology and Life Sciences courses'),
 (UUID(), 'Economics', 'ECON', 'Economics and Finance courses'),
 (UUID(), 'English', 'ENG', 'English and Literature courses'),
 (UUID(), 'Psychology', 'PSYCH', 'Psychology courses'),
 (UUID(), 'Engineering', 'ENGR', 'Engineering courses');
