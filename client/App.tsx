// App.tsx — Providers and navigation. The login screen is shown only when no token is saved.

import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./screens/LoginScreen";
import RideListScreen from "./screens/RideListScreen";
import RideDetailScreen from "./screens/RideDetailScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NetworkProvider, useOnline } from "./context/NetworkContext";
import { RidesProvider } from "./context/RidesContext";
import type { Ride } from "./types";

export type RootStackParamList = {
  Login: undefined;
  RideList: undefined;
  RideDetail: { ride?: Ride }; // no ride = create a new one
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function NetworkBadge() {
  const online = useOnline();
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: online ? "#4ecca3" : "#e94560" }]} />
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
      }}
    >
      {token ? (
        <>
          <Stack.Screen
            name="RideList"
            component={RideListScreen}
            options={{ title: username ?? "Rides", headerRight: () => <HeaderRight /> }}
          />
          <Stack.Screen
            name="RideDetail"
            component={RideDetailScreen}
            options={({ route }) => ({
              title: route.params.ride ? "Edit ride" : "New ride",
              headerRight: () => <NetworkBadge />,
            })}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "RideCluj", headerRight: () => <NetworkBadge /> }}
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
