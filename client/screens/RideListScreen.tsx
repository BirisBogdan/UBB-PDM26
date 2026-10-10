/**
 * ============================================================================
 *  RideCluj — RideListScreen.tsx (MASTER Screen)
 * ============================================================================
 *
 *  ── RUBRIC #2: Master-Detail UI (Master half) ──
 *  This is the MASTER screen. It displays a FlatList of active group rides.
 *  Tapping any ride navigates to the DETAIL screen (RideDetailScreen).
 *
 *  ── RUBRIC #3: REST Service to Fetch Data ──
 *  On mount, this screen calls `fetch()` against the backend REST endpoint
 *  GET /api/rides to retrieve the list of rides. The data is stored in
 *  React state and rendered in a FlatList.
 * ============================================================================
 */

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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * ⚠️  IMPORTANT: Replace this with your machine's local network IP
 * so the Expo Go app on your phone can reach the backend server.
 *
 * Example: "http://192.168.1.42:3000"
 *
 * Do NOT use "localhost" — it won't resolve on a physical device.
 */
const API_BASE_URL = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Returns an emoji badge based on the ride mode. */
const modeIcon = (mode: Ride["mode"]): string => {
  switch (mode) {
    case "mtb":
      return "🏔️";
    case "road":
      return "🛣️";
    case "commuter":
      return "🏙️";
  }
};

/** Returns a human-readable label for the ride status. */
const statusLabel = (status: Ride["status"]): string => {
  switch (status) {
    case "waiting":
      return "⏳ Waiting";
    case "in_progress":
      return "🟢 In Progress";
    case "completed":
      return "✅ Completed";
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RideListScreen({ navigation }: Props) {
  // ── State ──
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // ── RUBRIC #3: REST Service to Fetch Data ──
  //
  // We use fetch() inside useEffect to call GET /api/rides on mount.
  // This is the simplest way to demonstrate REST data fetching in React Native.
  // --------------------------------------------------------------------------
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
      console.error("[RideListScreen] Failed to fetch rides:", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch rides on initial mount
  useEffect(() => {
    fetchRides();
  }, []);

  // Pull-to-refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    fetchRides();
  };

  // --------------------------------------------------------------------------
  // ── RUBRIC #2: Master-Detail UI (Master — navigate to detail on press) ──
  // --------------------------------------------------------------------------
  const handleRidePress = (ride: Ride) => {
    navigation.navigate("RideDetail", { ride });
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

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
        <Text style={styles.errorEmoji}>⚠️</Text>
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
      {/*
        ── RUBRIC #2 & #3 ──
        FlatList renders the data fetched from the REST API.
        Each item is tappable and navigates to the Detail screen.
      */}
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
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.modeIcon}>{modeIcon(item.mode)}</Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardRoute}>{item.route}</Text>
              </View>
            </View>

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.cardStat}>📏 {item.distance_km} km</Text>
              <Text style={styles.cardStat}>👥 {item.riders} riders</Text>
              <Text style={styles.cardStatus}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
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
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
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
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    // Left accent border
    borderLeftWidth: 4,
    borderLeftColor: "#e94560",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modeIcon: {
    fontSize: 28,
    marginRight: 12,
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
