-- Add location fields to session_requests (MySQL 5.7 compatible)

SET @db := DATABASE();

-- session_requests.location_type
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'location_type'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE session_requests ADD COLUMN location_type ENUM(''in_person'',''online'') DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- session_requests.location_details
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'location_details'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE session_requests ADD COLUMN location_details VARCHAR(255) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
