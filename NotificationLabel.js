import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Try to import supabase, but handle if it's not available
let supabase = null;
try {
  const supabaseModule = require('./supabaseClient');
  supabase = supabaseModule.supabase || supabaseModule.default;
  console.log('NotificationLabel: Supabase client loaded successfully:', !!supabase);
  console.log('NotificationLabel: Supabase methods available:', {
    from: typeof supabase?.from,
    channel: typeof supabase?.channel
  });
} catch (error) {
  console.warn('NotificationLabel: Supabase not available, notifications disabled:', error.message);
}

export default function NotificationLabel() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!supabase) {
      console.warn('NotificationLabel: Supabase client not available, skipping notifications');
      return;
    }

    fetchNotifications();
    
    // Subscribe to real-time updates only if supabase is available
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('Notification change:', payload);
        fetchNotifications();
      })
      .subscribe();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const fetchNotifications = async () => {
    if (!supabase) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      // Filter by date range
      const now = new Date();
      const activeNotifications = data?.filter(notification => {
        const startDate = new Date(notification.start_date);
        const endDate = notification.end_date ? new Date(notification.end_date) : null;
        
        return startDate <= now && (!endDate || endDate > now);
      }) || [];

      setNotifications(activeNotifications);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  // Show highest priority notification as simple text
  const notification = notifications[0];

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        <Text style={styles.notificationText}>
          {notification.message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    top: 80,
    width: '100%',
    backgroundColor: '#00000064',
    zIndex: 1000,
    paddingVertical: 10,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  notificationText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});