import * as Application from 'expo-application';
import { Linking, Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier || 'com.senseitechh.Lumiwork';
const PACKAGE_ID = Constants.expoConfig?.android?.package || 'com.senseitechh.Lumiwork';

export async function checkAppVersion() {
  try {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching version info:', error);
      return { canContinue: false, type: null, updateUrl: null };
    }

    if (!data) {
      return { canContinue: true, type: null, updateUrl: null };
    }

    const result = compareVersions(CURRENT_VERSION, data.minimum_version, data.latest_version);
    
    return {
      canContinue: result.isAcceptable,
      type: result.updateType,
      updateUrl: result.updateUrl,
      message: result.message,
      minimumVersion: data.minimum_version,
      latestVersion: data.latest_version,
    };
  } catch (error) {
    console.error('Version check failed:', error);
    return { canContinue: false, type: null, updateUrl: null };
  }
}

function compareVersions(currentStr, minimumStr, latestStr) {
  const current = parseVersion(currentStr);
  const minimum = parseVersion(minimumStr);
  const latest = parseVersion(latestStr);

  const isBelowMinimum = isVersionBelow(current, minimum);
  const isBelowLatest = isVersionBelow(current, latest);

  if (isBelowMinimum) {
    return {
      isAcceptable: false,
      updateType: 'mandatory',
      updateUrl: getUpdateUrl(),
      message: `Versio ${minimumStr} vaaditaan. Päivitä sovellus jatkaaksesi.`,
    };
  }

  if (isBelowLatest) {
    return {
      isAcceptable: true,
      updateType: 'optional',
      updateUrl: getUpdateUrl(),
      message: `Päivitys versioon ${latestStr} on saatavilla.`,
    };
  }

  return {
    isAcceptable: true,
    updateType: null,
    updateUrl: null,
    message: null,
  };
}

function parseVersion(versionStr) {
  const parts = versionStr.split('.').map(p => parseInt(p, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

function isVersionBelow(current, target) {
  if (current.major !== target.major) return current.major < target.major;
  if (current.minor !== target.minor) return current.minor < target.minor;
  return current.patch < target.patch;
}

function getUpdateUrl() {
  if (Platform.OS === 'ios') {
    return 'https://apps.apple.com/fi/app/lumityöt/id6670366973';
  }
  if (Platform.OS === 'android') {
    return 'https://play.google.com/store/apps/details?id=com.senseitechh.Lumiwork';
  }
  return null;
}

export function openUpdatePage(updateUrl) {
  if (!updateUrl) return;
  Linking.openURL(updateUrl).catch((error) => {
    console.error('Error opening update URL:', error);
    Alert.alert('Error', 'Could not open app store.');
  });
}
