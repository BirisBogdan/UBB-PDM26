// RideListScreen.tsx — Master screen
// Infinite scroll over the user's rides, with search, a mode filter and
// a banner for changes not yet sent to the server.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { matchesFilter, useRides } from "../context/RidesContext";
import { useOnline } from "../context/NetworkContext";
import type { Ride } from "../types";

const PAGE_SIZE = 8;

const MODE_FILTERS = [
  { value: "", label: "All" },
  { value: "mtb", label: "MTB" },
  { value: "road", label: "Road" },
  { value: "commuter", label: "Commuter" },
];

type Props = NativeStackScreenProps<RootStackParamList, "RideList">;

// Insert a ride, or replace the one with the same id
function upsert(list: Ride[], ride: Ride): Ride[] {
  const index = list.findIndex((r) => r.id === ride.id);
  if (index < 0) return [ride, ...list];
  const next = [...list];
  next[index] = ride;
  return next;
}

export default function RideListScreen({ navigation }: Props) {
  const { pending, syncing, loadPage, syncPending, subscribe } = useRides();
  const online = useOnline();

  const [rides, setRides] = useState<Ride[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("");

  // Ignore answers to requests made before the search/filter changed
  const requestId = useRef(0);

  // Wait until the user stops typing before searching
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    const result = await loadPage(1, PAGE_SIZE, query, mode).catch(() => null);
    if (id !== requestId.current || !result) return;
    setRides(result.items);
    setPage(1);
    setHasMore(result.hasMore);
    setFromCache(result.fromCache);
    setLoading(false);
    setRefreshing(false);
  }, [loadPage, query, mode]);

  useEffect(() => {
    setLoading(true);
    loadFirstPage();
  }, [loadFirstPage]);

  // Coming back online: reload from the server instead of the cache
  useEffect(() => {
    if (online && fromCache) loadFirstPage();
  }, [online]);

  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    const result = await loadPage(page + 1, PAGE_SIZE, query, mode).catch(() => null);
    if (id === requestId.current && result) {
      // New rides can shift pages on the server, so skip ones already shown
      setRides((current) => [...current, ...result.items.filter((r) => !current.some((c) => c.id === r.id))]);
      setPage(page + 1);
      setHasMore(result.hasMore);
      setFromCache(result.fromCache);
    }
    setLoadingMore(false);
  };

  // Live updates from the socket and from synced offline changes
  useEffect(() => {
    return subscribe((event) => {
      setRides((current) => {
        const list = event.type === "replace" ? current.filter((r) => r.id !== event.localId) : current;
        const exists = list.some((r) => r.id === event.ride.id);
        if (!exists && !matchesFilter(event.ride, query, mode)) return list;
        return upsert(list, event.ride);
      });
    });
  }, [subscribe, query, mode]);

  const onRefresh = () => {
    setRefreshing(true);
    syncPending();
    loadFirstPage();
  };

  // Show local changes on top of what the server returned
  const pendingIds = useMemo(() => new Set(pending.map((op) => op.ride.id)), [pending]);
  const displayed = useMemo(() => {
    let list = rides;
    for (const op of pending) {
      if (op.type === "update" && !list.some((r) => r.id === op.ride.id)) continue;
      if (op.type === "create" && !matchesFilter(op.ride, query, mode)) continue;
      list = upsert(list, op.ride);
    }
    return list;
  }, [rides, pending, query, mode]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by title or route"
        placeholderTextColor="#666"
        value={searchText}
        onChangeText={setSearchText}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <View style={styles.filters}>
        {MODE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, mode === f.value && styles.chipActive]}
            onPress={() => setMode(f.value)}
          >
            <Text style={[styles.chipText, mode === f.value && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {pending.length > 0 && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            {syncing
              ? "Sending changes to the server…"
              : `${pending.length} ${pending.length === 1 ? "change" : "changes"} not sent to the server yet`}
          </Text>
          {online && !syncing && (
            <TouchableOpacity onPress={syncPending}>
              <Text style={styles.pendingAction}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {fromCache && <Text style={styles.cacheNote}>Server unreachable, showing saved rides</Text>}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#aaa" />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={displayed}
          keyExtractor={(item) => item.id.toString()}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#aaa" />}
          ListEmptyComponent={<Text style={styles.empty}>No rides found</Text>}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color="#aaa" /> : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, pendingIds.has(item.id) && styles.itemPending]}
              onPress={() => navigation.navigate("RideDetail", { ride: item })}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {pendingIds.has(item.id) && <Text style={styles.pendingTag}>Not synced</Text>}
              </View>
              <Text style={styles.itemSub}>
                {item.route} — {item.distance_km} km — {item.riders} riders
              </Text>
              <Text style={styles.itemStatus}>
                {item.mode} · {item.status.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("RideDetail", {})}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  search: {
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 12,
    marginBottom: 8,
    fontSize: 15,
  },
  filters: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 8 },
  chip: { backgroundColor: "#1e1e1e", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  chipActive: { backgroundColor: "#4ecca3" },
  chipText: { color: "#aaa", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  pendingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#3a2a12",
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 10,
  },
  pendingText: { color: "#f0b35b", fontSize: 13, flex: 1 },
  pendingAction: { color: "#fff", fontWeight: "600", marginLeft: 12 },
  cacheNote: { color: "#888", fontSize: 12, marginHorizontal: 12, marginBottom: 6 },
  loader: { marginTop: 40 },
  list: { flex: 1 },
  listContent: { padding: 12, paddingTop: 4, paddingBottom: 90 },
  empty: { color: "#666", textAlign: "center", marginTop: 40 },
  footer: { marginVertical: 16 },
  item: { backgroundColor: "#1e1e1e", borderRadius: 16, padding: 16, marginBottom: 10 },
  itemPending: { borderWidth: 1, borderColor: "#f0b35b" },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemTitle: { fontSize: 16, fontWeight: "600", color: "#e0e0e0", flex: 1 },
  pendingTag: { color: "#f0b35b", fontSize: 11, fontWeight: "600", marginLeft: 8 },
  itemSub: { fontSize: 13, color: "#888", marginBottom: 2 },
  itemStatus: { fontSize: 12, color: "#666", textTransform: "capitalize" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4ecca3",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 30, lineHeight: 32 },
});
