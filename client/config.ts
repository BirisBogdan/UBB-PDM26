// config.ts — Backend server address, shared by all screens

import Constants from "expo-constants";
import { Platform } from "react-native";

const SERVER_PORT = 8080;

// Used when Expo can't tell us the computer's address (e.g. a production build)
const FALLBACK_HOST = "172.30.251.90";

// Expo serves the app from your computer, so the host in its URL
// (e.g. "172.30.251.90:8081") is the computer's network IP. The backend
// runs on that same computer, so every device (emulator or phone) can use it.
// In a browser, the page itself is served by that computer.
const host =
  Platform.OS === "web"
    ? (globalThis as any).location.hostname
    : Constants.expoConfig?.hostUri?.split(":")[0] ?? FALLBACK_HOST;

export const SERVER_URL = `http://${host}:${SERVER_PORT}`;
