// ── SQLite Database Singleton ──
// Persistent storage for matches, match cards, owner tokens, and approvals.
// Uses globalThis to survive Next.js HMR, same pattern as world-state.ts.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'claworld.db');

// Ensure the data directory exists (for fresh Railway deploys)
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Migrations ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id              TEXT PRIMARY KEY,
      proposer_bot_id TEXT NOT NULL,
      target_bot_id   TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'proposed',
      reason          TEXT NOT NULL DEFAULT '',
      created_at      INTEGER NOT NULL,
      resolved_at     INTEGER
    );

    CREATE TABLE IF NOT EXISTS match_cards (
      match_id        TEXT PRIMARY KEY REFERENCES matches(id),
      shared_values   TEXT NOT NULL DEFAULT '[]',
      differences     TEXT NOT NULL DEFAULT '[]',
      highlights      TEXT NOT NULL DEFAULT '[]',
      bot_a_summary   TEXT NOT NULL DEFAULT '',
      bot_b_summary   TEXT NOT NULL DEFAULT '',
      extra_data      TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS owner_tokens (
      token           TEXT PRIMARY KEY,
      bot_id          TEXT NOT NULL,
      created_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_approvals (
      match_id        TEXT NOT NULL REFERENCES matches(id),
      bot_id          TEXT NOT NULL,
      approved        INTEGER NOT NULL DEFAULT 0,
      contact_info    TEXT NOT NULL DEFAULT '',
      approved_at     INTEGER,
      PRIMARY KEY (match_id, bot_id)
    );
  `);

  return db;
}

// ── Singleton (survives Next.js HMR) ──
const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb();
  }
  return globalForDb.__db;
}

// ── Types ──

export interface Match {
  id: string;
  proposer_bot_id: string;
  target_bot_id: string;
  status: 'proposed' | 'confirmed' | 'matched' | 'rejected';
  reason: string;
  created_at: number;
  resolved_at: number | null;
}

export interface MatchCard {
  match_id: string;
  shared_values: string; // JSON array
  differences: string;   // JSON array
  highlights: string;    // JSON array
  bot_a_summary: string;
  bot_b_summary: string;
  extra_data: string;    // JSON object
}

export interface OwnerToken {
  token: string;
  bot_id: string;
  created_at: number;
}

export interface MatchApproval {
  match_id: string;
  bot_id: string;
  approved: number; // 0=pending, 1=approved, -1=rejected
  contact_info: string;
  approved_at: number | null;
}
