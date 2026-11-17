// Script to clear app local storage
const { resetFreeOrderEligibility } = require('./FreeOrderUtils');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function clearAll() {
  try {
    await resetFreeOrderEligibility();
    await AsyncStorage.clear();
  } catch (error) {
    console.error('Error clearing local storage:', error);
  }
}

clearAll();
