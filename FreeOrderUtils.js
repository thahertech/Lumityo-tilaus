import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const FREE_ORDER_KEY = 'has_claimed_free_order';

/**
 * Get unique device identifier
 */
export const getDeviceId = async () => {
  try {
    let deviceId = null;
    
    // Platform-specific device ID retrieval
    if (Platform.OS === 'android') {
      deviceId = Application.androidId;
    } else if (Platform.OS === 'ios') {
      deviceId = await Application.getIosIdForVendorAsync();
    }
    
    // If no platform-specific ID, use or generate a persistent one
    if (!deviceId) {
      deviceId = await AsyncStorage.getItem('generated_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('generated_device_id', deviceId);
        console.log('📱 Generated new device ID:', deviceId);
      } else {
        console.log('📱 Using stored device ID:', deviceId);
      }
    } else {
      console.log('📱 Platform device ID:', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('❌ Error getting device ID:', error);
    // Generate and store fallback ID
    try {
      let fallbackId = await AsyncStorage.getItem('generated_device_id');
      if (!fallbackId) {
        fallbackId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('generated_device_id', fallbackId);
      }
      console.log('📱 Using fallback device ID:', fallbackId);
      return fallbackId;
    } catch (storageError) {
      // Last resort - generate temporary ID
      const tempId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      console.warn('⚠️ Using temporary device ID:', tempId);
      return tempId;
    }
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