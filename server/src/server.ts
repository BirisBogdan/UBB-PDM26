// server.ts — Express REST API + Socket.io WebSocket server
// Every ride belongs to a user. REST routes and socket connections require a JWT.

import express, { NextFunction, Request, Response } from "express";
import http from "http";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { Pool } from "pg";

type RideMode = "mtb" | "road" | "commuter";
type RideStatus = "waiting" | "in_progress" | "completed";

interface Ride {
  id: number;
  title: string;
  mode: RideMode;
  route: string;
  distance_km: number;
  riders: number;
  start_time: string;
  status: RideStatus;
  photo_url: string | null; // e.g. "/uploads/ride-12-1730000000000.jpg"
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}

interface AuthUser {
  userId: number;
  username: string;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

const MODES: RideMode[] = ["mtb", "road", "commuter"];
const STATUSES: RideStatus[] = ["waiting", "in_progress", "completed"];

const JWT_SECRET = process.env.JWT_SECRET || "ridecluj-dev-secret";
const JWT_EXPIRES_IN = "7d";

// ── Persistence (PostgreSQL) ────────────────────────────────────────

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "PDM",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password",
});

// Passwords are stored as "salt:hash" using scrypt
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

// Demo accounts, created on first start
const SEED_USERS = [
  { username: "bogdan", password: "bogdan123" },
  { username: "ana", password: "ana123" },
];

// lat/lng is the meeting point of the ride
const SEED_ROUTES: { title: string; mode: RideMode; route: string; distance_km: number; lat: number; lng: number }[] = [
  { title: "Faget MTB Loop", mode: "mtb", route: "Faget Forest → Cheile Baciului → Faget", distance_km: 28.5, lat: 46.7334, lng: 23.5653 },
  { title: "Turda Gorge Road Ride", mode: "road", route: "Cluj-Napoca → Turda Gorge → Cluj-Napoca", distance_km: 72, lat: 46.7600, lng: 23.5800 },
  { title: "City Center Commute", mode: "commuter", route: "Manastur → Piata Unirii", distance_km: 5.2, lat: 46.7558, lng: 23.5506 },
  { title: "Hoia Baciu Night Ride", mode: "mtb", route: "Hoia Forest Loop", distance_km: 15, lat: 46.7745, lng: 23.5300 },
  { title: "Somesul Mic Riverside Sprint", mode: "road", route: "Grigorescu → Floresti → Gilau", distance_km: 34, lat: 46.7712, lng: 23.5560 },
  { title: "Campus Commute", mode: "commuter", route: "Marasti → UBB Campus", distance_km: 4.1, lat: 46.7801, lng: 23.6150 },
  { title: "Belis Lake Tour", mode: "road", route: "Cluj-Napoca → Gilau → Belis", distance_km: 96, lat: 46.7700, lng: 23.5650 },
  { title: "Feleac Hill Climb", mode: "road", route: "Calea Turzii → Feleac", distance_km: 18.4, lat: 46.7466, lng: 23.5937 },
];

// Ride photos are saved here and served at /uploads/<file>
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MAX_PHOTO_SIZE = "15mb";

async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rides (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      route TEXT NOT NULL,
      distance_km REAL NOT NULL,
      riders INTEGER NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Iteration 3: photo and location, added to databases created by earlier iterations
  await pool.query(`
    ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
  `);

  for (const seed of SEED_USERS) {
    const existing = await pool.query<{ id: number }>("SELECT id FROM users WHERE username = $1", [
      seed.username,
    ]);
    if (existing.rowCount) continue;

    const created = await pool.query<{ id: number }>(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [seed.username, hashPassword(seed.password)]
    );
    const userId = created.rows[0].id;

    // 24 rides per user, so the list needs several pages
    for (let i = 0; i < 24; i++) {
      const base = SEED_ROUTES[i % SEED_ROUTES.length];
      const day = String((i % 28) + 1).padStart(2, "0");
      await pool.query(
        `INSERT INTO rides (user_id, title, mode, route, distance_km, riders, start_time, status, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          `${base.title} #${i + 1} (${seed.username})`,
          base.mode,
          base.route,
          base.distance_km,
          2 + (i % 9),
          `2026-11-${day}T0${7 + (i % 3)}:00:00Z`,
          STATUSES[i % STATUSES.length],
          base.lat,
          base.lng,
        ]
      );
    }
    console.log(`[DB] Seeded user "${seed.username}" with 24 rides`);
  }

  // Seeded rides from earlier iterations get their meeting point too
  for (const base of SEED_ROUTES) {
    await pool.query(
      "UPDATE rides SET latitude = $1, longitude = $2 WHERE latitude IS NULL AND title LIKE $3",
      [base.lat, base.lng, `${base.title} #%`]
    );
  }
}

