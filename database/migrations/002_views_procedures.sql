-- Create or refresh views and stored procedures

DROP VIEW IF EXISTS v_tutor_details;
DROP VIEW IF EXISTS v_session_details;

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

DROP PROCEDURE IF EXISTS sp_has_role;
DROP PROCEDURE IF EXISTS sp_get_tutor_availability;
DROP PROCEDURE IF EXISTS sp_search_tutors;

DELIMITER //

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
