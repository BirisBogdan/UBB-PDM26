// types.ts — Shared data types

export type RideMode = "mtb" | "road" | "commuter";
export type RideStatus = "waiting" | "in_progress" | "completed";

export interface Ride {
  id: number; // negative ids are rides created offline, not yet on the server
  title: string;
  mode: RideMode;
  route: string;
  distance_km: number;
  riders: number;
  start_time: string;
  status: RideStatus;
  photo_url?: string | null; // photo on the server, e.g. "/uploads/ride-12-….jpg"
  local_photo?: string | null; // copy of the photo saved on this phone (file:// uri)
  latitude?: number | null; // meeting point, picked on the map
  longitude?: number | null;
  updated_at?: string;
}

// What the edit screen sends; the photo is uploaded separately
export type RideInput = Omit<Ride, "id" | "updated_at" | "photo_url" | "local_photo">;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RidePage {
  items: Ride[];
  hasMore: boolean;
  fromCache: boolean; // true when the server could not be reached
}

// A change saved on the phone that still has to be sent to the server.
// "photo": the ride is already on the server, only its new photo is left to upload.
export interface PendingOp {
  type: "create" | "update" | "photo";
  ride: Ride;
  photo?: string; // local photo to upload after the ride is saved
  savedAt: string;
}
