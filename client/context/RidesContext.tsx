// RidesContext.tsx — Rides of the logged-in user: local cache, offline queue,
// automatic sync when back online, live updates over the secured socket,
// and ride photos: saved on the phone first, uploaded when the server is reachable

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { SERVER_URL } from "../config";
import * as api from "../services/api";
import { AuthError, ClientError } from "../services/api";
import { useAuth } from "./AuthContext";
import { useOnline } from "./NetworkContext";
import type { PendingOp, Ride, RideInput, RidePage } from "../types";

// "upsert": a ride was created/updated on the server
// "replace": a ride created offline was sent and now has its server id
export type RideEvent =
  | { type: "upsert"; ride: Ride }
  | { type: "replace"; localId: number; ride: Ride };

interface RidesState {
  pending: PendingOp[];
  syncing: boolean;
  loadPage: (page: number, limit: number, q: string, mode: string) => Promise<RidePage>;
  // photo: a new photo saved on the phone (file:// uri) that should be uploaded
  saveRide: (input: RideInput, id?: number, photo?: string) => Promise<"server" | "local">;
  syncPending: () => Promise<void>;
  subscribe: (listener: (event: RideEvent) => void) => () => void;
}

const RidesContext = createContext<RidesState | null>(null);

const cacheKey = (username: string) => `@rides_cache_${username}`;
const pendingKey = (username: string) => `@pending_${username}`;

// Same search & filter the server does, used on cached rides when offline
export function matchesFilter(ride: Ride, q: string, mode: string): boolean {
  const text = q.trim().toLowerCase();
  if (mode && ride.mode !== mode) return false;
  if (!text) return true;
  return ride.title.toLowerCase().includes(text) || ride.route.toLowerCase().includes(text);
}

function toInput(ride: Ride): RideInput {
  const { id, updated_at, photo_url, local_photo, ...input } = ride;
  return input;
}

// Rides from the server don't know about the copy of the photo on this phone,
// so keep it as long as it is still the same photo the server has
function mergeLocal(incoming: Ride, existing?: Ride): Ride {
  if (incoming.local_photo !== undefined || !existing?.local_photo) return incoming;
  const samePhoto = !incoming.photo_url || incoming.photo_url === existing.photo_url;
  return samePhoto ? { ...incoming, local_photo: existing.local_photo } : incoming;
}

