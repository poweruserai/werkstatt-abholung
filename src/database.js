const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/werkstatt.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// WAL-Modus für bessere Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    kennzeichen TEXT NOT NULL,
    fahrzeug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'angenommen'
      CHECK(status IN ('angenommen','in_bearbeitung','wartet_auf_teile','fertig','abgeholt')),
    annahme_datum DATETIME DEFAULT CURRENT_TIMESTAMP,
    abhol_datum DATE,
    fertig_datum DATETIME,
    abgeholt_datum DATETIME,
    notizen TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_token ON vehicles(token);
  CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
`);

// Migration: E-Mail-Feld nachrüsten (für bestehende Datenbanken)
try { db.exec('ALTER TABLE vehicles ADD COLUMN kunde_email TEXT'); } catch {}

module.exports = db;
