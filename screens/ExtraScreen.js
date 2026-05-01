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
        <Text style={localStyles.emptySubtext}>Tee ensimmäinen tilauksesi etusivulta!</Text>
      </View>
    </View>
  );

  return (
    <View style={localStyles.container}>
      <Image source={heroImage} style={styles.headerImage} resizeMode="cover" />
      
      <View style={styles.overlay} />
      
      <View style={localStyles.headerContainer}>
        <View style={styles.profileHeader}>
          <Ionicons name="receipt-outline" size={32} color="#fff" />
          <Text style={styles.profileHeaderText}>Tilaushistoria</Text>
        </View>
        <View style={localStyles.headerStats}>
          <View style={localStyles.buttonContainer}>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={styles.refreshButtonText}>Päivitä</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={localStyles.listContainer}>
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id ? item.id.toString() : `order-${index}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 140 }}
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
  },
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
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
    paddingHorizontal: 16,
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
    padding: theme.spacing.xxl,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    minWidth: 300,
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
    bottom: 80,
  },
  bottomLabel: {
    ...theme.typography.body,
    fontWeight: '400',
    color: theme.colors.textLight,
    textAlign: 'center',
  },
});

export default OrderHistoryScreen;