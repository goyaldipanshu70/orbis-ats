-- Create databases for each logical service group
CREATE DATABASE auth_db;
CREATE DATABASE recruiting_db;
CREATE DATABASE chat_db;

-- Grant all privileges to the application user
GRANT ALL PRIVILEGES ON DATABASE auth_db TO CURRENT_USER;
GRANT ALL PRIVILEGES ON DATABASE recruiting_db TO CURRENT_USER;
GRANT ALL PRIVILEGES ON DATABASE chat_db TO CURRENT_USER;

-- Enable pgvector extension in chat_db
\c chat_db;
CREATE EXTENSION IF NOT EXISTS vector;
