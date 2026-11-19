CREATE DATABASE IF NOT EXISTS repairdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE repairdb;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  full_name  VARCHAR(100) NOT NULL,
  phone      VARCHAR(20)  NULL,
  role       ENUM('admin','technician','user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS repair_requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  location      VARCHAR(150) NULL,
  category_id   INT NULL,
  requester_id  INT NOT NULL,
  technician_id INT NULL,
  priority      ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  status        ENUM('pending','assigned','in_progress','done','cancelled') NOT NULL DEFAULT 'pending',
  file_path     VARCHAR(255) NULL,
  tech_note     VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_category   FOREIGN KEY (category_id)   REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_req_requester  FOREIGN KEY (requester_id)  REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_req_technician FOREIGN KEY (technician_id) REFERENCES users(id)      ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS repair_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  actor_id   INT NULL,
  action     VARCHAR(30)  NOT NULL,
  note       VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_request FOREIGN KEY (request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_actor   FOREIGN KEY (actor_id)   REFERENCES users(id)           ON DELETE SET NULL
);
