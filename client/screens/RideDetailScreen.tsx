// RideDetailScreen.tsx — Detail screen: create a ride or edit an existing one.
// Online it saves through REST; offline (or if REST fails) it saves on the phone.
// The user can take a photo (expo-image-picker camera), which is copied into the
// app's storage (expo-file-system) and uploaded with the ride, and pick the
// ride's meeting point on a map.

import React, { useEffect, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { useRides } from "../context/RidesContext";
import { photoUri, savePhotoOnDevice } from "../services/photos";
import { FadeInImage, FadeInView, ScalePressable } from "../components/Animated";
import type { Coordinates, RideMode, RideStatus } from "../types";

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
  const { ride, pickedLocation } = route.params;
  const { saveRide, pending } = useRides();

  const [title, setTitle] = useState(ride?.title ?? "");
  const [routeText, setRouteText] = useState(ride?.route ?? "");
  const [distance, setDistance] = useState(ride ? String(ride.distance_km) : "");
  const [riders, setRiders] = useState(ride ? String(ride.riders) : "1");
  const [start, setStart] = useState(formatDate(ride?.start_time ?? new Date().toISOString()));
  const [mode, setMode] = useState<RideMode>(ride?.mode ?? "road");
  const [status, setStatus] = useState<RideStatus>(ride?.status ?? "waiting");
  const [saving, setSaving] = useState(false);
  // A photo taken now, already saved on the phone; uploaded when the ride is saved
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(
    ride?.latitude != null && ride?.longitude != null ? { latitude: ride.latitude, longitude: ride.longitude } : null
  );

  const isPending = ride !== undefined && pending.some((op) => op.ride.id === ride.id);
  const shownPhoto = newPhoto ?? (ride ? photoUri(ride) : null);

  // The map screen sends the chosen point back as a route param
  useEffect(() => {
    if (pickedLocation) setLocation(pickedLocation);
  }, [pickedLocation]);

  const getPhoto = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert("No access", `Allow ${source === "camera" ? "camera" : "photo"} access in the phone's settings.`);
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [16, 9] };
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return;
    try {
      setNewPhoto(savePhotoOnDevice(result.assets[0].uri));
    } catch (err) {
      Alert.alert("Could not save the photo", err instanceof Error ? err.message : "Unknown error");
    }
  };

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
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
        },
        ride?.id,
        newPhoto ?? undefined
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

      <FadeInView style={styles.card}>
        <Text style={styles.label}>Photo</Text>
        {shownPhoto ? (
          <FadeInImage uri={shownPhoto} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Text style={styles.photoEmptyText}>No photo yet</Text>
          </View>
        )}
        {newPhoto && <Text style={styles.hint}>Saved on the phone, uploaded when you save the ride.</Text>}
        <View style={styles.row}>
          <ScalePressable style={styles.smallButton} onPress={() => getPhoto("camera")}>
            <Text style={styles.smallButtonText}>Take photo</Text>
          </ScalePressable>
          <ScalePressable style={styles.smallButton} onPress={() => getPhoto("library")}>
            <Text style={styles.smallButtonText}>From gallery</Text>
          </ScalePressable>
        </View>
      </FadeInView>

      <FadeInView style={styles.card} delay={80}>
        <Text style={styles.label}>Meeting point</Text>
        <Text style={styles.locationText}>
          {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "No location selected"}
        </Text>
        <View style={styles.row}>
          <ScalePressable
            style={styles.smallButton}
            onPress={() => navigation.navigate("Map", { mode: "pick", location: location ?? undefined })}
          >
            <Text style={styles.smallButtonText}>{location ? "Change on map" : "Pick on map"}</Text>
          </ScalePressable>
          {location && (
            <ScalePressable
              style={styles.smallButton}
              onPress={() => navigation.navigate("Map", { mode: "view", location, title: title || "Ride" })}
            >
              <Text style={styles.smallButtonText}>View on map</Text>
            </ScalePressable>
          )}
          {location && (
            <ScalePressable style={[styles.smallButton, styles.clearButton]} onPress={() => setLocation(null)}>
              <Text style={styles.clearText}>Clear</Text>
            </ScalePressable>
          )}
        </View>
      </FadeInView>

      <FadeInView style={styles.card} delay={160}>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Route" value={routeText} onChangeText={setRouteText} />
        <Field label="Distance (km)" value={distance} onChangeText={setDistance} keyboardType="decimal-pad" />
        <Field label="Riders" value={riders} onChangeText={setRiders} keyboardType="number-pad" />
        <Field label="Start (YYYY-MM-DD HH:MM)" value={start} onChangeText={setStart} />

        <Text style={styles.label}>Mode</Text>
        <Choice options={MODES} value={mode} onChange={setMode} />
        <Text style={styles.label}>Status</Text>
        <Choice options={STATUSES} value={status} onChange={setStatus} />
      </FadeInView>

      <ScalePressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{ride ? "Save changes" : "Create ride"}</Text>}
      </ScalePressable>
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
  content: { padding: 16, paddingBottom: 40 },
  pendingNote: { color: "#f0b35b", marginBottom: 12 },
  card: { backgroundColor: "#1e1e1e", borderRadius: 16, padding: 20, marginBottom: 16 },
  photo: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: "#2a2a2a", marginBottom: 10 },
  photoEmpty: { justifyContent: "center", alignItems: "center" },
  photoEmptyText: { color: "#666" },
  hint: { color: "#888", fontSize: 12, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallButton: { backgroundColor: "#2a2a2a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  smallButtonText: { color: "#4ecca3", fontWeight: "600", fontSize: 14 },
  clearButton: { backgroundColor: "transparent" },
  clearText: { color: "#e94560", fontWeight: "600", fontSize: 14 },
  locationText: { color: "#e0e0e0", fontSize: 15, marginBottom: 10 },
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
