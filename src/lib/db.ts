import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { calculateItemizedBudget } from "@/lib/budget-calculator";
import type {
  AuthUser,
  ChatHistoryEntry,
  ChatMessage,
  SupportedLanguage,
  TripPlan,
} from "@/types/travel";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tripgenie.db");
const JSON_FALLBACK_PATH = path.join(DATA_DIR, "tripgenie-store.json");

interface SqliteStatementLike {
  run: (...args: unknown[]) => { changes?: number };
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
}

interface SqliteDbLike {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatementLike;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface ScopedTripRecord extends TripPlan {
  userId: string;
}

interface ScopedSessionRecord {
  id: string;
  userId: string;
  title: string;
  language: string;
  activeTripId: string | null;
  activeTripJson?: string | null;
  previousInteractionId?: string;
  updatedAt: string;
}

interface JsonStoreData {
  users: UserRecord[];
  trips: ScopedTripRecord[];
  sessions: Record<string, ScopedSessionRecord>;
  messages: Record<string, (ChatMessage & { userId?: string })[]>;
}

let dbInstance: SqliteDbLike | null = null;
let sqliteChecked = false;
let sqliteAvailable = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function scopeSessionKey(userId: string, sessionId: string): string {
  const prefix = `${userId}:`;
  return sessionId.startsWith(prefix) ? sessionId : `${prefix}${sessionId}`;
}

function getSqliteDb(): SqliteDbLike | null {
  if (dbInstance) return dbInstance;
  if (sqliteChecked && !sqliteAvailable) return null;

  sqliteChecked = true;
  try {
    ensureDataDir();
    // Load node:sqlite dynamically so hosts running older Node versions fall back to JSON persistence cleanly
    const dynamicRequire = eval("require") as (id: string) => {
      DatabaseSync?: new (p: string) => SqliteDbLike;
    };
    const sqliteMod = dynamicRequire("node:sqlite");
    if (!sqliteMod?.DatabaseSync) {
      sqliteAvailable = false;
      return null;
    }

    const db = new sqliteMod.DatabaseSync(DB_PATH);
    db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        destination TEXT NOT NULL,
        country TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        days_count INTEGER NOT NULL,
        budget_tier TEXT NOT NULL,
        total_budget REAL NOT NULL,
        currency TEXT NOT NULL,
        language TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 1,
        trip_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        language TEXT NOT NULL,
        active_trip_id TEXT,
        active_trip_json TEXT,
        previous_interaction_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT '',
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        meta_json TEXT,
        created_at TEXT NOT NULL
      );
    `);

    const migrations = [
      `ALTER TABLE trips ADD COLUMN user_id TEXT NOT NULL DEFAULT '';`,
      `ALTER TABLE chat_sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT '';`,
      `ALTER TABLE chat_sessions ADD COLUMN active_trip_json TEXT;`,
      `ALTER TABLE chat_messages ADD COLUMN user_id TEXT NOT NULL DEFAULT '';`,
    ];
    for (const sql of migrations) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists
      }
    }

    sqliteAvailable = true;
    dbInstance = db;
    return db;
  } catch {
    sqliteAvailable = false;
    return null;
  }
}

function readJsonStore(): JsonStoreData {
  ensureDataDir();
  if (!fs.existsSync(JSON_FALLBACK_PATH)) {
    const initial: JsonStoreData = {
      users: [],
      trips: [],
      sessions: {},
      messages: {},
    };
    fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  const parsed = JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, "utf8")) as Partial<JsonStoreData>;
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    trips: Array.isArray(parsed.trips) ? parsed.trips : [],
    sessions: parsed.sessions ?? {},
    messages: parsed.messages ?? {},
  };
}

function writeJsonStore(data: JsonStoreData) {
  ensureDataDir();
  fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(data, null, 2), "utf8");
}

/* ------------------------------------------------------------------ */
/* User Accounts                                                      */
/* ------------------------------------------------------------------ */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(email: string): UserRecord | null {
  const norm = normalizeEmail(email);
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().users.find((u) => u.email === norm) ?? null;
  }
  const row = db
    .prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?")
    .get(norm) as
    | { id: string; name: string; email: string; password_hash: string; created_at: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export function getUserById(id: string): AuthUser | null {
  const db = getSqliteDb();
  if (!db) {
    const found = readJsonStore().users.find((u) => u.id === id);
    if (!found) return null;
    return { id: found.id, name: found.name, email: found.email, createdAt: found.createdAt };
  }
  const row = db
    .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
    .get(id) as { id: string; name: string; email: string; created_at: string } | undefined;
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): AuthUser {
  const normEmail = normalizeEmail(input.email);
  const cleanName = input.name.trim();
  const now = new Date().toISOString();
  const id = `u-${crypto.randomUUID()}`;

  if (findUserByEmail(normEmail)) {
    throw new Error("EMAIL_EXISTS");
  }

  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    store.users.push({
      id,
      name: cleanName,
      email: normEmail,
      passwordHash: input.passwordHash,
      createdAt: now,
    });
    writeJsonStore(store);
    return { id, name: cleanName, email: normEmail, createdAt: now };
  }

  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, cleanName, normEmail, input.passwordHash, now);

  return { id, name: cleanName, email: normEmail, createdAt: now };
}

/* ------------------------------------------------------------------ */
/* Per-User Saved Trips                                               */
/* ------------------------------------------------------------------ */

export function listSavedTrips(userId: string): TripPlan[] {
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().trips
      .filter((t) => t.userId === userId)
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }
  const rows = db
    .prepare(
      "SELECT trip_json, is_favorite, updated_at FROM trips WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(userId) as { trip_json: string; is_favorite: number; updated_at: string }[];
  return rows.map((r) => {
    const parsed = JSON.parse(r.trip_json) as TripPlan;
    parsed.isFavorite = Boolean(r.is_favorite);
    parsed.updatedAt = r.updated_at;
    if (!parsed.budget?.lineItems || parsed.budget.lineItems.length === 0) {
      parsed.budget = calculateItemizedBudget(parsed, parsed.budget?.tips);
    }
    return parsed;
  });
}

export function getSavedTrip(id: string, userId: string): TripPlan | null {
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().trips.find((t) => t.id === id && t.userId === userId) ?? null;
  }
  const row = db
    .prepare("SELECT trip_json, is_favorite, updated_at FROM trips WHERE id = ? AND user_id = ?")
    .get(id, userId) as { trip_json: string; is_favorite: number; updated_at: string } | undefined;
  if (!row) return null;
  const parsed = JSON.parse(row.trip_json) as TripPlan;
  parsed.isFavorite = Boolean(row.is_favorite);
  parsed.updatedAt = row.updated_at;
  if (!parsed.budget?.lineItems || parsed.budget.lineItems.length === 0) {
    parsed.budget = calculateItemizedBudget(parsed, parsed.budget?.tips);
  }
  return parsed;
}

export function upsertTrip(trip: TripPlan, userId: string): TripPlan {
  const now = new Date().toISOString();
  let safeId = trip.id;

  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    const conflict = store.trips.find((t) => t.id === safeId && t.userId !== userId);
    if (conflict) {
      safeId = `${trip.id}-${crypto.randomUUID().slice(0, 6)}`;
    }
    const updated: ScopedTripRecord = {
      ...trip,
      id: safeId,
      userId,
      createdAt: trip.createdAt ?? now,
      updatedAt: now,
    };
    store.trips = [
      updated,
      ...store.trips.filter((t) => !(t.id === updated.id && t.userId === userId)),
    ];
    writeJsonStore(store);
    return updated;
  }

  const existingOwner = db
    .prepare("SELECT user_id FROM trips WHERE id = ?")
    .get(safeId) as { user_id?: string } | undefined;
  if (existingOwner && existingOwner.user_id !== userId) {
    safeId = `${trip.id}-${crypto.randomUUID().slice(0, 6)}`;
  }

  const updated: TripPlan = {
    ...trip,
    id: safeId,
    createdAt: trip.createdAt ?? now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO trips (id, user_id, title, destination, country, lat, lng, days_count, budget_tier, total_budget, currency, language, is_favorite, trip_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      destination = excluded.destination,
      country = excluded.country,
      lat = excluded.lat,
      lng = excluded.lng,
      days_count = excluded.days_count,
      budget_tier = excluded.budget_tier,
      total_budget = excluded.total_budget,
      currency = excluded.currency,
      language = excluded.language,
      is_favorite = excluded.is_favorite,
      trip_json = excluded.trip_json,
      updated_at = excluded.updated_at
    WHERE trips.user_id = excluded.user_id
  `).run(
    updated.id,
    userId,
    updated.title,
    updated.destination,
    updated.country,
    updated.lat,
    updated.lng,
    updated.daysCount,
    updated.budgetTier,
    updated.budget.totalUsd,
    updated.currency,
    updated.language,
    updated.isFavorite ? 1 : 0,
    JSON.stringify(updated),
    updated.createdAt!,
    updated.updatedAt!
  );
  return updated;
}

