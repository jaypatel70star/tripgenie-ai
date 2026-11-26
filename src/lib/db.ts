import fs from "node:fs";
import path from "node:path";
import { calculateItemizedBudget } from "@/lib/budget-calculator";
import type { ChatHistoryEntry, ChatMessage, SupportedLanguage, TripPlan } from "@/types/travel";

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

interface JsonStoreData {
  trips: TripPlan[];
  sessions: Record<
    string,
    {
      id: string;
      title: string;
      language: string;
      activeTripId: string | null;
      activeTripJson?: string | null;
      previousInteractionId?: string;
      updatedAt: string;
    }
  >;
  messages: Record<string, ChatMessage[]>;
}

let dbInstance: SqliteDbLike | null = null;
let sqliteChecked = false;
let sqliteAvailable = false;

function buildSeedTrips(): TripPlan[] {
  const now = new Date().toISOString();

  const sampleTokyo: TripPlan = {
    id: "trip-sample-tokyo",
    title: "Tokyo Neon & Heritage (4 Days)",
    destination: "Tokyo",
    country: "Japan",
    originCity: "Mumbai",
    originLat: 19.076,
    originLng: 72.8777,
    lat: 35.6762,
    lng: 139.6503,
    daysCount: 4,
    travelers: 2,
    budgetTier: "moderate",
    currency: "INR",
    language: "en",
    interests: ["food", "culture", "tech"],
    overview:
      "A balanced 4-day Tokyo exploration blending ancient Asakusa temples, Tsukiji street eats, Shibuya sky views, and Shinjuku lantern alleys.",
    bestSeason: "March – May, Oct – Nov",
    isFavorite: true,
    createdAt: now,
    updatedAt: now,
    days: [
      {
        dayNumber: 1,
        theme: "Old Edo & Neon Skylines",
        summary: "Begin at historic Asakusa before ascending to futuristic digital art and bay views.",
        activities: [
          {
            id: "tok-1-1",
            timeSlot: "Morning",
            time: "09:00 AM",
            title: "Senso-ji Temple & Nakamise Street",
            description: "Walk through Tokyo's oldest Buddhist temple at dawn and sample warm ningyo-yaki.",
            category: "culture",
            locationName: "Asakusa",
            lat: 35.7148,
            lng: 139.7967,
            estimatedCostUsd: 12,
            durationHours: 2.5,
            indoorAlternative: "Sumida Hokusai Museum",
          },
          {
            id: "tok-1-2",
            timeSlot: "Afternoon",
            time: "01:30 PM",
            title: "teamLab Planets Digital Art",
            description: "Interactive light, mirror, and water art rooms in Toyosu.",
            category: "sightseeing",
            locationName: "Toyosu",
            lat: 35.6491,
            lng: 139.7898,
            estimatedCostUsd: 32,
            durationHours: 2.5,
            indoorAlternative: "Mori Art Museum",
          },
          {
            id: "tok-1-3",
            timeSlot: "Evening",
            time: "06:30 PM",
            title: "Omoide Yokocho Lantern Alley Dinner",
            description: "Savor smoky yakitori skewers and ramen in cozy Shinjuku alleys.",
            category: "food",
            locationName: "Shinjuku",
            lat: 35.693,
            lng: 139.6996,
            estimatedCostUsd: 30,
            durationHours: 2,
            indoorAlternative: "Kabukicho Tower Dining Hall",
          },
        ],
      },
      {
        dayNumber: 2,
        theme: "Shibuya Energy & Cedar Shrines",
        summary: "Forest tranquility at Meiji Jingu followed by Harajuku street culture and Shibuya Sky.",
        activities: [
          {
            id: "tok-2-1",
            timeSlot: "Morning",
            time: "09:30 AM",
            title: "Meiji Jingu Forest Shrine & Harajuku",
            description: "Stroll beneath towering cedar trees and explore quirky fashion lanes.",
            category: "culture",
            locationName: "Shibuya-ku",
            lat: 35.6764,
            lng: 139.6993,
            estimatedCostUsd: 15,
            durationHours: 3,
            indoorAlternative: "Nezu Museum & Omotesando Hills",
          },
          {
            id: "tok-2-2",
            timeSlot: "Afternoon",
            time: "02:00 PM",
            title: "Tsukiji Outer Market Food Crawl",
            description: "Sample seared wagyu, tamagoyaki, and artisanal matcha.",
            category: "food",
            locationName: "Tsukiji",
            lat: 35.6655,
            lng: 139.7707,
            estimatedCostUsd: 28,
            durationHours: 2,
            indoorAlternative: "Ginza Six Depachika Food Hall",
          },
          {
            id: "tok-2-3",
            timeSlot: "Evening",
            time: "05:30 PM",
            title: "Shibuya Sky Sunset Observatory",
            description: "Watch the city ignite from 229m above Shibuya Scramble Crossing.",
            category: "sightseeing",
            locationName: "Shibuya",
            lat: 35.6585,
            lng: 139.7016,
            estimatedCostUsd: 22,
            durationHours: 2,
            indoorAlternative: "Shibuya Scramble indoor gallery",
          },
        ],
      },
    ],
    budget: {
      totalUsd: 1320,
      perDayUsd: 330,
      accommodationUsd: 592,
      foodUsd: 310,
      transportUsd: 145,
      activitiesUsd: 173,
      bufferUsd: 100,
      tips: [
        "Use a 72-hour Tokyo Subway Ticket (₹930) to save up to 40% on metro hops.",
        "Book teamLab Planets and Shibuya Sky sunset slots 2 weeks early.",
      ],
    },
    hotels: [
      {
        id: "h-tok-1",
        name: "Hotel Gracery Shinjuku",
        tier: "moderate",
        neighborhood: "Shinjuku",
        pricePerNightUsd: 148,
        rating: 4.7,
        highlights: ["Iconic Godzilla terrace", "Direct station access", "City skyline views"],
        lat: 35.6956,
        lng: 139.702,
      },
    ],
    restaurants: [
      {
        id: "r-tok-1",
        name: "Gyukatsu Motomura",
        cuisine: "Japanese Wagyu Cutlet",
        priceLevel: "$$",
        mustTryDish: "Stone-seared Wagyu Gyukatsu Set",
        neighborhood: "Shinjuku",
        rating: 4.8,
        lat: 35.6915,
        lng: 139.7035,
      },
    ],
    transport: [
      {
        id: "t-tok-1",
        mode: "Metro & Transit Pass",
        title: "Suica IC Card + 72h Subway Pass",
        duration: "Unlimited 3 days",
        estimatedCostUsd: 11,
        notes: "Covers all Tokyo Metro & Toei lines seamlessly.",
      },
    ],
  };

  const sampleManali: TripPlan = {
    id: "trip-sample-manali",
    title: "Manali & Solang Himalayan Escape (3 Days)",
    destination: "Manali",
    country: "India",
    originCity: "New Delhi",
    originLat: 28.6139,
    originLng: 77.209,
    lat: 32.2432,
    lng: 77.1892,
    daysCount: 3,
    travelers: 2,
    budgetTier: "budget",
    currency: "INR",
    language: "en",
    interests: ["mountains", "adventure", "food"],
    overview:
      "Crisp pine forests, Solang Valley snow adventures, Atal Tunnel mountain vistas, and riverside Old Manali cafes on a student-friendly budget.",
    bestSeason: "March – June, Dec – Feb",
    isFavorite: true,
    createdAt: now,
    updatedAt: now,
    days: [
      {
        dayNumber: 1,
        theme: "Cedar Forests & Riverside Cafes",
        summary: "Ease into Himalayan altitude with wooden temples and Old Manali bakery trails.",
        activities: [
          {
            id: "man-1-1",
            timeSlot: "Morning",
            time: "10:00 AM",
            title: "Hadimba Devi Cedar Forest Temple",
            description: "16th-century pagoda-style wooden temple nestled among ancient deodar trees.",
            category: "culture",
            locationName: "Dhungri Forest",
            lat: 32.2485,
            lng: 77.1807,
            estimatedCostUsd: 5,
            durationHours: 1.5,
            indoorAlternative: "Museum of Himachal Culture",
          },
          {
            id: "man-1-2",
            timeSlot: "Afternoon",
            time: "01:30 PM",
            title: "Old Manali Café & Riverside Trail",
            description: "Relax beside the rushing Manalsu river with fresh trout and artisanal coffee.",
            category: "food",
            locationName: "Old Manali",
            lat: 32.2564,
            lng: 77.1839,
            estimatedCostUsd: 14,
            durationHours: 2.5,
            indoorAlternative: "Johnson's Lodge Lounge",
          },
        ],
      },
      {
        dayNumber: 2,
        theme: "High-Altitude Snow & Atal Tunnel",
        summary: "Venture to Solang Valley's gondola peaks and across Atal Tunnel into Lahaul.",
        activities: [
          {
            id: "man-2-1",
            timeSlot: "Morning",
            time: "08:30 AM",
            title: "Solang Valley Gondola & Snow Adventure",
            description: "Soar above snowy alpine slopes with panoramic glacier views.",
            category: "adventure",
            locationName: "Solang Valley",
            lat: 32.3168,
            lng: 77.1574,
            estimatedCostUsd: 24,
            durationHours: 3.5,
            indoorAlternative: "Vashisht Natural Hot Springs",
          },
          {
            id: "man-2-2",
            timeSlot: "Afternoon",
            time: "02:00 PM",
            title: "Atal Tunnel & Sissu Waterfall Drive",
            description: "Marvel at stark Lahaul peaks and frozen-edge waterfalls.",
            category: "sightseeing",
            locationName: "Sissu",
            lat: 32.4781,
            lng: 77.1319,
            estimatedCostUsd: 28,
            durationHours: 3.5,
            indoorAlternative: "Himalayan Nyinmapa Monastery",
          },
        ],
      },
    ],
    budget: {
      totalUsd: 330,
      perDayUsd: 110,
      accommodationUsd: 120,
      foodUsd: 78,
      transportUsd: 62,
      activitiesUsd: 45,
      bufferUsd: 25,
      tips: [
        "Overnight Volvo coaches from Delhi save both daylight hours and a hotel night.",
        "Rent warm jackets locally near Solang if traveling light.",
      ],
    },
    hotels: [
      {
        id: "h-man-1",
        name: "Zostel Old Manali",
        tier: "budget",
        neighborhood: "Old Manali",
        pricePerNightUsd: 20,
        rating: 4.6,
        highlights: ["Apple orchard lawn", "Bonfire evenings", "Mountain views"],
        lat: 32.2572,
        lng: 77.1825,
      },
    ],
    restaurants: [
      {
        id: "r-man-1",
        name: "Cafe 1947",
        cuisine: "Italian & Riverside Cafe",
        priceLevel: "$",
        mustTryDish: "Wood-fired Pizza & Hot Chocolate",
        neighborhood: "Old Manali",
        rating: 4.6,
        lat: 32.2543,
        lng: 77.1856,
      },
    ],
    transport: [
      {
        id: "t-man-1",
        mode: "Cab / Ride-share",
        title: "Overnight Volvo Coach + Local Cab",
        duration: "11h overnight",
        estimatedCostUsd: 24,
        notes: "Comfortable semi-sleeper coaches from Delhi ISBT/Majnu Ka Tilla.",
      },
    ],
  };

  return [sampleTokyo, sampleManali].map((trip) => ({
    ...trip,
    budget: calculateItemizedBudget(trip, trip.budget.tips),
  }));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
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
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
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
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        meta_json TEXT,
        created_at TEXT NOT NULL
      );
    `);

    try {
      db.exec(`ALTER TABLE chat_sessions ADD COLUMN active_trip_json TEXT;`);
    } catch {
      // Column already exists
    }

    seedInitialSqliteTrips(db);
    sqliteAvailable = true;
    dbInstance = db;
    return db;
  } catch {
    sqliteAvailable = false;
    return null;
  }
}

function seedInitialSqliteTrips(db: SqliteDbLike) {
  db.exec(`
    UPDATE trips
    SET currency = 'INR',
        trip_json = replace(replace(trip_json, '"currency":"USD"', '"currency":"INR"'), '($11)', '(₹930)')
    WHERE id IN ('trip-sample-tokyo', 'trip-sample-manali') AND currency = 'USD';
  `);
  const row = db.prepare("SELECT COUNT(*) as cnt FROM trips").get() as { cnt: number } | undefined;
  if (row && row.cnt > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO trips (id, title, destination, country, lat, lng, days_count, budget_tier, total_budget, currency, language, is_favorite, trip_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const trip of buildSeedTrips()) {
    insert.run(
      trip.id,
      trip.title,
      trip.destination,
      trip.country,
      trip.lat,
      trip.lng,
      trip.daysCount,
      trip.budgetTier,
      trip.budget.totalUsd,
      trip.currency,
      trip.language,
      1,
      JSON.stringify(trip),
      now,
      now
    );
  }
}

function readJsonStore(): JsonStoreData {
  ensureDataDir();
  if (!fs.existsSync(JSON_FALLBACK_PATH)) {
    const initial: JsonStoreData = {
      trips: buildSeedTrips(),
      sessions: {},
      messages: {},
    };
    fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  return JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, "utf8")) as JsonStoreData;
}

function writeJsonStore(data: JsonStoreData) {
  ensureDataDir();
  fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function listSavedTrips(): TripPlan[] {
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().trips;
  }
  const rows = db
    .prepare("SELECT trip_json, is_favorite, updated_at FROM trips ORDER BY updated_at DESC")
    .all() as { trip_json: string; is_favorite: number; updated_at: string }[];
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

export function getSavedTrip(id: string): TripPlan | null {
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().trips.find((t) => t.id === id) ?? null;
  }
  const row = db
    .prepare("SELECT trip_json, is_favorite, updated_at FROM trips WHERE id = ?")
    .get(id) as { trip_json: string; is_favorite: number; updated_at: string } | undefined;
  if (!row) return null;
  const parsed = JSON.parse(row.trip_json) as TripPlan;
  parsed.isFavorite = Boolean(row.is_favorite);
  parsed.updatedAt = row.updated_at;
  if (!parsed.budget?.lineItems || parsed.budget.lineItems.length === 0) {
    parsed.budget = calculateItemizedBudget(parsed, parsed.budget?.tips);
  }
  return parsed;
}

export function upsertTrip(trip: TripPlan): TripPlan {
  const now = new Date().toISOString();
  const updated: TripPlan = {
    ...trip,
    createdAt: trip.createdAt ?? now,
    updatedAt: now,
  };

  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    store.trips = [updated, ...store.trips.filter((t) => t.id !== updated.id)];
    writeJsonStore(store);
    return updated;
  }

  db.prepare(`
    INSERT INTO trips (id, title, destination, country, lat, lng, days_count, budget_tier, total_budget, currency, language, is_favorite, trip_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  `).run(
    updated.id,
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

export function deleteSavedTrip(id: string): boolean {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    const prevLen = store.trips.length;
    store.trips = store.trips.filter((t) => t.id !== id);
    writeJsonStore(store);
    return store.trips.length < prevLen;
  }
  const res = db.prepare("DELETE FROM trips WHERE id = ?").run(id);
  return Number(res.changes ?? 0) > 0;
}

export function ensureChatSession(sessionId: string, language: string, title = "Trip Planning Session") {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  if (!db) {
    const store = readJsonStore();
    const existing = store.sessions[sessionId];
    store.sessions[sessionId] = {
      id: sessionId,
      title: existing?.title && existing.title !== "TripGenie AI Chat" ? existing.title : title,
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
    INSERT INTO chat_sessions (id, title, language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      language = excluded.language,
      title = CASE WHEN chat_sessions.title = 'TripGenie AI Chat' OR chat_sessions.title = 'Trip Planning Session' THEN excluded.title ELSE chat_sessions.title END
  `).run(sessionId, title, language, now, now);
}

