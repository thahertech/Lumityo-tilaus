import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const START_DELAY = 800;
const BUILD_DURATION = 15000;
const MOUNTAIN_DURATION = BUILD_DURATION;
const SNOWFALL_DURATION = 12000;
const FLAKE_COUNT = 64;
const SNOW_COLORS = ['#FFFFFF', '#F3F9FD', '#E7F3FA'];

function createFlakes() {
  return Array.from({ length: FLAKE_COUNT }, (_, index) => {
    const depth = ((index * 17) % FLAKE_COUNT) / FLAKE_COUNT;
    return {
      x: 0.03 + (((index * 37) % FLAKE_COUNT) + 0.5) / FLAKE_COUNT * 0.94,
      start: index * SNOWFALL_DURATION / FLAKE_COUNT,
      duration: 5200 + depth * 1800,
      size: 2 + depth * 2.2,
      opacity: 0.38 + depth * 0.32,
      color: SNOW_COLORS[index % SNOW_COLORS.length],
      drift: ((index % 7) - 3) * 2,
      sway: 2 + (index % 4),
      phase: (index % 8) * Math.PI / 4,
    };
  });
}

// Coordinates follow the visible, centered tractor image within its 724:241 artboard.
function landingHeight(x) {
  if (x >= 0.53 && x <= 0.71) return 0.08;
  if (x >= 0.47 && x < 0.53) return 0.32;
  if (x >= 0.22 && x <= 0.40) return 0.63;
  if (x > 0.71 && x <= 0.76) return 0.34;
  return 0.97;
}

function flakeFrames(flake, width, height, artworkHeight) {
  const settle = 0.88;
  const times = [0, SNOWFALL_DURATION];
  for (const offset of [-SNOWFALL_DURATION, 0]) {
    for (let step = 0; step <= 16; step += 1) {
      const time = flake.start + offset + flake.duration * settle * step / 16;
      if (time > 0 && time < SNOWFALL_DURATION) times.push(time);
    }
    const end = flake.start + offset + flake.duration;
    if (end > 0 && end < SNOWFALL_DURATION) times.push(end);
  }
  times.sort((a, b) => a - b);
  const landingY = height - artworkHeight + landingHeight(flake.x) * artworkHeight;
  const values = times.map((time) => {
    const age = ((time - flake.start + SNOWFALL_DURATION) % SNOWFALL_DURATION) / flake.duration;
    const falling = Math.min(age / settle, 1);
    const fadeIn = Math.min(age / 0.08, 1);
    const fadeOut = Math.max(0, Math.min((1 - age) / (1 - settle), 1));
    return {
      x: flake.x * width + (falling - 1) * flake.drift
        + flake.sway * (Math.sin(falling * Math.PI * 2 + flake.phase) - Math.sin(flake.phase)),
      y: -flake.size + falling * (landingY + flake.size),
      opacity: flake.opacity * fadeIn * fadeOut,
    };
  });
  return { times, values };
}

export function useHomeSnow(reduceMotion) {
  const accumulation = useRef(new Animated.Value(0)).current;
  const mountain = useRef(new Animated.Value(0)).current;
  const [snowing, setSnowing] = useState(false);

  useFocusEffect(useCallback(() => {
    let timer;
    let animation;
    let mountainAnimation;
    const reset = () => {
      clearTimeout(timer);
      if (animation) animation.stop();
      if (mountainAnimation) mountainAnimation.stop();
      accumulation.setValue(0);
      mountain.setValue(0);
      setSnowing(false);
    };
    const start = () => {
      reset();
      if (reduceMotion !== false || (AppState.currentState && AppState.currentState !== 'active')) return;
      timer = setTimeout(() => {
        setSnowing(true);
        animation = Animated.timing(accumulation, {
          toValue: 1,
          duration: BUILD_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        });
        animation.start();
        mountainAnimation = Animated.timing(mountain, {
          toValue: 1,
          duration: MOUNTAIN_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        });
        mountainAnimation.start();
      }, START_DELAY);
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else reset();
    });
    return () => {
      subscription.remove();
      reset();
    };
  }, [accumulation, mountain, reduceMotion]));

  return { accumulation, mountain, snowing };
}

export function Snowfall({ artworkHeight }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState(null);
  const [flakes] = useState(createFlakes);

  useEffect(() => {
    if (!size) return undefined;
    progress.setValue(0);
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: SNOWFALL_DURATION,
      duration: SNOWFALL_DURATION,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
    }));
    animation.start();
    return () => animation.stop();
  }, [progress, size]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.overlay]}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width > 0 && layout.height > 0) {
          setSize((current) => current?.width === layout.width && current?.height === layout.height
            ? current : { width: layout.width, height: layout.height });
        }
      }}
    >
      {size && flakes.map((flake, index) => {
        const { times, values } = flakeFrames(flake, size.width, size.height, artworkHeight);
        return (
          <Animated.View
            key={index}
            style={[styles.flake, {
              width: flake.size,
              height: flake.size,
              borderRadius: flake.size / 2,
              backgroundColor: flake.color,
              opacity: progress.interpolate({
                inputRange: times,
                outputRange: values.map((value) => value.opacity),
                extrapolate: 'clamp',
              }),
              transform: [
                { translateX: progress.interpolate({
                  inputRange: times,
                  outputRange: values.map((value) => value.x),
                  extrapolate: 'clamp',
                }) },
                { translateY: progress.interpolate({
                  inputRange: times,
                  outputRange: values.map((value) => value.y),
                  extrapolate: 'clamp',
                }) },
              ],
            }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1, overflow: 'hidden' },
  flake: {
    position: 'absolute',
    top: 0,
    left: 0,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
  },
});
