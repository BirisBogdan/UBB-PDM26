// RideListScreen.tsx — Master screen
// Fetches rides from the REST API and displays them in a list.
// Tapping a ride navigates to the detail screen.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

// Replace with your machine's local network IP (not "localhost")
const API_BASE_URL = "http://192.168.0.59:8080";

interface Ride {
  id: number;
  title: string;
  mode: "mtb" | "road" | "commuter";
  route: string;
  distance_km: number;
  riders: number;
  start_time: string;
  status: "waiting" | "in_progress" | "completed";
}

type Props = NativeStackScreenProps<RootStackParamList, "RideList">;

const modeLabel = (mode: Ride["mode"]): string => {
  switch (mode) {
    case "mtb":
      return "MTB";
    case "road":
      return "Road";
    case "commuter":
      return "Commuter";
  }
};

const statusLabel = (status: Ride["status"]): string => {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
  }
};

const statusColor = (status: Ride["status"]): string => {
  switch (status) {
    case "waiting":
      return "#f0a500";
    case "in_progress":
      return "#4ecca3";
    case "completed":
      return "#8888a0";
  }
};

export default function RideListScreen({ navigation }: Props) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch rides from REST API
  const fetchRides = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/rides`);

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data: Ride[] = await response.json();
      setRides(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides();
  };

  const handleRidePress = (ride: Ride) => {
    navigation.navigate("RideDetail", { ride });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading rides...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load rides</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRides}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e94560"
            colors={["#e94560"]}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleRidePress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{modeLabel(item.mode)}</Text>
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardRoute}>{item.route}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardStat}>{item.distance_km} km</Text>
              <Text style={styles.cardStat}>{item.riders} riders</Text>
              <Text style={[styles.cardStatus, { color: statusColor(item.status) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16213e",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#16213e",
    padding: 24,
  },
  loadingText: {
    color: "#a0a0b0",
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: "#e94560",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorDetail: {
    color: "#a0a0b0",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#e94560",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#e94560",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modeBadge: {
    backgroundColor: "#2a2a4a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  modeBadgeText: {
    color: "#e94560",
    fontSize: 12,
    fontWeight: "700",
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    color: "#e0e0e0",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardRoute: {
    color: "#8888a0",
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#2a2a4a",
    paddingTop: 10,
  },
  cardStat: {
    color: "#a0a0b0",
    fontSize: 13,
  },
  cardStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
});
