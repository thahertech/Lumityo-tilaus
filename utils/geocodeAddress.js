import Constants from 'expo-constants';

const REQUEST_TIMEOUT_MS = 4000;

const isValidCoordinate = (lat, lon) =>
  Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
  Number.isFinite(lon) && lon >= -180 && lon <= 180;

const fetchJson = async (url) => {
  const controller = new AbortController();
  let timeout;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Geocoding request failed with status ${response.status}`);
        }
        return response.json();
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Geocoding request timed out'));
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

export const geocodeAddress = async (address) => {
  const query = address?.trim();
  if (!query) {
    console.warn('Cannot geocode an empty address');
    return { lat: null, lon: null };
  }

  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    Constants.expoConfig?.extra?.mapboxAccessToken;
  const opencageKey = process.env.EXPO_PUBLIC_OPENCAGE_API_KEY ||
    Constants.expoConfig?.extra?.opencageApiKey;

  if (mapboxToken) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(mapboxToken)}&country=fi&types=address&language=fi&limit=1`;
      const data = await fetchJson(url);
      const [lon, lat] = data.features?.[0]?.center || [];
      if (isValidCoordinate(lat, lon)) return { lat, lon };
      console.warn('Mapbox returned no valid address coordinates');
    } catch (error) {
      console.warn('Mapbox geocoding failed:', error.message);
    }
  } else {
    console.warn('Mapbox token not configured; cannot geocode with Mapbox');
  }

  if (opencageKey) {
    try {
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${encodeURIComponent(opencageKey)}&countrycode=fi&language=fi&limit=1&no_annotations=1`;
      const data = await fetchJson(url);
      const lat = data.results?.[0]?.geometry?.lat;
      const lon = data.results?.[0]?.geometry?.lng;
      if (data.status?.code === 200 && isValidCoordinate(lat, lon)) return { lat, lon };
      console.warn('OpenCage returned no valid address coordinates');
    } catch (error) {
      console.warn('OpenCage geocoding failed:', error.message);
    }
  } else {
    console.warn('OpenCage API key not configured; cannot geocode with OpenCage');
  }

  return { lat: null, lon: null };
};
