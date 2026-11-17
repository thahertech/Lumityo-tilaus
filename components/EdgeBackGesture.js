import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const EDGE_WIDTH = 28;
const BACK_DISTANCE = 72;

export default function EdgeBackGesture({ enabled, onBack }) {
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => enabled &&
      gesture.x0 <= EDGE_WIDTH && gesture.dx > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderRelease: (_event, gesture) => {
      if (enabled && gesture.dx >= BACK_DISTANCE && Math.abs(gesture.dy) < BACK_DISTANCE) onBack();
    },
  }), [enabled, onBack]);

  if (!enabled) return null;
  return <View {...responder.panHandlers} pointerEvents="box-only" style={styles.edge} />;
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE_WIDTH, zIndex: 1000 },
});
