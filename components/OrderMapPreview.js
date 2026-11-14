import { theme } from '../theme';
import React, { useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

/**
 * Interactive map preview for order address.
 * Shows a draggable pin — dragging it updates the coordinates (not the address text).
 *
 * Props:
 *   initialLatitude    {number}   – lat from geocoding (only changes on new address select)
 *   initialLongitude   {number}   – lon from geocoding (only changes on new address select)
 *   address            {string}   – display label on the marker popup
 *   onCoordinatesChange {(lat, lon) => void} – called when pin is dragged
 *   onReset            {() => void}          – called when user taps "Palauta alkuperäinen"
 */
const OrderMapPreview = ({ initialLatitude, initialLongitude, address, onCoordinatesChange, onReset }) => {
  const webviewRef = useRef(null);
  const mapboxToken =
    Constants.expoConfig?.extra?.mapboxAccessToken ||
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const htmlContent = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8' />
  <meta name='viewport' content='initial-scale=1,maximum-scale=1,user-scalable=no' />
  <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
  <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111111; }
    #map { width: 100%; height: 100vh; }
    #map canvas { filter: brightness(0.72) saturate(0.9) contrast(1.05); }

    .mapboxgl-popup-content {
      background: rgba(24, 24, 24, 0.98) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 8px !important;
      color: #C6C6C6 !important;
      font-family: -apple-system, sans-serif;
      font-size: 12px;
      padding: 8px 12px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    }
    .mapboxgl-popup-tip { border-top-color: rgba(24, 24, 24, 0.98) !important; }
    .mapboxgl-ctrl-attrib { display: none !important; }
  </style>
</head>
<body>
  <div id='map'></div>
  <script>
    mapboxgl.accessToken = '${mapboxToken}';

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [${initialLongitude}, ${initialLatitude}],
      zoom: 17
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    let marker;

    map.on('load', function () {
      const el = document.createElement('div');
      el.style.cssText = [
        'width:36px',
        'height:44px',
        'background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2236%22 height=%2244%22 viewBox=%220 0 36 44%22%3E%3Cpath fill=%224c84af%22 d=%22M18 0C8 0 0 9 0 18c0 11 18 26 18 26S36 29 36 18C36 9 28 0 18 0z%22/%3E%3Ccircle cx=%2218%22 cy=%2218%22 r=%227%22 fill=%22white%22/%3E%3C/svg%3E")',
        'background-size:100%',
        'cursor:grab',
      ].join(';');

      const popup = new mapboxgl.Popup({ offset: 30, closeButton: false })
        .setHTML('<span style="color:#C6C6C6;font-weight:600">${(address || '').replace(/'/g, "\\'")}</span>');

      marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([${initialLongitude}, ${initialLatitude}])
        .setPopup(popup)
        .addTo(map);

      marker.togglePopup();

      marker.on('dragstart', () => { el.style.cursor = 'grabbing'; });

      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        const lngLat = marker.getLngLat();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'coordinates',
          lat: lngLat.lat,
          lon: lngLat.lng
        }));
      });
    });
  </script>
</body>
</html>
  `, [initialLatitude, initialLongitude, address, mapboxToken]);

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'coordinates' && onCoordinatesChange) {
        onCoordinatesChange(msg.lat, msg.lon);
      }
    } catch (_) {}
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Ionicons name="location-outline" size={16} color={theme.colors.primaryLight} />
        <Text style={styles.headerText}>Sijainti kartalla</Text>
        {onReset && (
          <TouchableOpacity onPress={onReset} style={styles.resetBtn}>
            <Ionicons name="refresh-outline" size={14} color="#A0A0A0" />
            <Text style={styles.resetText}>Palauta</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.dragHint}>Vedä nappia siirtääksesi sijaintia</Text>
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          source={{ html: htmlContent }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleMessage}
          originWhitelist={['*']}
        />
      </View>
      <Text style={styles.hint}>
        <Ionicons name="information-circle-outline" size={12} color={theme.colors.textMuted} />
        {' '}Osoite pysyy samana — vain tarkkaa sijaintia muutetaan
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.input,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerText: {
    flex: 1,
    color: '#C6C6C6',
    fontSize: 13,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  resetText: {
    color: '#A0A0A0',
    fontSize: 12,
  },
  dragHint: {
    color: '#A0A0A0',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  mapContainer: {
    height: 300,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});

export default OrderMapPreview;
