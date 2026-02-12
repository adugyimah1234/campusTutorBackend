-- Add reminder sent timestamps for sessions (MySQL 5.7 compatible)

SET @db := DATABASE();

-- sessions.reminder_24h_sent_at
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'reminder_24h_sent_at'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE sessions ADD COLUMN reminder_24h_sent_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.reminder_1h_sent_at
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'reminder_1h_sent_at'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE sessions ADD COLUMN reminder_1h_sent_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
