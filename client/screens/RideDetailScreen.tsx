// RideDetailScreen.tsx — Detail screen
// Shows ride info and an Enroll button that uses WebSocket.

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { io, Socket } from "socket.io-client";

// Must match the backend server address
const SOCKET_URL = "http://192.168.0.59:8080";

type Props = NativeStackScreenProps<RootStackParamList, "RideDetail">;

export default function RideDetailScreen({ route }: Props) {
  const { ride } = route.params;
  const [enrolled, setEnrolled] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("ENROLL_CONFIRMED", (data: { message: string }) => {
      setEnrolled(true);
      Alert.alert("Enrolled", data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleEnroll = () => {
    if (socketRef.current) {
      socketRef.current.emit("ENROLL", { rideId: ride.id });
    }
  };

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
        onPress={handleEnroll}
        disabled={enrolled}
      >
        <Text style={styles.enrollButtonText}>
          {enrolled ? "Enrolled" : "Enroll"}
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
