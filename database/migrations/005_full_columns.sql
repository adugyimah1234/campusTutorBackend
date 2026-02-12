-- Add missing columns across core tables (MySQL 5.7 compatible)

SET @db := DATABASE();

-- users
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verification_token');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_reset_token');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_reset_expires');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN last_login DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- profiles
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'display_name');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN display_name VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'avatar_url');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN avatar_url VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'bio');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN bio TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'phone');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN phone VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'university_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN university_id VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'major');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN major VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'year_of_study');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN year_of_study ENUM(''freshman'',''sophomore'',''junior'',''senior'',''graduate'',''phd'') NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'gpa');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN gpa DECIMAL(3,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'timezone');
SET @sql := IF(@exists = 0, 'ALTER TABLE profiles ADD COLUMN timezone VARCHAR(50) DEFAULT ''America/New_York''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- departments
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'description');
SET @sql := IF(@exists = 0, 'ALTER TABLE departments ADD COLUMN description TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'is_active');
SET @sql := IF(@exists = 0, 'ALTER TABLE departments ADD COLUMN is_active BOOLEAN DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE departments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- courses
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'description');
SET @sql := IF(@exists = 0, 'ALTER TABLE courses ADD COLUMN description TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'credits');
SET @sql := IF(@exists = 0, 'ALTER TABLE courses ADD COLUMN credits INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'difficulty_level');
SET @sql := IF(@exists = 0, 'ALTER TABLE courses ADD COLUMN difficulty_level ENUM(''introductory'',''intermediate'',''advanced'') NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'is_active');
SET @sql := IF(@exists = 0, 'ALTER TABLE courses ADD COLUMN is_active BOOLEAN DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE courses ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE courses ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tutor_profiles
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'headline');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN headline VARCHAR(200) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'about_me');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN about_me TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'teaching_style');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN teaching_style TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'hourly_rate');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN hourly_rate DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'is_verified');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'verification_date');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN verification_date DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'verified_by');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN verified_by CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'total_sessions');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN total_sessions INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'total_hours');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN total_hours DECIMAL(10,2) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'average_rating');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'total_reviews');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN total_reviews INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'is_available');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN is_available BOOLEAN DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'is_featured');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN is_featured BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_profiles' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_profiles ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tutor_courses
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_courses' AND COLUMN_NAME = 'proficiency_level');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_courses ADD COLUMN proficiency_level ENUM(''beginner'',''intermediate'',''advanced'',''expert'') DEFAULT ''intermediate''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_courses' AND COLUMN_NAME = 'grade_received');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_courses ADD COLUMN grade_received VARCHAR(5) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_courses' AND COLUMN_NAME = 'is_verified');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_courses ADD COLUMN is_verified BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_courses' AND COLUMN_NAME = 'notes');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_courses ADD COLUMN notes TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_courses' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_courses ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tutor_availability
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_availability' AND COLUMN_NAME = 'is_recurring');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_availability ADD COLUMN is_recurring BOOLEAN DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_availability' AND COLUMN_NAME = 'effective_from');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_availability ADD COLUMN effective_from DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_availability' AND COLUMN_NAME = 'effective_until');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_availability ADD COLUMN effective_until DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_availability' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_availability ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_availability' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_availability ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tutor_blocked_dates
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_blocked_dates' AND COLUMN_NAME = 'start_time');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_blocked_dates ADD COLUMN start_time TIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_blocked_dates' AND COLUMN_NAME = 'end_time');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_blocked_dates ADD COLUMN end_time TIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_blocked_dates' AND COLUMN_NAME = 'reason');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_blocked_dates ADD COLUMN reason VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tutor_blocked_dates' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE tutor_blocked_dates ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sessions
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'duration_minutes');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN duration_minutes INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, start_time, end_time)) STORED', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'location_type');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN location_type ENUM(''in_person'',''online'') DEFAULT ''online''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'location_details');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN location_details VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'meeting_link');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN meeting_link VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'payment_method');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN payment_method ENUM(''cash'',''paystack'') DEFAULT ''cash''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'payment_status');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN payment_status ENUM(''unpaid'',''due'',''paid'') DEFAULT ''unpaid''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'status');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN status ENUM(''pending'',''confirmed'',''in_progress'',''completed'',''cancelled'',''no_show'') DEFAULT ''pending''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'cancellation_reason');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN cancellation_reason TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'cancelled_by');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN cancelled_by CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'cancelled_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN cancelled_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'notes');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN notes TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'tutee_notes');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN tutee_notes TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'tutor_notes');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN tutor_notes TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE sessions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- session_requests
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'location_type');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN location_type ENUM(''in_person'',''online'') DEFAULT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'location_details');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN location_details VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'payment_method');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN payment_method ENUM(''cash'',''paystack'') DEFAULT ''cash''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'status');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN status ENUM(''pending'',''accepted'',''declined'',''expired'') DEFAULT ''pending''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'response_message');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN response_message TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'responded_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN responded_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'expires_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN expires_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE session_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviews
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'knowledge_rating');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN knowledge_rating TINYINT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'communication_rating');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN communication_rating TINYINT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'punctuality_rating');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN punctuality_rating TINYINT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'helpfulness_rating');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN helpfulness_rating TINYINT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'is_anonymous');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'is_visible');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN is_visible BOOLEAN DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'tutor_response');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN tutor_response TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'tutor_responded_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN tutor_responded_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE reviews ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- conversations
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'last_message_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE conversations ADD COLUMN last_message_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE conversations ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- messages
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'is_read');
SET @sql := IF(@exists = 0, 'ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'read_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE messages ADD COLUMN read_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'is_deleted');
SET @sql := IF(@exists = 0, 'ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'deleted_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE messages ADD COLUMN deleted_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE messages ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notifications
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'body');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN body VARCHAR(512) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'payload');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN payload JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'link');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN link VARCHAR(512) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'message');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN message TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'data');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN data JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'action_url');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN action_url VARCHAR(512) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'is_read');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'read_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN read_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reports
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'session_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN session_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'evidence_urls');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN evidence_urls JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'status');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN status ENUM(''pending'',''under_review'',''resolved'',''dismissed'') DEFAULT ''pending''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'resolution');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN resolution TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'resolved_by');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN resolved_by CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'resolved_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN resolved_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'updated_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- refresh_tokens
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'device_info');
SET @sql := IF(@exists = 0, 'ALTER TABLE refresh_tokens ADD COLUMN device_info VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'ip_address');
SET @sql := IF(@exists = 0, 'ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'is_revoked');
SET @sql := IF(@exists = 0, 'ALTER TABLE refresh_tokens ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'revoked_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE refresh_tokens ADD COLUMN revoked_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE refresh_tokens ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- admin_logs
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'admin_logs' AND COLUMN_NAME = 'entity_type');
SET @sql := IF(@exists = 0, 'ALTER TABLE admin_logs ADD COLUMN entity_type VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'admin_logs' AND COLUMN_NAME = 'entity_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE admin_logs ADD COLUMN entity_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'admin_logs' AND COLUMN_NAME = 'old_values');
SET @sql := IF(@exists = 0, 'ALTER TABLE admin_logs ADD COLUMN old_values JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'admin_logs' AND COLUMN_NAME = 'new_values');
SET @sql := IF(@exists = 0, 'ALTER TABLE admin_logs ADD COLUMN new_values JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'admin_logs' AND COLUMN_NAME = 'created_at');
SET @sql := IF(@exists = 0, 'ALTER TABLE admin_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
