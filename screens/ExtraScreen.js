import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceId } from '../FreeOrderUtils';
import { getOrdersByDevice } from '../SupabaseAPI';
import OrderHistoryItem from '../components/OrderHistoryItem';
import heroImage from '../assets/Mountains.jpg';
import styles from '../styles';
import { theme } from '../theme';

const OrderHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {      
      const deviceId = await getDeviceId();
      
      // Fetch orders directly from Supabase
      const fetchedOrders = await getOrdersByDevice(deviceId);
      
      setOrders(fetchedOrders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };



  const renderItem = ({ item }) => (
    <OrderHistoryItem item={item} />
  );

  const EmptyState = () => (
    <View style={localStyles.emptyContainer}>
      <View style={localStyles.emptyCard}>
        <Ionicons name="snow-outline" size={64} color={theme.colors.primary} />
        <Text style={localStyles.emptyTitle}>Ei tilauksia</Text>
        <Text style={localStyles.emptyText}>Sinulla ei ole vielä yhtään tilausta.</Text>
        <Text style={localStyles.emptySubtext}>Tee ensimmäinen tilauksesi Tilaa-välilehdeltä.</Text>
      </View>
    </View>
  );

  return (
    <View style={localStyles.container}>
      <Image source={heroImage} style={styles.headerImage} resizeMode="cover" />
      
      <View style={styles.overlay} />
      
      <View style={[localStyles.headerContainer, { paddingTop: insets.top + 24 }]}>
        <ScreenHeader eyebrow="OMAT TILAUKSET" title="Tilaushistoria" subtitle="Seuraa tilaustesi etenemistä."
          action={<TouchableOpacity accessibilityLabel="Päivitä tilaukset" style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={theme.colors.primaryLight} />
          </TouchableOpacity>} />
      </View>

      <View style={localStyles.listContainer}>
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id ? item.id.toString() : `order-${index}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 0, paddingBottom: 24 }}
          style={{ width: '100%' }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          ListEmptyComponent={<EmptyState />}
        />
      </View>

      <View style={localStyles.bottomLabelContainer}>
        <Text style={localStyles.bottomLabel}>Tilaushistoria on laitekohtainen</Text>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  listContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 0,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    zIndex: 1,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.8)', // Red background for danger
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    fontWeight: '500',
    textShadowColor: theme.colors.overlay,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 32,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.lg,
  },
  emptyTitle: {
    ...theme.typography.h2,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderColor: theme.colors.glassBorder,

  },
  bottomLabel: {
    ...theme.typography.body,
    fontWeight: '400',
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default OrderHistoryScreen;
