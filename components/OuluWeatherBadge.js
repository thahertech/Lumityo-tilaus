import React, { useCallback, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../theme';
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

export default function OuluWeatherBadge({ forecast }) {
  if (!forecast) return null;

  return (
    <View style={styles.widget}>
      <Text style={[styles.foreground, styles.heading]}>Oulu · sääennuste</Text>
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
              style={styles.badge}
              onPress={openDetails}
              accessibilityRole="button"
              accessibilityLabel={`${details} ${attribution} Näytä säätiedot ja lisenssi.`}
              activeOpacity={0.8}
            >
              <Text style={[styles.foreground, styles.day]}>{label}</Text>
              <View style={styles.row}>
                <Ionicons name={day.icon || 'help-circle-outline'} size={23} color={WEATHER_COLOR} style={styles.foreground} />
                <Text style={[styles.foreground, styles.temperature]}>
                  {day.temperature === null ? '–' : `${day.temperature}°`}
                </Text>
                {showSnowIndicator && <View style={styles.upcoming}>
                  <Text style={[styles.foreground, styles.plus]}>+</Text>
                  <Ionicons name="snow-outline" size={15} color={WEATHER_COLOR} style={styles.foreground} />
                </View>}
              </View>
              <Text style={[styles.foreground, styles.caption]}>{day.time === null ? 'Ei tietoa' : `klo ${clockTime(day.time)}`}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: { width: '100%' },
  heading: { color: '#C4CDD4', fontFamily: fonts.regular, fontSize: 15, paddingHorizontal: 4 },
  days: { flexDirection: 'row', alignItems: 'stretch' },
  badge: {
    flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 4, paddingHorizontal: 2,
    alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  foreground: { textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  day: { color: WEATHER_COLOR, fontFamily: fonts.regular, fontSize: 16 },
  temperature: { color: WEATHER_COLOR, fontFamily: fonts.semibold, fontSize: 22 },
  caption: { color: '#C4CDD4', fontFamily: fonts.regular, fontSize: 13 },
  upcoming: { flexDirection: 'row', alignItems: 'center' },
  plus: { color: WEATHER_COLOR, fontFamily: fonts.semibold, fontSize: 14 },
});
