// Animated.tsx — Small animated building blocks (React Native Animated API).
// All animations run on the native thread (useNativeDriver: true).

import React, { useEffect, useRef } from "react";
import { Animated, Easing, ImageStyle, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

// Fades in and slides up a little when it first appears (list items, cards, banners)
export function FadeInView({
  delay = 0,
  distance = 16,
  style,
  children,
}: {
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 350,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// Replaces TouchableOpacity's built-in press animation (opacity fade) with a spring
// "squeeze": the component shrinks while pressed and bounces back when released
export function ScalePressable({
  style,
  scaleTo = 0.95,
  children,
  ...props
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: toValue === 1 ? 12 : 0, useNativeDriver: true }).start();

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        springTo(scaleTo);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        springTo(1);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, props.disabled ? { opacity: 0.5 } : null]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// An image that fades in once it has loaded, instead of popping in
export function FadeInImage({ uri, style }: { uri: string; style: StyleProp<ImageStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
  }, [uri]);

  return (
    <Animated.Image
      source={{ uri }}
      style={[style, { opacity }]}
      onLoad={() => Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()}
    />
  );
}

// A dot that keeps pulsing while `active` (the network badge while offline)
export function PulseDot({ active, style }: { active: boolean; style: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return <Animated.View style={[style, { transform: [{ scale }] }]} />;
}
