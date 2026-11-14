import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import createSharedStyles from '../styles';
import { useTheme } from '../ThemeContext';

const OrderHistoryItem = ({ item }) => {
  const { theme } = useTheme();
  const styles = createSharedStyles(theme);
  const localStyles = createLocalStyles(theme);
  // Convert status to user-friendly Finnish text with icons
  const getStatusIcon = (status) => {
    switch (status) {
      case 'odottaa':
      case 'pending': return 'time-outline';
      case 'kuitattu':
      case 'completed': return 'checkmark-circle-outline';
      case 'kesken':
      case 'in-progress': return 'build-outline';
      case 'peruttu':
      case 'cancelled': return 'close-circle-outline';
      default: return 'document-outline';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'odottaa':
      case 'pending': return 'Odottaa';
      case 'kuitattu':
      case 'completed': return 'Valmis';
      case 'kesken':
      case 'in-progress': return 'Työn alla';
      case 'peruttu':
      case 'cancelled': return 'Peruttu';
      default: return status;
    }
  };

  // Status colors supplement the text and icon labels.
  const getStatusColor = (status) => {
    switch (status) {
      case 'odottaa':
      case 'pending': return theme.colors.warning;
      case 'kuitattu':
      case 'completed': return theme.colors.success;
      case 'kesken':
      case 'in-progress': return theme.colors.info;
      case 'peruttu':
      case 'cancelled': return theme.colors.error;
      default: return theme.colors.textMuted; // Gray for unknown
    }
  };

  return (
    <View style={[styles.modernOrderItem, localStyles.order]}>
      <View style={localStyles.header}>
        <View style={localStyles.titleGroup}>
          <Ionicons name={item.palvelu === 'Polanteen poisto' ? 'construct-outline' : 'snow-outline'} size={21} color={theme.colors.textLight} />
          <Text style={styles.orderItemTitle}>{item.palvelu}</Text>
        </View>
        <View style={localStyles.status}>
          <Ionicons name={getStatusIcon(item.status)} size={16} color={getStatusColor(item.status)} />
          <Text style={[localStyles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      <View style={[styles.orderItemContent, localStyles.details]}>
        <View style={localStyles.detailRow}>
          <Ionicons name="location-outline" size={17} color={theme.colors.textSecondary} />
          <Text style={styles.orderItemText}>{item.address}</Text>
        </View>
        <View style={localStyles.metadata}>
          <View style={localStyles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={localStyles.metaText}>{new Date(item.created_at).toLocaleDateString('fi-FI')}</Text>
          </View>
          {item.price != null && item.price !== '' && (
            <View style={localStyles.metaItem}>
              <Ionicons name="card-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={localStyles.priceText}>{item.price}</Text>
            </View>
          )}
          {(item.is_free_order === true || item.is_free_order === 1) && (
            <View style={localStyles.metaItem}>
              <Ionicons name="gift-outline" size={16} color={theme.colors.success} />
              <Text style={[localStyles.metaText, { color: theme.colors.success, fontFamily: theme.fonts.semibold }]}>
                Ilmainen tilaus
              </Text>
            </View>
          )}
        </View>
        {(item.info || item.notes) && (
          <View style={localStyles.detailRow}>
            <Ionicons name="chatbox-outline" size={17} color={theme.colors.textSecondary} />
            <Text style={[styles.orderItemText, localStyles.noteText]}>
              {item.info || item.notes}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const createLocalStyles = (theme) => StyleSheet.create({
  order: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  statusText: {
    ...theme.typography.bodySmall,
    fontFamily: theme.fonts.semibold,
    flexShrink: 1,
  },
  details: {
    paddingTop: 8,
    gap: 7,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 14,
    rowGap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  metaText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    flexShrink: 1,
  },
  priceText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.semibold,
    flexShrink: 1,
  },
  noteText: {
    fontFamily: theme.fonts.italic,
  },
});

export default OrderHistoryItem;
