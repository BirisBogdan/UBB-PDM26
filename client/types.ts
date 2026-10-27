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
  updated_at?: string;
}

export type RideInput = Omit<Ride, "id" | "updated_at">;

export interface RidePage {
  items: Ride[];
  hasMore: boolean;
  fromCache: boolean; // true when the server could not be reached
}

// A change saved on the phone that still has to be sent to the server
export interface PendingOp {
  type: "create" | "update";
  ride: Ride;
  savedAt: string;
}
