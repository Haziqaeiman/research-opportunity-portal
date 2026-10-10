-- schema.sql
-- Creates the database and the table used by the Research Opportunity Portal.
-- Run once:  mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS research_portal;
USE research_portal;

-- One row = one research opportunity. One column = one piece of information.
CREATE TABLE IF NOT EXISTS opportunities (
    id               INT AUTO_INCREMENT PRIMARY KEY,          -- unique ID, MySQL generates it
    title            VARCHAR(200) NOT NULL,                   -- research title
    description      TEXT         NOT NULL,                   -- research description
    research_area    VARCHAR(100) NOT NULL,                   -- research area
    faculty_name     VARCHAR(100) NOT NULL,                   -- faculty member's name
    department       VARCHAR(100) NOT NULL,                   -- department
    required_skills  VARCHAR(300) NOT NULL,                   -- required skills
    positions        INT          NOT NULL,                   -- number of available positions
    deadline         DATE         NOT NULL,                   -- application deadline (YYYY-MM-DD)
    status           ENUM('Open','Closed') NOT NULL DEFAULT 'Open'  -- Open or Closed only
);
