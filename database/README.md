 # Campus Peer Tutoring Platform - Database Documentation
 
 ## Overview
 
 This database schema supports a comprehensive peer tutoring platform with the following features:
 - User authentication and role-based access control
 - Tutor profiles with courses, availability, and ratings
 - Session booking and management
 - Reviews and feedback system
 - Messaging between users
 - Notifications
 - Admin monitoring and reporting
 
 ## Technology Stack
 
 - **Database**: MySQL 8.0+
 - **Backend**: Node.js with Express.js
 - **ORM Recommendation**: Prisma, Sequelize, or TypeORM
 
 ## Schema Setup
 
 ### 1. Create Database
 
 ```bash
 mysql -u root -p < database/schema.sql
 ```
 
 ### 2. Environment Variables
 
 ```env
 DB_HOST=localhost
 DB_PORT=3306
 DB_NAME=campus_tutoring
 DB_USER=your_username
 DB_PASSWORD=your_password
 
 JWT_SECRET=your-super-secret-key
 JWT_REFRESH_SECRET=your-refresh-secret
 JWT_EXPIRES_IN=15m
 JWT_REFRESH_EXPIRES_IN=7d
 ```
 
 ## Tables Overview
 
 ### Authentication & Users
 
 | Table | Description |
 |-------|-------------|
 | `users` | Core user authentication data |
 | `user_roles` | User role assignments (admin, tutor, tutee) |
 | `profiles` | Extended user profile information |
 | `refresh_tokens` | JWT refresh tokens for authentication |
 
 ### Courses
 
 | Table | Description |
 |-------|-------------|
 | `departments` | Academic departments/categories |
 | `courses` | Available courses for tutoring |
 
 ### Tutor System
 
 | Table | Description |
 |-------|-------------|
 | `tutor_profiles` | Extended tutor information and stats |
 | `tutor_courses` | Courses each tutor can teach |
 | `tutor_availability` | Weekly availability schedule |
 | `tutor_blocked_dates` | Specific dates tutor is unavailable |
 
 ### Sessions
 
 | Table | Description |
 |-------|-------------|
 | `sessions` | Booked tutoring sessions |
 | `session_requests` | Pending session requests |
 | `reviews` | Post-session reviews and ratings |
 
 ### Communication
 
 | Table | Description |
 |-------|-------------|
 | `conversations` | Chat threads between users |
 | `messages` | Individual messages |
 | `notifications` | User notifications |
 
 ### Admin
 
 | Table | Description |
 |-------|-------------|
 | `admin_logs` | Admin activity audit trail |
 | `reports` | User reports and complaints |
 
 ## Key Features
 
 ### Security
 
 1. **Role-based Access Control**: Roles stored in separate table to prevent privilege escalation
 2. **Password Security**: Passwords stored as hashes (use bcrypt in Node.js)
 3. **Token Management**: Refresh tokens stored with device info for session management
 
 ### Stored Procedures
 
 - `sp_has_role(user_id, role)` - Check if user has a specific role
 - `sp_get_tutor_availability(tutor_id, date)` - Get available time slots
 - `sp_search_tutors(search, course_id, min_rating, limit, offset)` - Search tutors
 
 ### Triggers
 
 - Auto-update tutor stats when session completes
 - Auto-recalculate average rating when new review added
 - Auto-update conversation timestamp on new message
 
 ### Views
 
 - `v_tutor_details` - Tutor with profile and stats
 - `v_session_details` - Session with participant info
 
 ## Node.js Integration Example
 
 ```javascript
 // Using mysql2 with connection pool
 const mysql = require('mysql2/promise');
 
 const pool = mysql.createPool({
   host: process.env.DB_HOST,
   user: process.env.DB_USER,
   password: process.env.DB_PASSWORD,
   database: process.env.DB_NAME,
   waitForConnections: true,
   connectionLimit: 10,
   queueLimit: 0
 });
 
 // Example: Search tutors
 async function searchTutors(searchTerm, courseId, minRating) {
   const [rows] = await pool.execute(
     'CALL sp_search_tutors(?, ?, ?, 20, 0)',
     [searchTerm, courseId, minRating]
   );
   return rows[0];
 }
 
 // Example: Create session
 async function createSession(data) {
   const [result] = await pool.execute(
     `INSERT INTO sessions (tutor_id, tutee_id, course_id, session_date, 
      start_time, end_time, location_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
     [data.tutor_id, data.tutee_id, data.course_id, data.session_date,
      data.start_time, data.end_time, data.location_type, data.notes]
   );
   return result.insertId;
 }
 ```
 
 ## Indexes
 
 The schema includes optimized indexes for:
 - User lookups by email
 - Session queries by date and status
 - Tutor search by rating and availability
 - Message retrieval by conversation
 - Full-text search on profiles and courses
 
 ## Data Integrity
 
 - Foreign key constraints with appropriate ON DELETE actions
 - Check constraints for ratings (1-5 range)
 - Unique constraints to prevent duplicates
 - NOT NULL constraints on required fields
 
 ## Scaling Considerations
 
 For production scaling:
 1. Add read replicas for search queries
 2. Consider partitioning sessions table by date
 3. Archive old sessions to separate table
 4. Use Redis for caching tutor availability
 5. Implement connection pooling