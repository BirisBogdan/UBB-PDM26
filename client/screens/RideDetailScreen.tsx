/**
 * ============================================================================
 *  RideCluj — RideDetailScreen.tsx (DETAIL Screen)
 * ============================================================================
 *
 *  ── RUBRIC #2: Master-Detail UI (Detail half) ──
 *  This is the DETAIL screen. It displays full information about a single
 *  ride that was selected from the Master screen (RideListScreen).
 *
 *  ── RUBRIC #4: WebSocket Server-Side Notifications ──
 *  On mount, this screen connects to the Socket.io server and listens for
 *  the NEW_HAZARD_ALERT event. When the server pushes a hazard notification,
 *  it is displayed using React Native's Alert dialog AND appended to an
 *  on-screen log so the user can see all received alerts.
 * ============================================================================
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { io, Socket } from "socket.io-client";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * ⚠️  IMPORTANT: Must match the backend server address.
 * Replace "localhost" with your machine's local network IP for physical devices.
 */
const SOCKET_URL = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HazardAlert {
  id: number;
  type: "pothole" | "dog" | "weather" | "obstacle" | "traffic";
  message: string;
  location: string;
  severity: "low" | "medium" | "high";
  reported_at: string;
}

type Props = NativeStackScreenProps<RootStackParamList, "RideDetail">;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emoji for hazard type */
const hazardIcon = (type: HazardAlert["type"]): string => {
  const icons: Record<HazardAlert["type"], string> = {
    pothole: "🕳️",
    dog: "🐕",
    weather: "🌧️",
    obstacle: "🚧",
    traffic: "🚗",
  };
  return icons[type] ?? "⚠️";
};

/** Color for severity badge */
const severityColor = (severity: HazardAlert["severity"]): string => {
  switch (severity) {
    case "low":
      return "#4ecca3";
    case "medium":
      return "#f0a500";
    case "high":
      return "#e94560";
  }
};

/** Mode label */
const modeLabel = (mode: string): string => {
  switch (mode) {
    case "mtb":
      return "🏔️ MTB Trail";
    case "road":
      return "🛣️ Road Ride";
    case "commuter":
      return "🏙️ City Commute";
    default:
      return mode;
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RideDetailScreen({ route }: Props) {
  // The ride object passed from the Master screen
  const { ride } = route.params;

  // Accumulated hazard alerts received via WebSocket
  const [alerts, setAlerts] = useState<HazardAlert[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Ref to hold the socket instance for cleanup
  const socketRef = useRef<Socket | null>(null);

  // --------------------------------------------------------------------------
  // ── RUBRIC #4: WebSocket Server-Side Notifications ──
  //
  // We connect to the Socket.io server when this Detail screen mounts.
  // We listen for the "NEW_HAZARD_ALERT" event. When received:
  //   1. Show a React Native Alert dialog (immediate user notification).
  //   2. Append the alert to the on-screen log for visibility.
  //
  // The connection is cleaned up when the user navigates back.
  // --------------------------------------------------------------------------
  useEffect(() => {
    console.log("[RideDetail] Connecting to WebSocket at", SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ["websocket"], // Use WebSocket transport (Expo Go compatible)
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[RideDetail] WebSocket connected:", socket.id);
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[RideDetail] WebSocket disconnected");
      setSocketConnected(false);
    });

    /**
     * ── RUBRIC #4: Receiving the server-side push notification ──
     *
     * The server emits NEW_HAZARD_ALERT every ~15 seconds.
     * We handle it here by:
     *   - Showing a native Alert dialog
     *   - Adding it to the on-screen alerts list
     */
    socket.on("NEW_HAZARD_ALERT", (alert: HazardAlert) => {
      console.log("[RideDetail] Received hazard alert:", alert.message);

      // 1. Show a React Native Alert dialog
      Alert.alert(
        `${hazardIcon(alert.type)} Hazard Alert`,
        `${alert.message}\n\n📍 ${alert.location}\n⚠️ Severity: ${alert.severity.toUpperCase()}`,
        [{ text: "OK", style: "default" }]
      );

      // 2. Append to the on-screen log
      setAlerts((prev) => [alert, ...prev]);
    });

    // Cleanup: disconnect socket when leaving the screen
    return () => {
      console.log("[RideDetail] Cleaning up WebSocket connection");
      socket.disconnect();
    };
  }, []);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Ride Info Section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ride Information</Text>

        <View style={styles.infoCard}>
          <InfoRow label="Mode" value={modeLabel(ride.mode)} />
          <InfoRow label="Route" value={ride.route} />
          <InfoRow label="Distance" value={`${ride.distance_km} km`} />
          <InfoRow label="Riders" value={`${ride.riders} riders`} />
          <InfoRow label="Status" value={ride.status.replace("_", " ").toUpperCase()} />
          <InfoRow
            label="Start Time"
            value={new Date(ride.start_time).toLocaleTimeString()}
          />
        </View>
      </View>

      {/* ── WebSocket Status ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Hazard Feed</Text>

        <View style={styles.connectionBadge}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: socketConnected ? "#4ecca3" : "#e94560" },
            ]}
          />
          <Text style={styles.connectionText}>
            {socketConnected
              ? "Connected — listening for hazard alerts"
              : "Connecting to live feed..."}
          </Text>
        </View>

        <Text style={styles.hintText}>
          💡 The server sends a random hazard alert every ~15 seconds.
          Stay on this screen to see them appear below and as Alert dialogs.
        </Text>
      </View>

      {/* ── Hazard Alerts Log ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Received Alerts ({alerts.length})
        </Text>

        {alerts.length === 0 ? (
          <Text style={styles.emptyText}>
            No alerts received yet. Wait for the server to push one...
          </Text>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertIcon}>
                  {hazardIcon(alert.type)}
                </Text>
                <Text style={styles.alertType}>
                  {alert.type.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.severityBadge,
                    { backgroundColor: severityColor(alert.severity) },
                  ]}
                >
                  <Text style={styles.severityText}>
                    {alert.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <Text style={styles.alertLocation}>📍 {alert.location}</Text>
              <Text style={styles.alertTime}>
                {new Date(alert.reported_at).toLocaleTimeString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Info Row Sub-component
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16213e",
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#e0e0e0",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },

  // ── Info Card ──
  infoCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#e94560",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  infoLabel: {
    color: "#8888a0",
    fontSize: 14,
    fontWeight: "600",
  },
  infoValue: {
    color: "#e0e0e0",
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
    maxWidth: "60%",
  },

  // ── Connection Badge ──
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  connectionText: {
    color: "#a0a0b0",
    fontSize: 14,
  },
  hintText: {
    color: "#6a6a8a",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 18,
  },

  // ── Alert Cards ──
  alertCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#f0a500",
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  alertIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  alertType: {
    color: "#e0e0e0",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  alertMessage: {
    color: "#c0c0d0",
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  alertLocation: {
    color: "#8888a0",
    fontSize: 12,
    marginBottom: 2,
  },
  alertTime: {
    color: "#6a6a8a",
    fontSize: 11,
    textAlign: "right",
  },

  // ── Empty State ──
  emptyText: {
    color: "#6a6a8a",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 16,
  },
});