const RIDE_COLUMNS =
  "id, title, mode, route, distance_km, riders, start_time, status, photo_url, latitude, longitude, updated_at";

function toRide(row: any): Ride {
  return {
    ...row,
    distance_km: Number(row.distance_km),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    start_time: new Date(row.start_time).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// Returns an error message, or null when the body is a valid ride
function validateRide(body: any): string | null {
  if (!body || typeof body.title !== "string" || !body.title.trim()) return "title is required";
  if (!MODES.includes(body.mode)) return "mode must be mtb, road or commuter";
  if (typeof body.route !== "string" || !body.route.trim()) return "route is required";
  if (!(Number(body.distance_km) > 0)) return "distance_km must be a positive number";
  if (!Number.isInteger(Number(body.riders)) || Number(body.riders) < 0) return "riders must be a whole number";
  if (isNaN(Date.parse(body.start_time))) return "start_time must be a date";
  if (!STATUSES.includes(body.status)) return "status must be waiting, in_progress or completed";
  // Location is optional, but latitude and longitude come together
  const hasLat = body.latitude !== undefined && body.latitude !== null;
  const hasLng = body.longitude !== undefined && body.longitude !== null;
  if (hasLat !== hasLng) return "latitude and longitude must be sent together";
  if (hasLat && !(Math.abs(Number(body.latitude)) <= 90)) return "latitude must be between -90 and 90";
  if (hasLng && !(Math.abs(Number(body.longitude)) <= 180)) return "longitude must be between -180 and 180";
  return null;
}

// null when the ride has no location
function coordinate(value: unknown): number | null {
  return value === undefined || value === null ? null : Number(value);
}

// ── Server setup ────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use(cors());
app.use(express.json());
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  },
});

// Each user's sockets join their own room, so notifications reach only them
const userRoom = (userId: number) => `user:${userId}`;

// ── Auth ────────────────────────────────────────────────────────────

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  try {
    const result = await pool.query<{ id: number; username: string; password_hash: string }>(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [username.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    console.log(`[AUTH] ${user.username} logged in`);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("[DB] Login failed:", err);
    res.status(500).json({ error: "Database error" });
  }
});

function verifyToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

// Protects REST routes: requires "Authorization: Bearer <token>"
function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.user = user;
  next();
}

