import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const START_DELAY = 5000;
const BUILD_DURATION = 15000;
const MOUNTAIN_DURATION = 60000 - START_DELAY;
const SNOWFALL_DURATION = 22000;
const INITIAL_FLAKES = 24;
const FALLING_FLAKES = 200;
const SNOW_COLORS = ['#F8FCFF', '#E3F3FF', '#CEE7F8'];

function createFlakes() {
  return Array.from({ length: INITIAL_FLAKES + FALLING_FLAKES }, (_, index) => {
    const depth = Math.random() ** 2;
    const initial = index < INITIAL_FLAKES;
    const crystal = index % 11 === 0;
    return {
      x: Math.random(),
      startY: initial ? Math.random() * 0.7 : 0,
      start: initial ? 10 : 200 + (BUILD_DURATION - 200) * ((index - INITIAL_FLAKES) / (FALLING_FLAKES - 1)) ** 0.7,
      duration: 6900 - depth * 1900,
      size: crystal ? 10 + depth * 3 : 3 + depth * 5,
      opacity: 0.68 + depth * 0.3,
      crystal,
      color: SNOW_COLORS[index % SNOW_COLORS.length],
      drift: index % 4 === 0 ? -(20 + Math.random() * 15) : 28 + Math.random() * 25,
      sway: 6 + Math.random() * 5 + depth * 3,
      phase: Math.random() * Math.PI * 2,
    };
  });
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

export function Snowfall() {
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
        const end = flake.start + flake.duration;
        const movement = { inputRange: [flake.start, end], extrapolate: 'clamp' };
        const windSteps = Array.from({ length: 9 }, (_, step) => step / 8);
        return (
          <Animated.View
            key={index}
            style={[styles.flake, {
              width: flake.size,
              height: flake.size,
              borderRadius: flake.size / 2,
              backgroundColor: flake.crystal ? 'transparent' : flake.color,
              borderWidth: flake.crystal ? 0 : StyleSheet.hairlineWidth,
              opacity: progress.interpolate({
                inputRange: [0, flake.start, flake.start + 150, end - 150, end, SNOWFALL_DURATION],
                outputRange: [0, 0, flake.opacity, flake.opacity, 0, 0],
              }),
              transform: [
                { translateX: progress.interpolate({
                  inputRange: windSteps.map((step) => flake.start + step * flake.duration),
                  outputRange: windSteps.map((step) => flake.x * size.width + step * flake.drift
                    + 10 * Math.sin(step * Math.PI * 2)
                    + flake.sway * (Math.sin(step * Math.PI * 4 + flake.phase) - Math.sin(flake.phase))),
                  extrapolate: 'clamp',
                }) },
                { translateY: progress.interpolate({ ...movement, outputRange: [flake.startY * size.height - flake.size, size.height + flake.size] }) },
                ...(flake.crystal ? [{ rotate: progress.interpolate({ ...movement, outputRange: ['-20deg', '35deg'] }) }] : []),
              ],
            }]}
          >
            {flake.crystal && [0, 60, -60].map((angle) => (
              <View key={angle} style={[styles.crystalArm, {
                width: flake.size,
                top: flake.size / 2 - 0.6,
                backgroundColor: flake.color,
                transform: [{ rotate: `${angle}deg` }],
              }]} />
            ))}
          </Animated.View>
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
    borderColor: 'rgba(38, 72, 94, 0.55)',
  },
  crystalArm: {
    position: 'absolute',
    left: 0,
    height: 1.2,
    borderRadius: 1,
    shadowColor: '#315778',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 1,
  },
});
