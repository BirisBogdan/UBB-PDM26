// App.tsx — Navigation setup (Master-Detail)

import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RideListScreen from "./screens/RideListScreen";
import RideDetailScreen from "./screens/RideDetailScreen";

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
            headerStyle: { backgroundColor: "#121212" },
            headerTintColor: "#fff",
            contentStyle: { backgroundColor: "#121212" },
          }}
        >
          <Stack.Screen
            name="RideList"
            component={RideListScreen}
            options={{ title: "Rides" }}
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
