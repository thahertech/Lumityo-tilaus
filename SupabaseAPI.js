/**
 * Supabase API - Single source of truth for all data
 * No local SQLite for orders - all orders stored in Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Create or update user profile
 */
export const upsertUserProfile = async (deviceId, profileData) => {
  try {
    const { name, phone, address, email } = profileData;
    
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        device_id: deviceId,
        name,
        phone,
        address,
        email: email || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ User profile saved:', data);
    return { success: true, profile: data };
  } catch (error) {
    console.error('❌ Error saving profile:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user profile by device ID
 */
export const getUserProfile = async (deviceId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    return null;
  }
};

/**
 * Create snow order - single source of truth
 */
export const createSnowOrder = async (deviceId, orderData) => {
  try {
    const {
      serviceType,
      address,
      phone,
      name,
      priceEstimate,
      coordinates,
      info,
      isRecurring,
      isFreeOrder
    } = orderData;

    const { data, error } = await supabase
      .from('snow_orders')
      .insert({
        device_id: deviceId,
        palvelu: serviceType,
        address,
        phone,
        name,
        price: priceEstimate,
        lat: coordinates?.latitude || null,
        lon: coordinates?.longitude || null,
        info: info || null,
        jatkuva_tilaus: isRecurring || false,
        is_free_order: isFreeOrder || false,
        status: 'odottaa', // Default status for new orders
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, order: data };
  } catch (error) {
    console.error('❌ Error creating order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all orders for device
 */
export const getOrdersByDevice = async (deviceId) => {
  try {
    const { data, error } = await supabase
      .from('snow_orders')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    return [];
  }
};

/**
 * Save jatkuva tilaus preference by creating/updating a special order
 * This creates a "Lumityö - Jatkuva tilaus" order that acts as the preference
 */
export const saveOrderSettings = async (deviceId, settings) => {
  try {
    const { continuousOrder } = settings;
    
    if (continuousOrder) {
      // Enable jatkuva tilaus: Check if already exists
      const { data: existing, error: fetchError } = await supabase
        .from('snow_orders')
        .select('id')
        .eq('device_id', deviceId)
        .eq('jatkuva_tilaus', true)
        .limit(1);

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (existing && existing.length > 0) {
        return { success: true };
      }

      // Create jatkuva tilaus order (this acts as the "setting")
      // Get user profile to populate order details
      const profile = await getUserProfile(deviceId);
      if (!profile) {
        return { success: false, error: 'User profile not found' };
      }

      // Get coordinates from profile address if available
      let lat = null;
      let lon = null;
      
      // Try to fetch coordinates from Mapbox if we have an address
      if (profile.address) {
        try {
          const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(profile.address)}.json?access_token=${mapboxToken}&limit=1`
          );
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            lon = data.features[0].center[0];
            lat = data.features[0].center[1];
          }
        } catch (geoError) {
          console.warn('⚠️ Could not fetch coordinates:', geoError);
        }
      }

      const { data, error } = await supabase
        .from('snow_orders')
        .insert({
          device_id: deviceId,
          palvelu: 'Jatkuva lumityö',
          address: profile.address,
          phone: profile.phone,
          name: profile.name,
          price: '10-20€',
          lat: lat,
          lon: lon,
          jatkuva_tilaus: true,
          status: 'odottaa',
          info: 'Jatkuva tilaus - Automaattinen lumityöpalvelu'
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, order: data };
    } else {
      // Disable jatkuva tilaus: Update status to 'peruttu' instead of deleting
      const { data, error } = await supabase
        .from('snow_orders')
        .update({ 
          status: 'peruttu',
          jatkuva_tilaus: false
        })
        .eq('device_id', deviceId)
        .eq('jatkuva_tilaus', true)
        .select();

      if (error) throw error;

      return { success: true, cancelledCount: data?.length || 0 };
    }
  } catch (error) {
    console.error('❌ Error saving jatkuva tilaus:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get jatkuva tilaus preference for device
 * Returns true if device has any jatkuva tilaus order
 */
export const getOrderSettings = async (deviceId) => {
  try {
    const { data, error } = await supabase
      .from('snow_orders')
      .select('id')
      .eq('device_id', deviceId)
      .eq('jatkuva_tilaus', true)
      .neq('status', 'peruttu') // Exclude cancelled orders
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return settings-like object for compatibility
    return data && data.length > 0 ? { continuous_order: true } : null;
  } catch (error) {
    console.error('❌ Error fetching jatkuva tilaus:', error);
    return null;
  }
};

/**
 * Check if device has already claimed free order
 */
export const hasClaimedFreeOrder = async (deviceId) => {
  try {
    const { data, error } = await supabase
      .from('snow_orders')
      .select('id')
      .eq('device_id', deviceId)
      .eq('is_free_order', true)
      .limit(1);

    if (error) throw error;

    return data && data.length > 0;
  } catch (error) {
    console.error('❌ Error checking free order:', error);
    return false;
  }
};

export default supabase;