export function RidesProvider({ children }: { children: React.ReactNode }) {
  const { token, username, logout } = useAuth();
  const online = useOnline();

  const [pending, setPending] = useState<PendingOp[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Refs so callbacks always see the latest values
  const tokenRef = useRef(token);
  const usernameRef = useRef(username);
  const onlineRef = useRef(online);
  const pendingRef = useRef<PendingOp[]>([]);
  const syncingRef = useRef(false);
  const listeners = useRef(new Set<(event: RideEvent) => void>());
  tokenRef.current = token;
  usernameRef.current = username;
  onlineRef.current = online;

  const emit = (event: RideEvent) => listeners.current.forEach((listener) => listener(event));

  const subscribe = useCallback((listener: (event: RideEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const writePending = async (next: PendingOp[]) => {
    pendingRef.current = next;
    setPending(next);
    if (usernameRef.current) {
      await AsyncStorage.setItem(pendingKey(usernameRef.current), JSON.stringify(next));
    }
  };

  // ── Local cache of rides fetched from the server ──────────────────

  const readCache = async (): Promise<Ride[]> => {
    if (!usernameRef.current) return [];
    const raw = await AsyncStorage.getItem(cacheKey(usernameRef.current));
    return raw ? JSON.parse(raw) : [];
  };

  // Saves the rides and returns them with their local photo filled in
  const cacheRides = async (rides: Ride[]): Promise<Ride[]> => {
    if (!usernameRef.current || rides.length === 0) return rides;
    const byId = new Map((await readCache()).map((r) => [r.id, r]));
    const merged = rides.map((r) => mergeLocal(r, byId.get(r.id)));
    merged.forEach((r) => byId.set(r.id, r));
    await AsyncStorage.setItem(cacheKey(usernameRef.current), JSON.stringify([...byId.values()]));
    return merged;
  };

  const handleError = (err: unknown) => {
    if (err instanceof AuthError) logout();
  };

  // Server first; if it can't be reached, the same page from the local cache
  const loadPage = useCallback(async (page: number, limit: number, q: string, mode: string): Promise<RidePage> => {
    try {
      if (!tokenRef.current) throw new AuthError("Not logged in");
      const result = await api.getRides(tokenRef.current, page, limit, q, mode);
      const items = await cacheRides(result.items);
      return { items, hasMore: result.hasMore, fromCache: false };
    } catch (err) {
      handleError(err);
      if (err instanceof AuthError) throw err;
      const cached = (await readCache())
        .filter((r) => matchesFilter(r, q, mode))
        .sort((a, b) => b.id - a.id);
      const start = (page - 1) * limit;
      return { items: cached.slice(start, start + limit), hasMore: start + limit < cached.length, fromCache: true };
    }
  }, []);

  // ── Sending queued changes ────────────────────────────────────────

  const syncPending = useCallback(async () => {
    if (syncingRef.current || !tokenRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      while (pendingRef.current.length > 0) {
        const op = pendingRef.current[0];
        try {
          if (op.type === "photo") {
            const uploaded = await api.uploadPhoto(tokenRef.current!, op.ride.id, op.photo!);
            const [ride] = await cacheRides([{ ...uploaded, local_photo: op.photo }]);
            emit({ type: "upsert", ride });
          } else {
            const saved =
              op.type === "create"
                ? await api.createRide(tokenRef.current!, toInput(op.ride))
                : await api.updateRide(tokenRef.current!, op.ride.id, toInput(op.ride));
            const [ride] = await cacheRides([{ ...saved, local_photo: op.ride.local_photo }]);
            emit(op.type === "create" ? { type: "replace", localId: op.ride.id, ride } : { type: "upsert", ride });
            if (op.photo) {
              // The ride is on the server now; only its photo is left. If the upload
              // fails, the ride is not created a second time on the next sync.
              const photoOp: PendingOp = { type: "photo", ride, photo: op.photo, savedAt: op.savedAt };
              await writePending(pendingRef.current.map((o) => (o === op ? photoOp : o)));
              continue;
            }
          }
        } catch (err) {
          handleError(err);
          // Server unreachable: keep the change and try again later.
          // A ClientError means the server rejected it, so it is dropped.
          if (!(err instanceof ClientError)) break;
          console.warn("Server rejected a queued change, dropping it:", err);
        }
        await writePending(pendingRef.current.filter((o) => o !== op));
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  // Online: try REST first. Offline or REST failed: keep it on the phone.
  const saveRide = useCallback(async (input: RideInput, id?: number, photo?: string): Promise<"server" | "local"> => {
    const isLocalOnly = id !== undefined && id < 0;
    const queued = pendingRef.current.find((o) => o.ride.id === id);
    if (onlineRef.current && !isLocalOnly && tokenRef.current) {
      let saved: Ride | null = null;
      try {
        saved = id === undefined ? await api.createRide(tokenRef.current, input) : await api.updateRide(tokenRef.current, id, input);
        [saved] = await cacheRides([{ ...saved, local_photo: photo }]);
        // A newer version reached the server, so an older queued update is not needed
        if (pendingRef.current.some((o) => o.ride.id === saved!.id)) {
          await writePending(pendingRef.current.filter((o) => o.ride.id !== saved!.id));
        }
        // A new photo, or one an older queued change still had to upload
        const toUpload = photo ?? queued?.photo;
        if (toUpload) {
          [saved] = await cacheRides([{ ...(await api.uploadPhoto(tokenRef.current, saved.id, toUpload)), local_photo: toUpload }]);
        }
        emit({ type: "upsert", ride: saved });
        return "server";
      } catch (err) {
        handleError(err);
        if (saved) {
          // The ride itself was saved; only the photo upload failed
          emit({ type: "upsert", ride: saved });
          if (err instanceof AuthError) throw err;
          if (err instanceof ClientError) throw new Error(`The ride was saved, but the photo was rejected: ${err.message}`);
          const photoOp: PendingOp = { type: "photo", ride: saved, photo: photo ?? queued?.photo, savedAt: new Date().toISOString() };
          await writePending([...pendingRef.current, photoOp]);
          return "local";
        }
        if (err instanceof AuthError || err instanceof ClientError) throw err;
        // Network error or server down: fall through and store locally
      }
    }

    // Keep the photo the ride already had (on the server or on the phone)
    const previous = queued?.ride ?? (id === undefined ? undefined : (await readCache()).find((r) => r.id === id));
    const ride: Ride = {
      ...input,
      id: id ?? -Date.now(),
      photo_url: previous?.photo_url ?? null,
      local_photo: photo ?? previous?.local_photo ?? null,
    };
    const existing = pendingRef.current.findIndex((o) => o.ride.id === ride.id);
    const next = [...pendingRef.current];
    const savedAt = new Date().toISOString();
    if (existing >= 0) {
      const old = next[existing];
      // A queued photo upload becomes a full update, since the ride changed too
      next[existing] = { type: old.type === "photo" ? "update" : old.type, ride, photo: photo ?? old.photo, savedAt };
    } else {
      next.push({ type: id === undefined ? "create" : "update", ride, photo, savedAt });
    }
    await writePending(next);

    // A ride created offline that is edited while online can be sent right away
    if (onlineRef.current && isLocalOnly) {
      await syncPending();
      if (!pendingRef.current.some((o) => o.ride.id === ride.id)) return "server";
    }
    return "local";
  }, []);

  // Load this user's queued changes when they log in
  useEffect(() => {
    if (!username) {
      writePending([]);
      return;
    }
    (async () => {
      const raw = await AsyncStorage.getItem(pendingKey(username));
      pendingRef.current = raw ? JSON.parse(raw) : [];
      setPending(pendingRef.current);
      if (onlineRef.current) syncPending();
    })();
  }, [username]);

  // Back online: send everything that was saved locally
  useEffect(() => {
    if (online) syncPending();
  }, [online]);

  // Secured socket: the JWT goes in the handshake, the server only sends our rides
  useEffect(() => {
    if (!token) return;
    const socket = io(SERVER_URL, { transports: ["websocket"], auth: { token } });

    // Reconnecting also means the server is reachable again
    socket.on("connect", () => syncPending());
    socket.on("connect_error", (err) => {
      if (err.message === "Not authenticated") logout();
    });

    const onRide = async (ride: Ride) => {
      const [merged] = await cacheRides([ride]);
      emit({ type: "upsert", ride: merged });
    };
    socket.on("RIDE_CREATED", onRide);
    socket.on("RIDE_UPDATED", onRide);

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <RidesContext.Provider value={{ pending, syncing, loadPage, saveRide, syncPending, subscribe }}>
      {children}
    </RidesContext.Provider>
  );
}

export function useRides(): RidesState {
  const context = useContext(RidesContext);
  if (!context) throw new Error("useRides must be used inside RidesProvider");
  return context;
}
