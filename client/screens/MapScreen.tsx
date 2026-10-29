// MapScreen.tsx — Map of a ride's meeting point (react-native-maps + expo-location).
// "pick" mode (from the edit page): tap or drag the pin, or use the phone's GPS,
//   then "Use this location" sends the coordinates back to the edit page.
// "view" mode (from the list or the edit page): shows where the ride is,
//   the user's own position, and opens directions in the maps app.

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";
import { FadeInView, ScalePressable } from "../components/Animated";
import type { Coordinates } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Map">;

// Piata Unirii, Cluj-Napoca: where the map starts when a ride has no location yet
const CLUJ: Coordinates = { latitude: 46.7694, longitude: 23.5899 };
const ZOOM = { latitudeDelta: 0.03, longitudeDelta: 0.03 };

export default function MapScreen({ route, navigation }: Props) {
  const { mode, location, title } = route.params;
  const picking = mode === "pick";

  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<Coordinates | null>(location ?? null);
  const [showMe, setShowMe] = useState(false);
  const [locating, setLocating] = useState(false);

  // Show the blue "you are here" dot if the user already allowed location access
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((p) => setShowMe(p.granted));
  }, []);

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("No location access", "Allow location access in the phone's settings to use your position.");
        return;
      }
      setShowMe(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const me = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (picking) setPin(me);
      mapRef.current?.animateToRegion({ ...me, ...ZOOM }, 700);
    } catch {
      Alert.alert("Location unavailable", "Could not read the phone's position. Is GPS turned on?");
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (!pin) return;
    // Back to the edit page; merge keeps the ride that is being edited
    navigation.popTo("RideDetail", { pickedLocation: pin }, { merge: true });
  };

  const openDirections = () => {
    if (!pin) return;
    const { latitude, longitude } = pin;
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...(location ?? CLUJ), ...ZOOM }}
        showsUserLocation={showMe}
        onPress={picking ? (e) => setPin(e.nativeEvent.coordinate) : undefined}
      >
        {pin && (
          <Marker
            coordinate={pin}
            title={picking ? "Meeting point" : title ?? "Ride"}
            draggable={picking}
            onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}
            pinColor="#4ecca3"
          />
        )}
      </MapView>

      <FadeInView style={styles.panel} delay={200} distance={60}>
        <Text style={styles.coords}>
          {pin
            ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`
            : picking
              ? "Tap the map to place the meeting point"
              : "This ride has no location"}
        </Text>
        <View style={styles.row}>
          <ScalePressable style={[styles.button, styles.secondary]} onPress={goToMyLocation} disabled={locating}>
            {locating ? <ActivityIndicator color="#4ecca3" /> : <Text style={styles.secondaryText}>My location</Text>}
          </ScalePressable>
          {picking ? (
            <ScalePressable style={styles.button} onPress={confirm} disabled={!pin}>
              <Text style={styles.buttonText}>Use this location</Text>
            </ScalePressable>
          ) : (
            <ScalePressable style={styles.button} onPress={openDirections} disabled={!pin}>
              <Text style={styles.buttonText}>Directions</Text>
            </ScalePressable>
          )}
        </View>
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  panel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 30,
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 16,
    elevation: 6,
  },
  coords: { color: "#e0e0e0", fontSize: 14, marginBottom: 12, textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  button: { flex: 1, backgroundColor: "#4ecca3", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  secondary: { backgroundColor: "#2a2a2a" },
  secondaryText: { color: "#4ecca3", fontWeight: "600", fontSize: 15 },
});
