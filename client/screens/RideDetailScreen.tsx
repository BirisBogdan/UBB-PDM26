// RideDetailScreen.tsx — Detail screen
// Shows ride info and an Enroll/Unenroll button that uses WebSocket.
// Enrollment state is persisted locally with AsyncStorage and synced with the server.

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Must match the backend server address
const SERVER_URL = "http://192.168.0.59:8080";

// AsyncStorage key prefix for enrollment state
const ENROLLMENT_KEY_PREFIX = "@enrolled_ride_";

type Props = NativeStackScreenProps<RootStackParamList, "RideDetail">;

export default function RideDetailScreen({ route }: Props) {
  const { ride } = route.params;
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // ── Load enrollment state on mount ──────────────────────────────
  const loadEnrollmentState = useCallback(async () => {
    try {
      // 1. Check local cache first (instant)
      const localValue = await AsyncStorage.getItem(
        `${ENROLLMENT_KEY_PREFIX}${ride.id}`
      );
      if (localValue === "true") {
        setEnrolled(true);
      }

      // 2. Then sync with server (source of truth)
      const response = await fetch(
        `${SERVER_URL}/api/enrollments/${ride.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setEnrolled(data.enrolled);
        // Update local cache to match server
        await AsyncStorage.setItem(
          `${ENROLLMENT_KEY_PREFIX}${ride.id}`,
          data.enrolled ? "true" : "false"
        );
      }
    } catch (err) {
      // If server is unreachable, local cache is still used
      console.warn("Could not sync enrollment with server:", err);
    } finally {
      setLoading(false);
    }
  }, [ride.id]);

  useEffect(() => {
    loadEnrollmentState();
  }, [loadEnrollmentState]);

  // ── WebSocket connection ────────────────────────────────────────
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("ENROLL_CONFIRMED", async (data: { rideId: number; message: string }) => {
      if (data.rideId === ride.id) {
        setEnrolled(true);
        await AsyncStorage.setItem(
          `${ENROLLMENT_KEY_PREFIX}${ride.id}`,
          "true"
        );
        Alert.alert("Enrolled", data.message);
      }
    });

    socket.on("UNENROLL_CONFIRMED", async (data: { rideId: number; message: string }) => {
      if (data.rideId === ride.id) {
        setEnrolled(false);
        await AsyncStorage.setItem(
          `${ENROLLMENT_KEY_PREFIX}${ride.id}`,
          "false"
        );
        Alert.alert("Unenrolled", data.message);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ride.id]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleEnroll = () => {
    if (socketRef.current) {
      socketRef.current.emit("ENROLL", { rideId: ride.id });
    }
  };

  const handleUnenroll = () => {
    if (socketRef.current) {
      socketRef.current.emit("UNENROLL", { rideId: ride.id });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{ride.title}</Text>
        <Row label="Mode" value={ride.mode} />
        <Row label="Route" value={ride.route} />
        <Row label="Distance" value={`${ride.distance_km} km`} />
        <Row label="Riders" value={`${ride.riders}`} />
        <Row label="Status" value={ride.status.replace("_", " ")} />
        <Row label="Start" value={new Date(ride.start_time).toLocaleTimeString()} />
      </View>

      <TouchableOpacity
        style={[styles.enrollButton, enrolled && styles.enrolledButton]}
        onPress={enrolled ? handleUnenroll : handleEnroll}
      >
        <Text style={styles.enrollButtonText}>
          {enrolled ? "Unenroll" : "Enroll"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 16,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e0e0e0",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  label: {
    fontSize: 14,
    color: "#888",
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e0e0e0",
    textTransform: "capitalize",
  },
  enrollButton: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  enrolledButton: {
    backgroundColor: "#4ecca3",
  },
  enrollButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

