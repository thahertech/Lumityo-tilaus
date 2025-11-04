import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_ORDER_KEY = 'has_claimed_free_order';

/**
 * Get unique device identifier
 */
export const getDeviceId = async () => {
  try {
    // Try to get Android ID or iOS identifier
    let deviceId = Application.androidId || await Application.getIosIdForVendorAsync();
    
    if (!deviceId) {
      // Generate a UUID and store it persistently
      deviceId = await AsyncStorage.getItem('generated_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('generated_device_id', deviceId);
      }
    }
    
    console.log('📱 Device ID:', deviceId);
    return deviceId;
  } catch (error) {
    console.error('❌ Error getting device ID:', error);
    // Generate fallback ID
    const fallbackId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    return fallbackId;
  }
};

/**
 * Check if user is eligible for free first order (simplified - just check if any orders exist)
 */
export const isEligibleForFreeOrder = async () => {
  try {
    // Import here to avoid circular dependency
    const { getAllOrders } = await import('./LocalDatabase');
    
    // Check local database for any previous orders
    const previousOrders = await getAllOrders();
    
    if (previousOrders && previousOrders.length > 0) {
      console.log('🚫 Previous orders found:', previousOrders.length);
      return false;
    }
    
    console.log('✅ Eligible for free order - no previous orders!');
    return true;
  } catch (error) {
    console.error('❌ Error checking free order eligibility:', error);
    // In case of error, default to not eligible to avoid abuse
    return false;
  }
};

/**
 * Mark free order as claimed
 */
export const markFreeOrderClaimed = async () => {
  try {
    await AsyncStorage.setItem(FREE_ORDER_KEY, 'true');
    console.log('✅ Free order marked as claimed');
  } catch (error) {
    console.error('❌ Error marking free order as claimed:', error);
  }
};

/**
 * Reset free order eligibility (for testing purposes only)
 */
export const resetFreeOrderEligibility = async () => {
  try {
    await AsyncStorage.removeItem(FREE_ORDER_KEY);
    await AsyncStorage.removeItem('generated_device_id');
    console.log('🔄 Free order eligibility reset');
  } catch (error) {
    console.error('❌ Error resetting free order eligibility:', error);
  }
};