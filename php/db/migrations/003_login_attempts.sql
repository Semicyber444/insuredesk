-- Failed sign-ins, used to throttle password guessing. Rows are pruned by the app.
CREATE TABLE login_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email_hash CHAR(64) NOT NULL,
  attempted_at DATETIME(3) NOT NULL,
  KEY idx_login_attempts_email (email_hash, attempted_at),
  KEY idx_login_attempts_time (attempted_at)
);
