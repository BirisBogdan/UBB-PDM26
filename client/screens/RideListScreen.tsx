// RideListScreen.tsx — Master screen
// Fetches rides from REST API and displays them in a list.

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

// Replace with your machine's local network IP
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

export default function RideListScreen({ navigation }: Props) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRides = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/rides`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data: Ride[] = await response.json();
      setRides(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#aaa" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRides}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={rides}
      keyExtractor={(item) => item.id.toString()}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#aaa"
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => navigation.navigate("RideDetail", { ride: item })}
          activeOpacity={0.7}
        >
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSub}>
            {item.route} — {item.distance_km} km — {item.riders} riders
          </Text>
          <Text style={styles.itemStatus}>
            {item.status.replace("_", " ")}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: "#121212",
  },
  listContent: {
    padding: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  errorText: {
    color: "#e94560",
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  item: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e0e0e0",
    marginBottom: 4,
  },
  itemSub: {
    fontSize: 13,
    color: "#888",
    marginBottom: 2,
  },
  itemStatus: {
    fontSize: 12,
    color: "#666",
    textTransform: "capitalize",
  },
});
