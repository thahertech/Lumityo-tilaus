import { Platform } from 'react-native';
import * as Location from 'expo-location';

export class CurrentAddressError extends Error {}

async function withTimeout(promise, timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new CurrentAddressError('Sijainnin haku kesti liian kauan. Tarkista sijaintipalvelut tai syötä osoite käsin.')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCurrentAddress(isCurrent = () => true) {
  const checkCurrent = () => {
    if (!isCurrent()) throw new Error('Location request cancelled');
  };
  if (Platform.OS === 'web') {
    throw new CurrentAddressError('Sijainnin osoitehaku on käytettävissä mobiilisovelluksessa. Syötä osoite käsin.');
  }

  const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 30000);
  checkCurrent();
  if (!permission.granted) {
    throw new CurrentAddressError('Salli sijainnin käyttö laitteen asetuksissa tai syötä osoite käsin.');
  }
  const servicesEnabled = await withTimeout(Location.hasServicesEnabledAsync(), 5000);
  checkCurrent();
  if (!servicesEnabled) {
    throw new CurrentAddressError('Ota laitteen sijaintipalvelut käyttöön tai syötä osoite käsin.');
  }

  let position = null;
  try {
    position = await withTimeout(Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 50 }), 2000);
  } catch (error) {
    console.warn('Tallennettua sijaintia ei voitu hakea, yritetään hakea nykyinen sijainti.');
  }
  checkCurrent();
  if (position) {
    const age = Date.now() - position.timestamp;
    const accuracy = position.coords?.accuracy;
    if (!Number.isFinite(age) || age < 0 || age > 60000 ||
        !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 50) {
      position = null;
    }
  }
  if (!position) {
    position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 15000);
  }
  checkCurrent();
  const { coords } = position;
  const { latitude, longitude } = coords;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new CurrentAddressError('Sijaintia ei voitu määrittää. Syötä osoite käsin.');
  }

  const results = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), 10000);
  checkCurrent();
  const match = results.find((result) => result.street?.trim() && result.streetNumber?.trim() && result.city?.trim());
  if (!match) {
    throw new CurrentAddressError('Tarkkaa katuosoitetta ei löytynyt. Syötä osoite käsin.');
  }

  const street = `${match.street.trim()} ${match.streetNumber.trim()}`;
  const locality = [match.postalCode?.trim(), match.city.trim()].filter(Boolean).join(' ');
  return { address: `${street}, ${locality}`, coordinates: { latitude, longitude } };
}
