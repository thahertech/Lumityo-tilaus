import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Supabase configuration - SECURE: using environment variables only
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 
                     Constants.expoConfig?.extra?.supabaseUrl;

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                          Constants.expoConfig?.extra?.supabaseAnonKey;

// Only create client if we have real credentials
let supabase = null;
const hasValidCredentials = SUPABASE_URL && SUPABASE_URL.includes('supabase.co') && 
                           SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 50;

if (hasValidCredentials) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (__DEV__) {
    console.log('✅ Supabase client initialized');
  }
} else {
  if (__DEV__) {
    console.warn('⚠️ Supabase credentials not configured');
  }
}

/**
 * Geocode an address to get latitude and longitude
 * @param {string} address - Address to geocode
 * @returns {Object} - {lat, lon} or {lat: null, lon: null} if failed
 */
const geocodeAddress = async (address) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_OPENCAGE_API_KEY || 
                   Constants.expoConfig?.extra?.opencageApiKey;
    
    if (!apiKey) {
      console.warn('⚠️ OpenCage API key not configured');
      return { lat: null, lon: null };
    }
    
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}&limit=1`;
    
    if (__DEV__) {
      console.log(`🗺️ Geocoding address: ${address}`);
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status.code === 200 && data.results.length > 0) {
      const result = data.results[0];
      const lat = result.geometry.lat;
      const lon = result.geometry.lng;
      
      console.log(`✅ Geocoded successfully: ${lat}, ${lon}`);
      return { lat, lon };
    } else {
      console.warn(`❌ Geocoding failed for address: ${address}`);
      return { lat: null, lon: null };
    }
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return { lat: null, lon: null };
  }
};

/**
 * Sync a local order to Supabase database for MapApp consumption
 * @param {Object} orderData - Order data to sync
 * @returns {Object} - Success/error response
 */
export const syncOrderToSupabase = async (orderData) => {
  if (!supabase) {
    console.warn('⚠️ Supabase not configured - order saved locally only');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { serviceType, address, phone, name, priceEstimate, coordinates, info, isJatkuvaTilaus = false, deviceId, isFreeOrder = false, email = null } = orderData;
    
    console.log(`🚀 Syncing order to Supabase for: ${name} at ${address}`);
    if (isJatkuvaTilaus) {
      console.log('♻️ This is a Jatkuva Tilaus (subscription) order');
    }
    if (isFreeOrder) {
      console.log('🎉 This is a free order!');
    }
    
    let lat = null;
    let lon = null;
    
    // Use provided coordinates if available, otherwise geocode the address
    if (coordinates && coordinates.latitude && coordinates.longitude) {
      lat = coordinates.latitude;
      lon = coordinates.longitude;
      console.log(`📍 Using provided coordinates: lat=${lat}, lon=${lon}`);
    } else {
      console.log(`🗺️ No coordinates provided, geocoding address...`);
      const geocoded = await geocodeAddress(address);
      lat = geocoded.lat;
      lon = geocoded.lon;
    }
    
    // Prepare data for Supabase (similar to map-app pins structure)
    const supabaseOrder = {
      name: name,
      address: address,
      phone: phone,
      email: email, // User's email from profile if provided
      palvelu: serviceType, // Using 'palvelu' to match map-app structure
      price: priceEstimate || null,
      status: 'odottaa', // Default status for new orders
      info: info || null, // Additional information from the order form
      jatkuva_tilaus: isJatkuvaTilaus, // Simple subscription flag
      device_id: deviceId || null, // Device tracking for free orders
      is_free_order: isFreeOrder || false, // Free order flag
      created_at: new Date().toISOString(),
      lat: lat, // Coordinates from selection or geocoding
      lon: lon  // Coordinates from selection or geocoding
    };

    console.log(`📍 Final order coordinates: lat=${lat}, lon=${lon}`);

    const { data, error } = await supabase
      .from('snow_orders') // You'll need to create this table in Supabase
      .insert([supabaseOrder])
      .select();

    if (error) {
      console.error('❌ Error syncing order to Supabase:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Order synced to Supabase:', data[0]);
    return { success: true, supabaseOrder: data[0] };
  } catch (error) {
    console.error('❌ Network error syncing to Supabase:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all orders from Supabase (for MapApp)
 * @returns {Array} - Array of orders
 */
export const getOrdersFromSupabase = async () => {
  if (!supabase) {
    console.warn('⚠️ Supabase not configured');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('snow_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching orders from Supabase:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Network error fetching from Supabase:', error);
    return [];
  }
};

/**
 * Update order status in Supabase
 * @param {string} orderId - Supabase order ID
 * @param {string} status - New status
 * @returns {Object} - Success/error response
 */
export const updateOrderStatusInSupabase = async (orderId, status) => {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('snow_orders')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select();

    if (error) {
      console.error('❌ Error updating order status in Supabase:', error);
      return { success: false, error: error.message };
    }

    return { success: true, updatedOrder: data[0] };
  } catch (error) {
    console.error('❌ Network error updating Supabase:', error);
    return { success: false, error: error.message };
  }
};

export default supabase;