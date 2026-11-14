import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader, { SCREEN_TOP_SPACING, screenLayout } from '../components/ScreenHeader';
import React, { useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceId } from '../FreeOrderUtils';
import { getOrdersByDevice } from '../SupabaseAPI';
import OrderHistoryItem from '../components/OrderHistoryItem';
import { useTheme } from '../ThemeContext';

const OrderHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const localStyles = createLocalStyles(theme);
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const requestId = useRef(0);

  useFocusEffect(
    React.useCallback(() => {
      loadOrders();
      return () => { requestId.current += 1; };
    }, [])
  );

  const loadOrders = async (isRefresh = false) => {
    const request = ++requestId.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const fetchedOrders = await getOrdersByDevice(deviceId, { throwOnError: true });
      if (request !== requestId.current) return;
      setOrders(fetchedOrders);
      setLoadError(false);
    } catch (error) {
      console.error('Error loading orders:', error);
      if (request === requestId.current) setLoadError(true);
    } finally {
      if (request === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const renderItem = ({ item }) => (
    <OrderHistoryItem item={item} />
  );

  const ErrorState = () => (
    <View style={localStyles.emptyContainer} accessibilityLiveRegion="polite">
      <Text style={localStyles.emptyTitle}>Tilauksia ei voitu ladata</Text>
      <Text style={localStyles.emptyText}>Tarkista verkkoyhteys ja yritä uudelleen.</Text>
      <TouchableOpacity style={localStyles.emptyAction} onPress={() => loadOrders()} accessibilityRole="button">
        <Text style={localStyles.emptyActionText}>Yritä uudelleen</Text>
      </TouchableOpacity>
    </View>
  );

  const EmptyState = () => (
    <View style={localStyles.emptyContainer}>
      <Ionicons name="snow-outline" size={56} color={theme.colors.accent} />
      <Text style={localStyles.emptyTitle}>Ei tilauksia</Text>
      <Text style={localStyles.emptyText}>Sinulla ei ole vielä yhtään tilausta.</Text>
      <TouchableOpacity style={localStyles.emptyAction} onPress={() => navigation.navigate('Tilaus')} accessibilityRole="button">
        <Text style={localStyles.emptyActionText}>Tee ensimmäinen tilauksesi</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={localStyles.container}>
      <View style={[screenLayout.content, localStyles.headerContainer, { paddingTop: insets.top + SCREEN_TOP_SPACING }]}>
        <ScreenHeader title="Omat tilaukset" subtitle="Seuraa tilaustesi etenemistä"
          action={<TouchableOpacity accessibilityRole="button" accessibilityLabel="Päivitä tilaukset" style={localStyles.refreshButton} onPress={() => loadOrders(true)}>
            <Ionicons name="refresh-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>} />
      </View>

      <View style={localStyles.listContainer}>
        <FlatList
          data={orders}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id ? item.id.toString() : `order-${index}`}
          contentContainerStyle={localStyles.listContent}
          style={{ width: '100%' }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadOrders(true)}
            />
          }
          ListHeaderComponent={loadError && orders.length > 0 ? <ErrorState /> : null}
          ListEmptyComponent={loading || refreshing
            ? <View style={localStyles.emptyContainer}><ActivityIndicator color={theme.colors.accent} /><Text style={localStyles.emptyText}>Ladataan tilauksia...</Text></View>
            : loadError ? <ErrorState /> : <EmptyState />}
        />
      </View>

      <View style={localStyles.bottomLabelContainer}>
        <Text style={localStyles.bottomLabel}>Tilaushistoria on laitekohtainen</Text>
      </View>
    </View>
  );
};

const createLocalStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  listContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  refreshButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  headerContainer: {
    paddingBottom: 0,
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
    fontFamily: theme.fonts.medium,
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
    gap: 8,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  emptyAction: {
    minHeight: 54,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    ...theme.typography.button,
    color: theme.colors.onPrimary,
    textAlign: 'center',
  },
  bottomLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,

  },
  bottomLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default OrderHistoryScreen;
