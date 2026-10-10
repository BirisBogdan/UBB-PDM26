/**
 * ============================================================================
 *  RideCluj — App.tsx (Navigation Setup)
 * ============================================================================
 *
 *  ── RUBRIC #2: Master-Detail User Interface ──
 *
 *  This file sets up a React Navigation Native Stack with two screens:
 *    • RideListScreen   → MASTER  (list of all active rides)
 *    • RideDetailScreen → DETAIL  (full info for one selected ride)
 *
 *  Tapping an item in the Master list navigates to the Detail screen,
 *  which is the classic master-detail pattern.
 *
 *  All navigation libraries used here are compatible with Expo Go
 *  (no custom native modules required).
 * ============================================================================
 */

import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RideListScreen from "./screens/RideListScreen";
import RideDetailScreen from "./screens/RideDetailScreen";

// ---------------------------------------------------------------------------
// Navigation Types
// ---------------------------------------------------------------------------

/**
 * Type-safe route params for the stack navigator.
 * RideDetail receives the full ride object so the detail screen
 * can render immediately without an extra network call.
 */
export type RootStackParamList = {
  RideList: undefined;
  RideDetail: {
    ride: {
      id: number;
      title: string;
      mode: "mtb" | "road" | "commuter";
      route: string;
      distance_km: number;
      riders: number;
      start_time: string;
      status: "waiting" | "in_progress" | "completed";
    };
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------

export default function App(): React.JSX.Element {
  return (
    <>
      {/* Dark status bar to match the app theme */}
      <StatusBar style="light" />

      <NavigationContainer>
        {/*
          ── RUBRIC #2: Master-Detail UI ──
          Two screens in a stack: Master (RideList) and Detail (RideDetail).
        */}
        <Stack.Navigator
          initialRouteName="RideList"
          screenOptions={{
            headerStyle: { backgroundColor: "#1a1a2e" },
            headerTintColor: "#e0e0e0",
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: "#16213e" },
          }}
        >
          <Stack.Screen
            name="RideList"
            component={RideListScreen}
            options={{ title: "🚴 RideCluj — Active Rides" }}
          />
          <Stack.Screen
            name="RideDetail"
            component={RideDetailScreen}
            options={({ route }) => ({
              title: route.params.ride.title,
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
