import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getUserProfile, getOrderSettings } from './LocalDatabase';

export default function JatkuvaTilausStatus() {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkJatkuvaTilausStatus();
  }, []);

  const checkJatkuvaTilausStatus = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        const settings = await getOrderSettings(profile.id);
        setIsActive(settings?.continuous_order === 1);
      }
    } catch (error) {
      console.error('Error checking Jatkuva Tilaus status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isActive) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
         Jatkuvatilaus
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 60, // Below status bar and header, above notification area
    left: 20,
    backgroundColor: 'rgba(37, 37, 37, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#212121ff',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(214, 214, 214, 0.85)',
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});