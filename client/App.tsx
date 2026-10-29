// App.tsx — Providers and navigation. The login screen is shown only when no token is saved.
// The screen transitions override the native stack's default animations (see screenOptions).

import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./screens/LoginScreen";
import RideListScreen from "./screens/RideListScreen";
import RideDetailScreen from "./screens/RideDetailScreen";
import MapScreen from "./screens/MapScreen";
import { PulseDot } from "./components/Animated";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NetworkProvider, useOnline } from "./context/NetworkContext";
import { RidesProvider } from "./context/RidesContext";
import type { Coordinates, Ride } from "./types";

export type RootStackParamList = {
  Login: undefined;
  RideList: undefined;
  RideDetail: { ride?: Ride; pickedLocation?: Coordinates }; // no ride = create a new one
  // pick: choose the ride's location and send it back; view: show where the ride is
  Map: { mode: "pick" | "view"; location?: Coordinates; title?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function NetworkBadge() {
  const online = useOnline();
  return (
    <View style={styles.badge}>
      <PulseDot active={!online} style={[styles.dot, { backgroundColor: online ? "#4ecca3" : "#e94560" }]} />
      <Text style={styles.badgeText}>{online ? "Online" : "Offline"}</Text>
    </View>
  );
}

function HeaderRight() {
  const { logout } = useAuth();
  return (
    <View style={styles.headerRight}>
      <NetworkBadge />
      <TouchableOpacity onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

function RootNavigator() {
  const { token, username, restoring } = useAuth();

  if (restoring) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#121212" },
        headerTintColor: "#fff",
        contentStyle: { backgroundColor: "#121212" },
        // Overrides the platform's default push animation for every screen
        animation: "ios_from_right",
        animationDuration: 300,
      }}
    >
      {token ? (
        <>
          <Stack.Screen
            name="RideList"
            component={RideListScreen}
            options={{
              title: username ?? "Rides",
              headerRight: () => <HeaderRight />,
              // Login → list: cross-fade instead of the default push
              animation: "fade",
              animationTypeForReplace: "push",
            }}
          />
          <Stack.Screen
            name="RideDetail"
            component={RideDetailScreen}
            options={({ route }) => ({
              title: route.params.ride ? "Edit ride" : "New ride",
              headerRight: () => <NetworkBadge />,
              // The edit page slides up like a sheet instead of in from the side
              animation: "slide_from_bottom",
              animationDuration: 350,
            })}
          />
          <Stack.Screen
            name="Map"
            component={MapScreen}
            options={({ route }) => ({
              title: route.params.mode === "pick" ? "Pick the location" : route.params.title ?? "Ride location",
              animation: "fade_from_bottom",
              // Dragging on the map must move the map, not close the screen
              gestureEnabled: false,
            })}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            title: "RideCluj",
            headerRight: () => <NetworkBadge />,
            // Logout: the login screen fades in and the replace animates like going back
            animation: "fade",
            animationTypeForReplace: "pop",
          }}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App(): React.JSX.Element {
  return (
    <NetworkProvider>
      <AuthProvider>
        <RidesProvider>
          <StatusBar style="light" />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </RidesProvider>
      </AuthProvider>
    </NetworkProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  badge: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1e1e", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  badgeText: { color: "#e0e0e0", fontSize: 12 },
  logout: { marginLeft: 10 },
  logoutText: { color: "#e94560", fontSize: 14, fontWeight: "600" },
});
