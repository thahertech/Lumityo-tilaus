import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { geocodeAddress } from './utils/geocodeAddress';

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
} else if (__DEV__) {
  console.warn('⚠️ Supabase credentials not configured');
}

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
    

    let lat = null;
    let lon = null;
    
    // Use provided coordinates if available, otherwise geocode the address
    if (Number.isFinite(coordinates?.latitude) && Number.isFinite(coordinates?.longitude)) {
      lat = coordinates.latitude;
      lon = coordinates.longitude;
    } else {
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
      hidden_from_map: isJatkuvaTilaus ? true : false, // Hide new jatkuva_tilaus until Kierros valmis is clicked
      created_at: new Date().toISOString(),
      lat: lat, // Coordinates from selection or geocoding
      lon: lon  // Coordinates from selection or geocoding
    };
    const { data, error } = await supabase
      .from('snow_orders') // You'll need to create this table in Supabase
      .insert([supabaseOrder])
      .select();

    if (error) {
      console.error('❌ Error syncing order to Supabase:', error);
      return { success: false, error: error.message };
    }
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