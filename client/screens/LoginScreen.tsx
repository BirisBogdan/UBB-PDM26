// LoginScreen.tsx — Username/password login; the server answers with a JWT

import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      // AuthContext now has a token, so the navigator switches to the ride list
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message === "Aborted" || message.includes("Network") ? "Cannot reach the server" : message);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleLogin}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.button, (!username || !password) && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading || !username || !password}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
      </TouchableOpacity>
      <Text style={styles.hint}>Demo accounts: bogdan / bogdan123, ana / ana123</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 24, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", color: "#e0e0e0", marginBottom: 24 },
  input: {
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: "#e94560", marginBottom: 12 },
  button: { backgroundColor: "#4ecca3", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  hint: { color: "#666", fontSize: 12, marginTop: 20, textAlign: "center" },
});