export function updateSessionContext(
  sessionId: string,
  activeTripId: string | null,
  previousInteractionId?: string,
  tripSnapshot?: TripPlan | null,
  sessionTitle?: string
) {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  const snapshotStr = tripSnapshot ? JSON.stringify(tripSnapshot) : null;
  if (!db) {
    const store = readJsonStore();
    const existing = store.sessions[sessionId];
    if (existing) {
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
    WHERE id = ?
  `).run(sessionTitle ?? null, activeTripId, snapshotStr, previousInteractionId ?? null, now, sessionId);
}

export function listChatHistory(): ChatHistoryEntry[] {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    return Object.values(store.sessions)
      .map((s) => {
        const msgs = store.messages[s.id] ?? [];
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
      "SELECT id, title, language, active_trip_json, updated_at FROM chat_sessions ORDER BY updated_at DESC"
    )
    .all() as {
      id: string;
      title: string;
      language: string;
      active_trip_json?: string | null;
      updated_at: string;
    }[];

  const entries: ChatHistoryEntry[] = [];
  for (const s of sessions) {
    const msgs = listChatMessages(s.id);
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

export function getSessionInteractionId(sessionId: string): string | undefined {
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().sessions[sessionId]?.previousInteractionId;
  }
  const row = db
    .prepare("SELECT previous_interaction_id FROM chat_sessions WHERE id = ?")
    .get(sessionId) as { previous_interaction_id?: string | null } | undefined;
  return row?.previous_interaction_id ?? undefined;
}

export function saveChatMessage(sessionId: string, msg: ChatMessage) {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    const list = store.messages[sessionId] ?? [];
    list.push(msg);
    store.messages[sessionId] = list;
    writeJsonStore(store);
    return;
  }

  db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, content, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    msg.id,
    sessionId,
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

export function listChatMessages(sessionId: string): ChatMessage[] {
  const db = getSqliteDb();
  if (!db) {
    return readJsonStore().messages[sessionId] ?? [];
  }

  const rows = db
    .prepare("SELECT id, role, content, meta_json, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as { id: string; role: "user" | "assistant"; content: string; meta_json?: string; created_at: string }[];
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

export function clearChatSession(sessionId: string) {
  const db = getSqliteDb();
  if (!db) {
    const store = readJsonStore();
    delete store.messages[sessionId];
    delete store.sessions[sessionId];
    writeJsonStore(store);
    return;
  }

  db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(sessionId);
}