// ── REST endpoints ──────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /api/rides?page=1&limit=10&q=faget&mode=mtb
// Only the authenticated user's rides, newest first, one page at a time
app.get("/api/rides", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const mode = typeof req.query.mode === "string" ? req.query.mode : "";

  const conditions = ["user_id = $1"];
  const params: unknown[] = [userId];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(title ILIKE $${params.length} OR route ILIKE $${params.length})`);
  }
  if (MODES.includes(mode as RideMode)) {
    params.push(mode);
    conditions.push(`mode = $${params.length}`);
  }
  const where = conditions.join(" AND ");

  try {
    const total = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM rides WHERE ${where}`, params);
    const rows = await pool.query(
      `SELECT ${RIDE_COLUMNS} FROM rides WHERE ${where}
       ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );
    const totalCount = Number(total.rows[0].count);
    console.log(`[REST] GET /api/rides user=${req.user!.username} page=${page} q="${q}" mode="${mode}"`);
    res.json({
      items: rows.rows.map(toRide),
      page,
      limit,
      total: totalCount,
      hasMore: page * limit < totalCount,
    });
  } catch (err) {
    console.error("[DB] Failed to read rides:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/rides/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT ${RIDE_COLUMNS} FROM rides WHERE id = $1 AND user_id = $2`, [
      Number(req.params.id),
      req.user!.userId,
    ]);
    if (!result.rowCount) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }
    res.json(toRide(result.rows[0]));
  } catch (err) {
    console.error("[DB] Failed to read ride:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/rides", requireAuth, async (req: AuthRequest, res: Response) => {
  const error = validateRide(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  const b = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO rides (user_id, title, mode, route, distance_km, riders, start_time, status, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${RIDE_COLUMNS}`,
      [req.user!.userId, b.title.trim(), b.mode, b.route.trim(), Number(b.distance_km), Number(b.riders), b.start_time, b.status,
        coordinate(b.latitude), coordinate(b.longitude)]
    );
    const ride = toRide(result.rows[0]);
    console.log(`[REST] POST /api/rides user=${req.user!.username} → ride ${ride.id}`);
    io.to(userRoom(req.user!.userId)).emit("RIDE_CREATED", ride);
    res.status(201).json(ride);
  } catch (err) {
    console.error("[DB] Failed to create ride:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/rides/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const error = validateRide(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  const b = req.body;
  try {
    const result = await pool.query(
      `UPDATE rides SET title = $1, mode = $2, route = $3, distance_km = $4, riders = $5,
         start_time = $6, status = $7, latitude = $8, longitude = $9, updated_at = NOW()
       WHERE id = $10 AND user_id = $11 RETURNING ${RIDE_COLUMNS}`,
      [b.title.trim(), b.mode, b.route.trim(), Number(b.distance_km), Number(b.riders), b.start_time, b.status,
        coordinate(b.latitude), coordinate(b.longitude), Number(req.params.id), req.user!.userId]
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "Ride not found" });
      return;
    }
    const ride = toRide(result.rows[0]);
    console.log(`[REST] PUT /api/rides/${ride.id} user=${req.user!.username}`);
    io.to(userRoom(req.user!.userId)).emit("RIDE_UPDATED", ride);
    res.json(ride);
  } catch (err) {
    console.error("[DB] Failed to update ride:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/rides/:id/photo — the body is the image itself (Content-Type: image/jpeg).
// The phone sends it with expo-file-system's File.upload after the ride is saved.
app.post(
  "/api/rides/:id/photo",
  requireAuth,
  express.raw({ type: "image/*", limit: MAX_PHOTO_SIZE }),
  async (req: AuthRequest, res: Response) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "The body must be an image (Content-Type: image/jpeg or image/png)" });
      return;
    }
    const id = Number(req.params.id);
    try {
      const existing = await pool.query<{ photo_url: string | null }>(
        "SELECT photo_url FROM rides WHERE id = $1 AND user_id = $2",
        [id, req.user!.userId]
      );
      if (!existing.rowCount) {
        res.status(404).json({ error: "Ride not found" });
        return;
      }

      const extension = req.headers["content-type"] === "image/png" ? "png" : "jpg";
      const fileName = `ride-${id}-${Date.now()}.${extension}`;
      await fs.promises.writeFile(path.join(UPLOADS_DIR, fileName), req.body);

      const result = await pool.query(
        `UPDATE rides SET photo_url = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING ${RIDE_COLUMNS}`,
        [`/uploads/${fileName}`, id, req.user!.userId]
      );

      // The previous photo of this ride is not needed anymore
      const oldPhoto = existing.rows[0].photo_url;
      if (oldPhoto) fs.promises.unlink(path.join(UPLOADS_DIR, path.basename(oldPhoto))).catch(() => {});

      const ride = toRide(result.rows[0]);
      console.log(`[REST] POST /api/rides/${id}/photo user=${req.user!.username} (${req.body.length} bytes)`);
      io.to(userRoom(req.user!.userId)).emit("RIDE_UPDATED", ride);
      res.json(ride);
    } catch (err) {
      console.error("[DB] Failed to save photo:", err);
      res.status(500).json({ error: "Could not save the photo" });
    }
  }
);

// ── Secured WebSocket ───────────────────────────────────────────────
// The client passes its JWT in the handshake: io(url, { auth: { token } })

io.use((socket, next) => {
  const user = verifyToken(socket.handshake.auth?.token);
  if (!user) {
    next(new Error("Not authenticated"));
    return;
  }
  socket.data.user = user;
  next();
});

io.on("connection", (socket) => {
  const user = socket.data.user as AuthUser;
  socket.join(userRoom(user.userId));
  console.log(`[WS] ${user.username} connected (${socket.id})`);

  socket.on("disconnect", () => {
    console.log(`[WS] ${user.username} disconnected (${socket.id})`);
  });
});

// Start server
initDatabase()
  .then(() => {
    console.log("[DB] Connected to PostgreSQL");
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`\nServer running on http://0.0.0.0:${PORT}`);
      console.log(`  Login:     POST http://localhost:${PORT}/api/auth/login`);
      console.log(`  REST API:  http://localhost:${PORT}/api/rides (needs Bearer token)`);
      console.log(`  WebSocket: ws://localhost:${PORT} (needs token in handshake)\n`);
    });
  })
  .catch((err) => {
    console.error("[DB] Could not connect to PostgreSQL:", err);
    process.exit(1);
  });
