import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDirectory = path.join(__dirname, 'data');
fs.mkdirSync(dbDirectory, { recursive: true });

const dbPath = process.env.DATABASE_FILE
    ? path.resolve(process.env.DATABASE_FILE)
    : path.join(dbDirectory, 'gt3.db');

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    generation TEXT,
    year INTEGER,
    engine TEXT,
    power INTEGER,
    torque INTEGER,
    weight INTEGER,
    top_speed INTEGER,
    image_url TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_cars_updated_at
AFTER UPDATE ON cars
FOR EACH ROW
BEGIN
    UPDATE cars SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT,
    length_km REAL,
    type TEXT,
    location TEXT,
    turns INTEGER,
    established INTEGER,
    image_url TEXT,
    card_image_url TEXT,
    detail_image_url TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_tracks_updated_at
AFTER UPDATE ON tracks
FOR EACH ROW
BEGIN
    UPDATE tracks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT,
    founded INTEGER,
    series TEXT,
    cars TEXT,
    logo TEXT,
    image_url TEXT,
    description TEXT,
    stats TEXT,
    achievements TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_teams_updated_at
AFTER UPDATE ON teams
FOR EACH ROW
BEGIN
    UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS champions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    series TEXT NOT NULL,
    team_name TEXT NOT NULL,
    drivers TEXT,
    car TEXT,
    image_url TEXT,
    stats TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_champions_updated_at
AFTER UPDATE ON champions
FOR EACH ROW
BEGIN
    UPDATE champions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS pilots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nationality TEXT,
    flag TEXT,
    team TEXT,
    car TEXT,
    championships TEXT,
    stats TEXT,
    series TEXT,
    tags TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_pilots_updated_at
AFTER UPDATE ON pilots
FOR EACH ROW
BEGIN
    UPDATE pilots SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`);

try {
    db.prepare('ALTER TABLE tracks ADD COLUMN card_image_url TEXT').run();
} catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
        throw error;
    }
}

try {
    db.prepare('ALTER TABLE tracks ADD COLUMN detail_image_url TEXT').run();
} catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
        throw error;
    }
}

export default db;
