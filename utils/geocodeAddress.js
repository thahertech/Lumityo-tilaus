import Constants from 'expo-constants';

export const geocodeAddress = async (address) => {
  const query = address?.trim();
  if (!query) {
    return { lat: null, lon: null };
  }

  const apiKey = process.env.EXPO_PUBLIC_OPENCAGE_API_KEY ||
    Constants.expoConfig?.extra?.opencageApiKey;

  if (!apiKey) {
    console.warn('OpenCage API key not configured; cannot geocode address');
    return { lat: null, lon: null };
  }

  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenCage request failed with status ${response.status}`);
    }

    const data = await response.json();
    const result = data.results?.[0];
    const lat = result?.geometry?.lat;
    const lon = result?.geometry?.lng;

    if (data.status?.code !== 200 || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn(`OpenCage could not geocode address: ${query}`);
      return { lat: null, lon: null };
    }

    if (__DEV__) {
      console.log(`Geocoded address successfully: ${lat}, ${lon}`);
    }

    return { lat, lon };
  } catch (error) {
    console.error('Address geocoding failed:', error);
    return { lat: null, lon: null };
  }
};
