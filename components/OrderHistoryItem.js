import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';
import { theme } from '../theme';

const OrderHistoryItem = ({ item }) => {
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

  // Get status color - using blue variations only
  const getStatusColor = (status) => {
    switch (status) {
      case 'odottaa':
      case 'pending': return theme.colors.primaryLight; // Dark blue for waiting
      case 'kuitattu':
      case 'completed': return theme.colors.primaryLight; // Main blue for completed
      case 'kesken':
      case 'in-progress': return theme.colors.primaryLight; // Light blue for in progress
      case 'peruttu':
      case 'cancelled': return theme.colors.textMuted; // Gray for cancelled
      default: return theme.colors.textMuted; // Gray for unknown
    }
  };

  return (
    <View style={styles.modernOrderItem}>
      <View style={styles.orderItemHeader}>
        <Ionicons name="snow-outline" size={20} color={theme.colors.textLight} />
        <Text style={styles.orderItemTitle}>{item.palvelu}</Text>
      </View>
      <View style={styles.orderItemContent}>
        <View style={styles.orderItemRow}>
          <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.orderItemText}>{item.address}</Text>
        </View>
        <View style={styles.orderItemRow}>
          <Ionicons name={getStatusIcon(item.status)} size={16} color={getStatusColor(item.status)} />
          <Text style={[styles.orderItemText, { color: getStatusColor(item.status), fontWeight: 'bold' }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
        <View style={styles.orderItemRow}>
          <Ionicons name="calendar-outline" size={16} color="#ccc" />
          <Text style={styles.orderItemText}>{new Date(item.created_at).toLocaleDateString('fi-FI')}</Text>
        </View>
        {item.price && (
          <View style={styles.orderItemRow}>
            <Ionicons name="card-outline" size={16} color="#636363ff" />
            <Text style={styles.orderItemText}>{item.price}</Text>
          </View>
        )}
        {item.is_free_order === 1 && (
          <View style={styles.orderItemRow}>
            <Ionicons name="gift-outline" size={16} color="#e74c3c" />
            <Text style={[styles.orderItemText, { color: '#e74c3c', fontWeight: 'bold' }]}>
              Ilmainen tilaus
            </Text>
          </View>
        )}
        {item.notes && (
          <View style={styles.orderItemRow}>
            <Ionicons name="chatbox-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.orderItemText, { color: theme.colors.textLight, fontStyle: 'italic' }]}>
              {item.notes}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default OrderHistoryItem;