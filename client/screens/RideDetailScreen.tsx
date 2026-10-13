// RideDetailScreen.tsx — Detail screen
// Displays full info for a selected ride.
// Connects to WebSocket to receive real-time hazard alerts from the server.

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

// Must match the backend server address
const SOCKET_URL = "http://192.168.0.59:8080";

interface HazardAlert {
  id: number;
  type: "pothole" | "dog" | "weather" | "obstacle" | "traffic";
  message: string;
  location: string;
  severity: "low" | "medium" | "high";
  reported_at: string;
}

type Props = NativeStackScreenProps<RootStackParamList, "RideDetail">;

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

const modeLabel = (mode: string): string => {
  switch (mode) {
    case "mtb":
      return "MTB Trail";
    case "road":
      return "Road Ride";
    case "commuter":
      return "City Commute";
    default:
      return mode;
  }
};

export default function RideDetailScreen({ route }: Props) {
  const { ride } = route.params;

  const [alerts, setAlerts] = useState<HazardAlert[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  // Connect to WebSocket on mount, listen for hazard alerts
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // Handle incoming hazard alerts from the server
    socket.on("NEW_HAZARD_ALERT", (alert: HazardAlert) => {
      Alert.alert(
        "Hazard Alert",
        `${alert.message}\n\nLocation: ${alert.location}\nSeverity: ${alert.severity.toUpperCase()}`,
        [{ text: "OK", style: "default" }]
      );

      setAlerts((prev) => [alert, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Ride info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ride Information</Text>

        <View style={styles.infoCard}>
          <InfoRow label="Mode" value={modeLabel(ride.mode)} />
          <InfoRow label="Route" value={ride.route} />
          <InfoRow label="Distance" value={`${ride.distance_km} km`} />
          <InfoRow label="Riders" value={`${ride.riders}`} />
          <InfoRow label="Status" value={ride.status.replace("_", " ").toUpperCase()} />
          <InfoRow
            label="Start Time"
            value={new Date(ride.start_time).toLocaleTimeString()}
          />
        </View>
      </View>

      {/* WebSocket connection status */}
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
              ? "Connected"
              : "Connecting..."}
          </Text>
        </View>
      </View>

      {/* Received alerts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Received Alerts ({alerts.length})
        </Text>

        {alerts.length === 0 ? (
          <Text style={styles.emptyText}>
            No alerts received yet.
          </Text>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
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
              <Text style={styles.alertLocation}>{alert.location}</Text>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16213e",
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#e0e0e0",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
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
  emptyText: {
    color: "#6a6a8a",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 16,
  },
});
