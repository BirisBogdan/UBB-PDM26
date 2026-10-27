// RideDetailScreen.tsx — Detail screen: create a ride or edit an existing one.
// Online it saves through REST; offline (or if REST fails) it saves on the phone.

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useRides } from "../context/RidesContext";
import type { RideMode, RideStatus } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "RideDetail">;

const MODES: RideMode[] = ["mtb", "road", "commuter"];
const STATUSES: RideStatus[] = ["waiting", "in_progress", "completed"];

// "2026-11-04T07:00:00.000Z" → "2026-11-04 07:00" (local time)
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDate(text: string): string | null {
  const match = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export default function RideDetailScreen({ route, navigation }: Props) {
  const { ride } = route.params;
  const { saveRide, pending } = useRides();

  const [title, setTitle] = useState(ride?.title ?? "");
  const [routeText, setRouteText] = useState(ride?.route ?? "");
  const [distance, setDistance] = useState(ride ? String(ride.distance_km) : "");
  const [riders, setRiders] = useState(ride ? String(ride.riders) : "1");
  const [start, setStart] = useState(formatDate(ride?.start_time ?? new Date().toISOString()));
  const [mode, setMode] = useState<RideMode>(ride?.mode ?? "road");
  const [status, setStatus] = useState<RideStatus>(ride?.status ?? "waiting");
  const [saving, setSaving] = useState(false);

  const isPending = ride !== undefined && pending.some((op) => op.ride.id === ride.id);

  const handleSave = async () => {
    const startTime = parseDate(start);
    const distanceKm = Number(distance.replace(",", "."));
    const ridersCount = Number(riders);
    if (!title.trim() || !routeText.trim()) return Alert.alert("Missing data", "Title and route are required.");
    if (!(distanceKm > 0)) return Alert.alert("Invalid distance", "Distance must be a positive number.");
    if (!Number.isInteger(ridersCount) || ridersCount < 0) return Alert.alert("Invalid riders", "Riders must be a whole number.");
    if (!startTime) return Alert.alert("Invalid start", "Use the format YYYY-MM-DD HH:MM.");

    setSaving(true);
    try {
      const result = await saveRide(
        {
          title: title.trim(),
          route: routeText.trim(),
          distance_km: distanceKm,
          riders: ridersCount,
          start_time: startTime,
          mode,
          status,
        },
        ride?.id
      );
      if (result === "local") {
        Alert.alert("Saved on the phone", "The server can't be reached. The ride will be sent automatically when you are back online.");
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {isPending && <Text style={styles.pendingNote}>This ride has changes not sent to the server yet.</Text>}

      <View style={styles.card}>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Route" value={routeText} onChangeText={setRouteText} />
        <Field label="Distance (km)" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
        <Field label="Riders" value={riders} onChangeText={setRiders} keyboardType="number-pad" />
        <Field label="Start (YYYY-MM-DD HH:MM)" value={start} onChangeText={setStart} />

        <Text style={styles.label}>Mode</Text>
        <Choice options={MODES} value={mode} onChange={setMode} />
        <Text style={styles.label}>Status</Text>
        <Choice options={STATUSES} value={status} onChange={setStatus} />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{ride ? "Save changes" : "Create ride"}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? "default"}
        placeholderTextColor="#666"
      />
    </View>
  );
}

function Choice<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.choices}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, value === option && styles.chipActive]}
          onPress={() => onChange(option)}
        >
          <Text style={[styles.chipText, value === option && styles.chipTextActive]}>{option.replace("_", " ")}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  content: { padding: 16 },
  pendingNote: { color: "#f0b35b", marginBottom: 12 },
  card: { backgroundColor: "#1e1e1e", borderRadius: 16, padding: 20, marginBottom: 20 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: "#888", marginBottom: 6 },
  input: {
    backgroundColor: "#2a2a2a",
    color: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  chip: { backgroundColor: "#2a2a2a", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 6 },
  chipActive: { backgroundColor: "#4ecca3" },
  chipText: { color: "#aaa", fontSize: 13, textTransform: "capitalize" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  saveButton: { backgroundColor: "#4ecca3", paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
