// App.tsx — Navigation setup (Master-Detail pattern)

import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RideListScreen from "./screens/RideListScreen";
import RideDetailScreen from "./screens/RideDetailScreen";

// Route params for the stack navigator
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

export default function App(): React.JSX.Element {
  return (
    <>
      <StatusBar style="light" />

      <NavigationContainer>
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
            options={{ title: "RideCluj" }}
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
