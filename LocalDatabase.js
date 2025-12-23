import * as SQLite from 'expo-sqlite';
import { syncOrderToSupabase } from './SupabaseSync';
import { getDeviceId } from './FreeOrderUtils';

const DB_NAME = 'lumityo_local.db';

let dbInstance = null;

const openDB = async () => {
  try {
    if (dbInstance) {
      return dbInstance;
    }
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    return dbInstance;
  } catch (error) {
    console.error('❌ Error opening database:', error);
    // Retry once
    try {
      dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
      return dbInstance;
    } catch (retryError) {
      console.error('❌ Database retry failed:', retryError);
      throw retryError;
    }
  }
};

export const initializeDatabase = async () => {
  try {
    console.log('📂 Initializing database...');
    const db = await openDB();
    console.log('✅ Database opened successfully');
    
    // Execute all table creation in a single transaction for reliability
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
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
        supabase_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (profile_id) REFERENCES user_profiles (id)
      );
      
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
    
    // If it's a column exists error, that's actually OK - database is already set up
    if (error.message && error.message.includes('duplicate column')) {
      console.log('ℹ️ Database already initialized with latest schema');
      return true;
    }
    
    return false;
  }
};

export const createUserProfile = async (profileData) => {
  try {
    // Ensure DB is initialized before creating profile (CRITICAL for Android)
    await initializeDatabase();
    
    const db = await openDB();
    const { name, phone, address, email = null } = profileData;
    
    console.log('📝 Creating user profile:', { name, phone, address, hasEmail: !!email });
    
    const result = await db.runAsync(
      `INSERT INTO user_profiles (name, phone, address, email, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name, phone, address, email]
    );
    
    console.log('✅ Profile created successfully, ID:', result.lastInsertRowId);
    return { success: true, profileId: result.lastInsertRowId };
  } catch (error) {
    console.error('❌ Error creating user profile:', error);
    return { success: false, error: error.message || 'Database error' };
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
    } else if (supabaseSync.supabaseOrder?.id) {
      // Store Supabase ID in local database for reliable matching
      try {
        await db.runAsync(
          'UPDATE orders SET supabase_id = ? WHERE id = ?',
          [supabaseSync.supabaseOrder.id, result.lastInsertRowId]
        );
        console.log(`✅ Stored Supabase ID ${supabaseSync.supabaseOrder.id} for local order ${result.lastInsertRowId}`);
      } catch (updateError) {
        console.warn('⚠️ Failed to store Supabase ID:', updateError);
      }
    }
    
    return { success: true, orderId: result.lastInsertRowId, supabaseSync };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getOrders = async (profileId = null) => {
  try {
    await initializeDatabase(); // Ensure DB is initialized
    const db = await openDB();
    let query = 'SELECT * FROM orders';
    let params = [];
    if (profileId) {
      query += ' WHERE profile_id = ?';
      params.push(profileId);
    }
    query += ' ORDER BY created_at DESC';
    console.log('📊 Fetching orders with query:', query, 'params:', params);
    const result = await db.getAllAsync(query, params);
    console.log(`📊 Found ${result.length} orders`);
    return result;
  } catch (error) {
    console.error('❌ Error getting orders:', error);
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
    const profile = await getUserProfile(profileId);
    console.log('👤 Profile for continuous order:', { 
      hasProfile: !!profile, 
      name: profile?.name,
      address: profile?.address,
      phone: profile?.phone 
    });
    
    if (!profile || !profile.name || !profile.address || !profile.phone) {
      console.error('❌ Missing profile data:', { 
        profile: !!profile,
        name: profile?.name || 'missing',
        address: profile?.address || 'missing',
        phone: profile?.phone || 'missing'
      });
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
        // Still save the setting to ensure it's recorded
        await saveOrderSettings(profileId, {
          continuousOrder: true,
          preferredService: 'Lumityö',
          specialInstructions: null
        });
        return { success: true, message: 'Jatkuva tilaus jo olemassa' };
      }

      // Save the enabled setting
      await saveOrderSettings(profileId, {
        continuousOrder: true,
        preferredService: 'Lumityö',
        specialInstructions: null
      });

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
      // Save the disabled setting FIRST
      await saveOrderSettings(profileId, {
        continuousOrder: false,
        preferredService: 'Lumityö',
        specialInstructions: null
      });
      
      // Get the jatkuva tilaus order to find its supabase_id
      const jatkuvaOrder = await db.getFirstAsync(
        `SELECT * FROM orders WHERE profile_id = ? AND service_type LIKE '%Jatkuva tilaus%'`,
        [profileId]
      );
      
      // Remove continuous order(s) from local DB
      await db.runAsync(
        `DELETE FROM orders WHERE profile_id = ? AND service_type LIKE '%Jatkuva tilaus%'`,
        [profileId]
      );

      // Mark as cancelled in Supabase using supabase_id if available
      if (jatkuvaOrder?.supabase_id) {
        console.log(`🔄 Cancelling jatkuva tilaus in Supabase (ID: ${jatkuvaOrder.supabase_id})`);
        await updateContinuousOrderInSupabaseById(jatkuvaOrder.supabase_id, false);
      } else {
        // Fallback to matching by user details (for old orders without supabase_id)
        console.log('⚠️ No supabase_id found, using fallback matching');
        await updateContinuousOrderInSupabase(profile.name, profile.address, profile.phone, false);
      }
      
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
    
    // Get device ID for tracking
    const deviceId = await getDeviceId();
    
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
      hasEmail: !!userEmail,
      deviceId
    });
    
    // Save order locally first with device_id
    const result = await db.runAsync(
      `INSERT INTO orders (profile_id, service_type, address, phone, name, price_estimate, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [profileId, serviceType, address, phone, name, priceEstimate, deviceId]
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
      isJatkuvaTilaus, // This will be true for continuous orders
      deviceId // Include device_id in sync
    });
    
    if (!supabaseSync.success) {
      console.warn('⚠️ Continuous order saved locally but failed to sync to Supabase:', supabaseSync.error);
    } else if (supabaseSync.supabaseOrder?.id) {
      // CRITICAL: Store Supabase ID in local database for reliable status matching
      try {
        await db.runAsync(
          'UPDATE orders SET supabase_id = ? WHERE id = ?',
          [supabaseSync.supabaseOrder.id, result.lastInsertRowId]
        );
        console.log(`✅ Stored Supabase ID ${supabaseSync.supabaseOrder.id} for continuous order ${result.lastInsertRowId}`);
      } catch (updateError) {
        console.warn('⚠️ Failed to store Supabase ID for continuous order:', updateError);
      }
    }
    
    return { success: true, orderId: result.lastInsertRowId, supabaseSync };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Update continuous order in Supabase by ID (preferred method)
const updateContinuousOrderInSupabaseById = async (supabaseId, isActive) => {
  try {
    const { updateOrderStatusInSupabase } = await import('./SupabaseSync');
    
    // Update both status and jatkuva_tilaus flag
    const updateUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/snow_orders?id=eq.${supabaseId}`;
    
    const updateData = {
      jatkuva_tilaus: isActive,
      status: isActive ? 'odottaa' : 'peruttu',
      updated_at: new Date().toISOString()
    };
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      console.log(`✅ Continuous order (ID: ${supabaseId}) ${isActive ? 'activated' : 'cancelled'} in Supabase`);
    } else {
      const errorText = await response.text();
      console.warn('⚠️ Failed to update continuous order in Supabase:', errorText);
    }
  } catch (error) {
    console.error('❌ Error updating continuous order by ID in Supabase:', error);
  }
};

// Update continuous order in Supabase (mark as cancelled or active) - FALLBACK METHOD
const updateContinuousOrderInSupabase = async (name, address, phone, isActive) => {
  try {
    const updateUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/snow_orders?name=eq.${encodeURIComponent(name)}&address=eq.${encodeURIComponent(address)}&phone=eq.${encodeURIComponent(phone)}&palvelu=eq.${encodeURIComponent('Lumityö - Jatkuva tilaus')}`;
    
    const updateData = {
      jatkuva_tilaus: isActive,
      status: isActive ? 'odottaa' : 'peruttu'
    };
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      console.log(`✅ Continuous order ${isActive ? 'activated' : 'cancelled'} in Supabase`);
    } else {
      const errorText = await response.text();
      console.warn('⚠️ Failed to update continuous order in Supabase:', errorText);
    }
  } catch (error) {
    console.error('❌ Error updating continuous order in Supabase:', error);
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
