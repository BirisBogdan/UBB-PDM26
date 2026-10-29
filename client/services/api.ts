// api.ts — REST calls to the backend, always with the JWT

import { File, UploadType } from "expo-file-system";
import { SERVER_URL } from "../config";
import type { Ride, RideInput } from "../types";

const REQUEST_TIMEOUT_MS = 5000;

// The token is missing, expired or invalid: the user must log in again
export class AuthError extends Error {}

// The server answered with an error that retrying will not fix (e.g. bad input)
export class ClientError extends Error {}

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) throw new AuthError(body.error ?? "Not authenticated");
    if (response.status >= 400 && response.status < 500) throw new ClientError(body.error ?? `Status ${response.status}`);
    if (!response.ok) throw new Error(body.error ?? `Status ${response.status}`);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function login(username: string, password: string) {
  return request<{ token: string; username: string }>("/api/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getRides(token: string, page: number, limit: number, q: string, mode: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set("q", q);
  if (mode) params.set("mode", mode);
  return request<{ items: Ride[]; hasMore: boolean }>(`/api/rides?${params}`, token);
}

export function createRide(token: string, ride: RideInput) {
  return request<Ride>("/api/rides", token, { method: "POST", body: JSON.stringify(ride) });
}

export function updateRide(token: string, id: number, ride: RideInput) {
  return request<Ride>(`/api/rides/${id}`, token, { method: "PUT", body: JSON.stringify(ride) });
}

// Sends the photo saved on the phone as the request body (expo-file-system upload).
// Rejects with a plain Error when the server can't be reached, so it stays queued.
export async function uploadPhoto(token: string, id: number, localUri: string) {
  const file = new File(localUri);
  if (!file.exists) throw new ClientError("The photo is no longer on the phone");
  const result = await file.upload(`${SERVER_URL}/api/rides/${id}/photo`, {
    httpMethod: "POST",
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: "image/jpeg",
    headers: { "Content-Type": "image/jpeg", Authorization: `Bearer ${token}` },
  });
  let body: any = {};
  try {
    body = JSON.parse(result.body);
  } catch {}
  if (result.status === 401) throw new AuthError(body.error ?? "Not authenticated");
  if (result.status >= 400 && result.status < 500) throw new ClientError(body.error ?? `Status ${result.status}`);
  if (result.status >= 300) throw new Error(body.error ?? `Status ${result.status}`);
  return body as Ride;
}
