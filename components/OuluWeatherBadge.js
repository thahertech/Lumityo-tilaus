import React, { useCallback, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
import { useTheme } from '../ThemeContext';
import { getOuluDateKey, getOuluForecast } from '../utils/ouluWeather';

const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const WEATHER_COLOR = '#D6DDE2';

function forecastTime(time) {
  return new Date(time).toLocaleString('fi-FI', {
    timeZone: 'Europe/Helsinki', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function dayLabel(day, index) {
  if (index === 0) return 'Nyt';
  if (index === 1) return 'Huomenna';
  return new Date(day.date).toLocaleDateString('fi-FI', {
    timeZone: 'Europe/Helsinki', weekday: 'short', day: 'numeric', month: 'numeric',
  });
}

function clockTime(time) {
  return new Date(time).toLocaleTimeString('fi-FI', {
    timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit',
  });
}

export function useOuluForecast() {
  const [forecast, setForecast] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    let foreground = !AppState.currentState || AppState.currentState === 'active';
    let requestId = 0;
    let lastRefresh = 0;
    let lastDate;
    const refresh = async () => {
      if (!foreground) return;
      const request = ++requestId;
      lastRefresh = Date.now();
      lastDate = getOuluDateKey(lastRefresh);
      if (active) setForecast(null);
      try {
        const result = await getOuluForecast();
        if (active && foreground && request === requestId) setForecast(result);
      } catch (error) {
        console.error('Error loading Oulu weather forecast:', error);
        if (active && foreground && request === requestId) setForecast(null);
      }
    };
    refresh();
    const interval = setInterval(() => {
      const now = Date.now();
      if (now < lastRefresh || now - lastRefresh >= 30 * 60 * 1000 || getOuluDateKey(now) !== lastDate) refresh();
    }, 60 * 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      foreground = state === 'active';
      if (foreground) refresh();
      else {
        requestId += 1;
        if (active) setForecast(null);
      }
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, []));

  return forecast;
}

export default function OuluWeatherBadge({ forecast, compact = false, tight = false }) {
  const { theme } = useTheme();
  const [lastDayWidth, setLastDayWidth] = useState(0);
  const [lastLabelWidth, setLastLabelWidth] = useState(0);
  if (!forecast) return null;

  return (
    <View style={styles.widget}>
      <View style={[styles.headingRow, compact && styles.headingRowCompact]}>
        <View style={[styles.headingContainer, {
          backgroundColor: 'rgba(255, 255, 255, 0)',
          borderColor: 'rgba(255, 255, 255, 0)',
          marginLeft: Math.max(0, (lastDayWidth - lastLabelWidth) / 2.5),
        }]}>
          <Text style={[styles.foreground, styles.heading, compact && styles.headingCompact, tight && styles.headingTight]}>Oulu · sääennuste</Text>
        </View>
      </View>
      <View style={styles.days}>
        {forecast.days.map((day, index) => {
          const label = dayLabel(day, index);
          const snowHours = [...new Set(day.snowTimes.map(clockTime))];
          const showSnowIndicator = snowHours.length > 0 && !day.snow;
          const summary = day.time === null
            ? `Oulun sääennuste ${label.toLowerCase()}: lämpötilaennustetta ei ole saatavilla.`
            : `Oulun sääennuste ${forecastTime(day.time)}: ${day.temperature} astetta, ${day.description}.`;
          const details = `${summary}${snowHours.length ? ` Lumisadetta ennustetaan tunneille ${snowHours.join(', ')}.` : ''}`;
          const attribution = 'Lähde: Ilmatieteen laitos, avoin data. Lisenssi: CC BY 4.0.';
          const openDetails = () => Alert.alert('Oulun sääennuste', `${details}\n\n${attribution}`, [
            { text: 'Sulje', style: 'cancel' },
            {
              text: 'Lisenssi',
              onPress: () => Linking.openURL(LICENSE_URL).catch((error) => {
                console.error('Error opening weather license:', error);
                Alert.alert('Virhe', 'Lisenssin avaaminen epäonnistui.');
              }),
            },
          ]);
          return (
            <TouchableOpacity
              key={day.dateKey}
              style={[styles.badge, compact && styles.badgeCompact, tight && styles.badgeTight]}
              onPress={openDetails}
              accessibilityRole="button"
              accessibilityLabel={`${details} ${attribution} Näytä säätiedot ja lisenssi.`}
              activeOpacity={0.8}
              onLayout={index === forecast.days.length - 1
                ? ({ nativeEvent: { layout } }) => setLastDayWidth(layout.width)
                : undefined}
            >
              <Text style={[styles.foreground, styles.day, compact && styles.dayCompact, tight && styles.dayTight]}
                onLayout={index === forecast.days.length - 1
                  ? ({ nativeEvent: { layout } }) => setLastLabelWidth(layout.width)
                  : undefined}>{label}</Text>
              <View style={styles.row}>
                <Ionicons name={day.icon || 'help-circle-outline'} size={tight ? 14 : compact ? 18 : 23} color={WEATHER_COLOR} style={styles.foreground} />
                <Text style={[styles.foreground, styles.temperature, compact && styles.temperatureCompact, tight && styles.temperatureTight]}>
                  {day.temperature === null ? '–' : `${day.temperature}°`}
                </Text>
                {showSnowIndicator && <View style={styles.upcoming}>
                  <Text style={[styles.foreground, styles.plus, compact && styles.plusCompact, tight && styles.plusTight]}>+</Text>
                  <Ionicons name="snow-outline" size={tight ? 10 : compact ? 12 : 15} color={WEATHER_COLOR} style={styles.foreground} />
                </View>}
              </View>
              <Text style={[styles.foreground, styles.caption, compact && styles.captionCompact, tight && styles.captionTight]}>{day.time === null ? 'Ei tietoa' : `klo ${clockTime(day.time)}`}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: { width: '100%' },
  heading: { color: '#AEBAC4', fontFamily: fonts.regular, fontSize: 15 },
  headingCompact: { fontSize: 12 },
  headingTight: { fontSize: 11 },
  headingRow: { alignItems: 'flex-start' },
  headingRowCompact: { marginBottom: -2 },
  headingContainer: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  days: { flexDirection: 'row', alignItems: 'stretch' },
  badge: {
    flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 4, paddingHorizontal: 2,
    alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  badgeCompact: { minHeight: 38, paddingVertical: 1, borderRadius: 12 },
  badgeTight: { minHeight: 30, paddingVertical: 0, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  foreground: { textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  day: { color: WEATHER_COLOR, fontFamily: fonts.regular, fontSize: 16 },
  dayCompact: { fontSize: 13 },
  dayTight: { fontSize: 11 },
  temperature: { color: WEATHER_COLOR, fontFamily: fonts.semibold, fontSize: 22 },
  temperatureCompact: { fontSize: 17 },
  temperatureTight: { fontSize: 14 },
  caption: { color: '#C4CDD4', fontFamily: fonts.regular, fontSize: 13 },
  captionCompact: { fontSize: 10 },
  captionTight: { fontSize: 8 },
  upcoming: { flexDirection: 'row', alignItems: 'center' },
  plus: { color: WEATHER_COLOR, fontFamily: fonts.semibold, fontSize: 14 },
  plusCompact: { fontSize: 11 },
  plusTight: { fontSize: 9 },
});
