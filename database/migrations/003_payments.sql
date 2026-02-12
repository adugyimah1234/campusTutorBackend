-- Add payment fields for sessions and requests (MySQL 5.7 compatible)

SET @db := DATABASE();

-- sessions.payment_method
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'payment_method'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE sessions ADD COLUMN payment_method ENUM(''cash'',''paystack'') DEFAULT ''cash''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sessions.payment_status
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'payment_status'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE sessions ADD COLUMN payment_status ENUM(''unpaid'',''due'',''paid'') DEFAULT ''unpaid''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- session_requests.payment_method
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'session_requests' AND COLUMN_NAME = 'payment_method'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE session_requests ADD COLUMN payment_method ENUM(''cash'',''paystack'') DEFAULT ''cash''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
