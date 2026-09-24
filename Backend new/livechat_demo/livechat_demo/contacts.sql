CREATE TABLE IF NOT EXISTS contacts (
  owner_id VARCHAR(191) NOT NULL,
  contact_id VARCHAR(191) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_id, contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
