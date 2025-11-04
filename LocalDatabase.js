import * as SQLite from 'expo-sqlite';
import { syncOrderToSupabase } from './SupabaseSync';
import { getDeviceId } from './FreeOrderUtils';

const DB_NAME = 'lumityo_local.db';

const openDB = async () => {
  return SQLite.openDatabaseAsync(DB_NAME);
};

export const initializeDatabase = async () => {
  try {
    const db = await openDB();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER,
        service_type TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        price_estimate TEXT,
        is_recurring BOOLEAN DEFAULT 0,
        recurring_frequency TEXT,
        coordinates TEXT,
        info TEXT,
        work_started_at DATETIME,
        device_id TEXT,
        is_free_order BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (profile_id) REFERENCES user_profiles (id)
      );
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS order_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER,
        continuous_order BOOLEAN DEFAULT 0,
        preferred_service TEXT DEFAULT 'Lumityö',
        special_instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES user_profiles (id)
      );
    `);
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return false;
  }
};

export const createUserProfile = async (profileData) => {
  try {
    const db = await openDB();
    const { name, phone, address, email = null } = profileData;
    const result = await db.runAsync(
      `INSERT INTO user_profiles (name, phone, address, email, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name, phone, address, email]
    );
    return { success: true, profileId: result.lastInsertRowId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const createOrder = async (orderData) => {
  try {
    const db = await openDB();
    const { profileId, serviceType, address, phone, name, priceEstimate = null, coordinates = null, info = null, isRecurring = false, isFreeOrder = false } = orderData;
    
    // Use the isRecurring flag from OrderScreen to determine if this is a jatkuva_tilaus
    const isJatkuvaTilaus = isRecurring;
    
    // Get device ID for tracking
    const deviceId = await getDeviceId();
    
    // Get user's email from profile for Supabase sync
    let userEmail = null;
    try {
      const profile = await getUserProfile();
      userEmail = profile?.email || null;
    } catch (error) {
      console.warn('Could not fetch user email for order sync:', error);
    }
    
    // Debug logging
    console.log('🔍 Order Creation:', {
      profileId,
      serviceType,
      isJatkuvaTilaus,
      isRecurring,
      isFreeOrder,
      deviceId
    });
    
    // Save order locally first
    const result = await db.runAsync(
      `INSERT INTO orders (profile_id, service_type, address, phone, name, price_estimate, coordinates, info, device_id, is_free_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [profileId, serviceType, address, phone, name, priceEstimate, coordinates ? JSON.stringify(coordinates) : null, info, deviceId, isFreeOrder ? 1 : 0]
    );
    
    // Sync to Supabase for MapApp
    const supabaseSync = await syncOrderToSupabase({
      serviceType,
      address,
      phone,
      name,
      email: userEmail, // Include user's email from profile
      priceEstimate,
      coordinates, // Pass coordinates to Supabase sync
      info, // Pass additional information to Supabase sync
      isJatkuvaTilaus, // Pass subscription flag to Supabase sync
      deviceId, // Pass device ID to Supabase
      isFreeOrder // Pass free order flag to Supabase
    });
    
    if (!supabaseSync.success) {
      console.warn('⚠️ Order saved locally but failed to sync to Supabase:', supabaseSync.error);
    }
    
    return { success: true, orderId: result.lastInsertRowId, supabaseSync };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getOrders = async (profileId = null) => {
  try {
    const db = await openDB();
    let query = 'SELECT * FROM orders';
    let params = [];
    if (profileId) {
      query += ' WHERE profile_id = ?';
      params.push(profileId);
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.getAllAsync(query, params);
    return result;
  } catch (error) {
    return [];
  }
};

export const getUserProfile = async (profileId = null) => {
  try {
    const db = await openDB();
    let result;
    if (profileId) {
      result = await db.getAllAsync('SELECT * FROM user_profiles WHERE id = ?', [profileId]);
    } else {
      result = await db.getAllAsync('SELECT * FROM user_profiles ORDER BY updated_at DESC LIMIT 1');
    }
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    return null;
  }
};

export const updateUserProfile = async (profileId, profileData) => {
  try {
    const db = await openDB();
    const { name, phone, address, email } = profileData;
    await db.runAsync(
      `UPDATE user_profiles SET name = ?, phone = ?, address = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, phone, address, email, profileId]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const saveOrderSettings = async (profileId, settings) => {
  try {
    const db = await openDB();
    const { continuousOrder, preferredService, specialInstructions } = settings;
    
    // Debug logging
    console.log('💾 Saving Order Settings:', {
      profileId,
      continuousOrder,
      preferredService,
      specialInstructions
    });
    
    const existing = await db.getAllAsync('SELECT id FROM order_settings WHERE profile_id = ?', [profileId]);
    
    if (existing.length > 0) {
      await db.runAsync(
        `UPDATE order_settings SET continuous_order = ?, preferred_service = ?, special_instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE profile_id = ?`,
        [continuousOrder ? 1 : 0, preferredService, specialInstructions, profileId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO order_settings (profile_id, continuous_order, preferred_service, special_instructions) VALUES (?, ?, ?, ?)`,
        [profileId, continuousOrder ? 1 : 0, preferredService, specialInstructions]
      );
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getOrderSettings = async (profileId) => {
  try {
    const db = await openDB();
    const result = await db.getAllAsync('SELECT * FROM order_settings WHERE profile_id = ?', [profileId]);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    return null;
  }
};

// Create or remove continuous order when jatkuva tilaus is toggled
export const manageContinuousOrder = async (profileId, isEnabled) => {
  try {
    const db = await openDB();
    
    // Get user profile to validate required data
    const profile = await getUserProfile();
    if (!profile || !profile.name || !profile.address || !profile.phone) {
      return { 
        success: false, 
        error: 'Täytä ensin kaikki yhteystiedot (nimi, osoite, puhelinnumero)' 
      };
    }

    if (isEnabled) {
      // Check if user already has a continuous order
      const existingResult = await db.getFirstAsync(
        `SELECT * FROM orders WHERE profile_id = ? AND service_type LIKE '%Jatkuva tilaus%'`,
        [profileId]
      );

      if (existingResult) {
        console.log('🔄 Continuous order already exists, no need to create new one');
        return { success: true, message: 'Jatkuva tilaus jo olemassa' };
      }

      // Create continuous order
      const orderData = {
        profileId: profileId,
        serviceType: 'Lumityö - Jatkuva tilaus',
        address: profile.address,
        phone: profile.phone,
        name: profile.name,
        priceEstimate: '10-20€',
        coordinates: null,
        info: 'Automaattinen jatkuva tilaus - aktivoitu asetuksista. Suoritetaan tarpeen mukaan.'
      };

      // Create order locally and sync to Supabase with jatkuva_tilaus flag
      const orderResult = await createContinuousOrder(orderData, true);
      return orderResult;
      
    } else {
      // Remove continuous order(s)
      await db.runAsync(
        `DELETE FROM orders WHERE profile_id = ? AND service_type LIKE '%Jatkuva tilaus%'`,
        [profileId]
      );

      // Also remove from Supabase
      await removeContinuousOrderFromSupabase(profile.name, profile.address, profile.phone);
      
      return { success: true, message: 'Jatkuva tilaus poistettu' };
    }
    
  } catch (error) {
    console.error('Error managing continuous order:', error);
    return { success: false, error: error.message };
  }
};

// Create continuous order (similar to createOrder but specifically for jatkuva tilaus)
const createContinuousOrder = async (orderData, isJatkuvaTilaus = true) => {
  try {
    const db = await openDB();
    const { profileId, serviceType, address, phone, name, priceEstimate, coordinates, info } = orderData;
    
    // Get user's email from profile for Supabase sync
    let userEmail = null;
    try {
      const profile = await getUserProfile();
      userEmail = profile?.email || null;
    } catch (error) {
      console.warn('Could not fetch user email for continuous order sync:', error);
    }
    
    // Debug logging
    console.log('🔄 Creating continuous order:', {
      profileId,
      serviceType,
      isJatkuvaTilaus,
      hasEmail: !!userEmail
    });
    
    // Save order locally first
    const result = await db.runAsync(
      `INSERT INTO orders (profile_id, service_type, address, phone, name, price_estimate) VALUES (?, ?, ?, ?, ?, ?)`,
      [profileId, serviceType, address, phone, name, priceEstimate]
    );
    
    // Sync to Supabase for MapApp with jatkuva_tilaus flag
    const supabaseSync = await syncOrderToSupabase({
      serviceType,
      address,
      phone,
      name,
      email: userEmail, // Include user's email from profile
      priceEstimate,
      coordinates,
      info,
      isJatkuvaTilaus // This will be true for continuous orders
    });
    
    if (!supabaseSync.success) {
      console.warn('⚠️ Continuous order saved locally but failed to sync to Supabase:', supabaseSync.error);
    }
    
    return { success: true, orderId: result.lastInsertRowId, supabaseSync };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Remove continuous order from Supabase
const removeContinuousOrderFromSupabase = async (name, address, phone) => {
  try {
    const deleteUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/snow_orders?name=eq.${encodeURIComponent(name)}&address=eq.${encodeURIComponent(address)}&phone=eq.${encodeURIComponent(phone)}&jatkuva_tilaus=eq.true`;
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ Continuous order removed from Supabase');
    } else {
      console.warn('⚠️ Failed to remove continuous order from Supabase');
    }
  } catch (error) {
    console.error('❌ Error removing continuous order from Supabase:', error);
  }
};

export const getAllOrders = async () => {
  try {
    const db = await openDB();
    const result = await db.getAllAsync(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    return result;
  } catch (error) {
    console.error('❌ Error getting all orders:', error);
    return [];
  }
};

export const getOrdersByDeviceId = async (deviceId) => {
  try {
    const db = await openDB();
    const result = await db.getAllAsync(
      'SELECT * FROM orders WHERE device_id = ? ORDER BY created_at DESC',
      [deviceId]
    );
    return result;
  } catch (error) {
    console.error('❌ Error getting orders by device ID:', error);
    return [];
  }
};

// Convert the most recent order to jatkuva tilaus and enable the setting
export const convertLatestOrderToJatkuva = async (profileId) => {
  try {
    const db = await openDB();
    
    // Get the most recent order for this profile
    const latestOrder = await db.getFirstAsync(
      `SELECT * FROM orders WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1`,
      [profileId]
    );
    
    if (latestOrder && latestOrder.service_type === 'Lumityö') {
      console.log('🔄 Converting latest order to jatkuva tilaus:', latestOrder.id);
      
      // Enable jatkuva tilaus setting for the user
      await saveOrderSettings(profileId, {
        continuousOrder: true,
        preferredService: 'Lumityö',
        specialInstructions: null
      });
      
      // Update the order with jatkuva tilaus flag (in local tracking)
      // The actual jatkuva tilaus sync to Supabase will happen through the existing sync process
      console.log('✅ Latest order converted to jatkuva tilaus and settings enabled');
      
      // Get user's email for Supabase sync
      let userEmail = null;
      try {
        const profile = await getUserProfile();
        userEmail = profile?.email || null;
      } catch (error) {
        console.warn('Could not fetch user email for jatkuva tilaus conversion:', error);
      }

      // Re-sync the order to Supabase with jatkuva tilaus flag
      const supabaseSync = await syncOrderToSupabase({
        serviceType: latestOrder.service_type,
        address: latestOrder.address,
        phone: latestOrder.phone,
        name: latestOrder.name,
        email: userEmail, // Include user's email from profile
        priceEstimate: latestOrder.price_estimate,
        coordinates: latestOrder.coordinates ? JSON.parse(latestOrder.coordinates) : null,
        info: latestOrder.info,
        isJatkuvaTilaus: true, // Mark as jatkuva tilaus
        deviceId: latestOrder.device_id,
        isFreeOrder: latestOrder.is_free_order === 1
      });
      
      return { success: true, orderId: latestOrder.id };
    } else {
      console.log('❌ No suitable order found to convert to jatkuva tilaus');
      return { success: false, error: 'No Lumityö order found' };
    }
    
  } catch (error) {
    console.error('❌ Error converting order to jatkuva tilaus:', error);
    return { success: false, error: error.message };
  }
};

export const clearLocalDatabase = async () => {
  try {
    const db = await openDB();
    
    // Drop all tables
    await db.execAsync('DROP TABLE IF EXISTS user_profiles;');
    await db.execAsync('DROP TABLE IF EXISTS orders;');
    await db.execAsync('DROP TABLE IF EXISTS order_settings;');
    
    console.log('✅ Local database cleared successfully');
    
    // Reinitialize the database with empty tables
    await initializeDatabase();
    console.log('✅ Database reinitialized');
    
  } catch (error) {
    console.error('❌ Error clearing local database:', error);
    throw error;
  }
};
