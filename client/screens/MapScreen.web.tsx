// MapScreen.web.tsx — react-native-maps does not run in a browser, so on web
// the map screen only shows the coordinates and a link to OpenStreetMap.

import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

type Props = NativeStackScreenProps<RootStackParamList, "Map">;

export default function MapScreen({ route }: Props) {
  const { location } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Maps are available in the phone app (Expo Go).</Text>
      {location && (
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=15/${location.latitude}/${location.longitude}`
            )
          }
        >
          <Text style={styles.link}>
            Open {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} on OpenStreetMap
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 24, justifyContent: "center", alignItems: "center" },
  text: { color: "#e0e0e0", fontSize: 15, marginBottom: 16, textAlign: "center" },
  link: { color: "#4ecca3", fontSize: 15, fontWeight: "600" },
});