export function deleteSavedTrip(id: string, userId: string): boolean {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    const prevLen = store.trips.length;
    store.trips = store.trips.filter((t) => !(t.id === id && t.userId === userId));
    writeJsonStore(store);
    return store.trips.length < prevLen;
  }
  const res = db.prepare("DELETE FROM trips WHERE id = ? AND user_id = ?").run(id, userId);
  return Number(res.changes ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* Per-User Chat Sessions & History                                   */
/* ------------------------------------------------------------------ */

export function ensureChatSession(
  userId: string,
  sessionId: string,
  language: string,
  title = "Trip Planning Session"
) {
  const key = scopeSessionKey(userId, sessionId);
  const db = getSqliteDb();
  const now = new Date().toISOString();

  if (!db) {
    const store = readJsonStore();
    const existing = store.sessions[key];
    store.sessions[key] = {
      id: key,
      userId,
      title:
        existing?.title && existing.title !== "TripGenie AI Chat" && existing.title !== "Trip Planning Session"
          ? existing.title
          : title,
      language,
      activeTripId: existing?.activeTripId ?? null,
      activeTripJson: existing?.activeTripJson ?? null,
      previousInteractionId: existing?.previousInteractionId,
      updatedAt: now,
    };
    writeJsonStore(store);
    return;
  }

  db.prepare(`
    INSERT INTO chat_sessions (id, user_id, title, language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      language = excluded.language,
      title = CASE WHEN chat_sessions.title = 'TripGenie AI Chat' OR chat_sessions.title = 'Trip Planning Session' THEN excluded.title ELSE chat_sessions.title END
    WHERE chat_sessions.user_id = excluded.user_id
  `).run(key, userId, title, language, now, now);
}

export function updateSessionContext(
  userId: string,
  sessionId: string,
  activeTripId: string | null,
  previousInteractionId?: string,
  tripSnapshot?: TripPlan | null,
  sessionTitle?: string
) {
  const key = scopeSessionKey(userId, sessionId);
  const db = getSqliteDb();
  const now = new Date().toISOString();
  const snapshotStr = tripSnapshot ? JSON.stringify(tripSnapshot) : null;

  if (!db) {
    const store = readJsonStore();
    const existing = store.sessions[key];
    if (existing && existing.userId === userId) {
      if (sessionTitle) existing.title = sessionTitle;
      existing.activeTripId = activeTripId ?? existing.activeTripId;
      if (snapshotStr) existing.activeTripJson = snapshotStr;
      if (previousInteractionId) existing.previousInteractionId = previousInteractionId;
      existing.updatedAt = now;
      writeJsonStore(store);
    }
    return;
  }

  db.prepare(`
    UPDATE chat_sessions
    SET title = COALESCE(?, title),
        active_trip_id = COALESCE(?, active_trip_id),
        active_trip_json = COALESCE(?, active_trip_json),
        previous_interaction_id = COALESCE(?, previous_interaction_id),
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    sessionTitle ?? null,
    activeTripId,
    snapshotStr,
    previousInteractionId ?? null,
    now,
    key,
    userId
  );
}

export function listChatHistory(userId: string): ChatHistoryEntry[] {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    return Object.values(store.sessions)
      .filter((s) => s.userId === userId)
      .map((s) => {
        const msgs = (store.messages[s.id] ?? []).filter(
          (m) => !m.userId || m.userId === userId
        );
        const trip = s.activeTripJson ? (JSON.parse(s.activeTripJson) as TripPlan) : null;
        return {
          sessionId: s.id,
          title: trip?.title || s.title,
          language: (s.language as SupportedLanguage) || "en",
          messageCount: msgs.length,
          lastMessage: msgs[msgs.length - 1]?.content ?? "",
          tripSnapshot: trip,
          messages: msgs,
          updatedAt: s.updatedAt,
        };
      })
      .filter((e) => e.messageCount > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const sessions = db
    .prepare(
      "SELECT id, title, language, active_trip_json, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(userId) as {
      id: string;
      title: string;
      language: string;
      active_trip_json?: string | null;
      updated_at: string;
    }[];

  const entries: ChatHistoryEntry[] = [];
  for (const s of sessions) {
    const msgs = listChatMessages(userId, s.id);
    if (msgs.length === 0) continue;
    const trip = s.active_trip_json ? (JSON.parse(s.active_trip_json) as TripPlan) : null;
    entries.push({
      sessionId: s.id,
      title: trip?.title || s.title,
      language: (s.language as SupportedLanguage) || "en",
      messageCount: msgs.length,
      lastMessage: msgs[msgs.length - 1]?.content ?? "",
      tripSnapshot: trip,
      messages: msgs,
      updatedAt: s.updated_at,
    });
  }
  return entries;
}

export function getSessionInteractionId(userId: string, sessionId: string): string | undefined {
  const key = scopeSessionKey(userId, sessionId);
  const db = getSqliteDb();
  if (!db) {
    const s = readJsonStore().sessions[key];
    return s?.userId === userId ? s.previousInteractionId : undefined;
  }
  const row = db
    .prepare("SELECT previous_interaction_id FROM chat_sessions WHERE id = ? AND user_id = ?")
    .get(key, userId) as { previous_interaction_id?: string | null } | undefined;
  return row?.previous_interaction_id ?? undefined;
}

export function saveChatMessage(userId: string, sessionId: string, msg: ChatMessage) {
  const key = scopeSessionKey(userId, sessionId);
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    const list = store.messages[key] ?? [];
    list.push({ ...msg, userId });
    store.messages[key] = list;
    writeJsonStore(store);
    return;
  }

  db.prepare(`
    INSERT INTO chat_messages (id, user_id, session_id, role, content, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `${userId}-${msg.id}`,
    userId,
    key,
    msg.role,
    msg.content,
    JSON.stringify({
      engine: msg.engine,
      tripUpdated: msg.tripUpdated,
      suggestions: msg.suggestions,
      adjustmentSummary: msg.adjustmentSummary,
    }),
    msg.createdAt
  );
}

export function listChatMessages(userId: string, sessionId: string): ChatMessage[] {
  const key = scopeSessionKey(userId, sessionId);
  const db = getSqliteDb();
  if (!db) {
    const msgs = readJsonStore().messages[key] ?? [];
    return msgs.filter((m) => !m.userId || m.userId === userId);
  }

  const rows = db
    .prepare(
      "SELECT id, role, content, meta_json, created_at FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC"
    )
    .all(key, userId) as {
      id: string;
      role: "user" | "assistant";
      content: string;
      meta_json?: string;
      created_at: string;
    }[];
  return rows.map((r) => {
    const meta = r.meta_json ? JSON.parse(r.meta_json) : {};
    return {
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
      ...meta,
    };
  });
}

export function clearChatSession(userId: string, sessionId: string) {
  const key = scopeSessionKey(userId, sessionId);
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    if (store.sessions[key]?.userId === userId) {
      delete store.messages[key];
      delete store.sessions[key];
      writeJsonStore(store);
    }
    return;
  }

  db.prepare("DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?").run(key, userId);
  db.prepare("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?").run(key, userId);
}

export function clearAllUserChatHistory(userId: string) {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    for (const [id, s] of Object.entries(store.sessions)) {
      if (s.userId === userId) {
        delete store.sessions[id];
        delete store.messages[id];
      }
    }
    writeJsonStore(store);
    return;
  }

  db.prepare("DELETE FROM chat_messages WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM chat_sessions WHERE user_id = ?").run(userId);
}
