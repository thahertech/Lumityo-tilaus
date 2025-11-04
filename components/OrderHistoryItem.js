import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';
import { theme } from '../theme';

const OrderHistoryItem = ({ item }) => {
  // Convert status to user-friendly Finnish text with icons
  const getStatusIcon = (status) => {
    switch (status) {
      case 'odottaa': return 'time-outline';
      case 'kuitattu': return 'checkmark-circle-outline';
      case 'kesken': return 'build-outline';
      default: return 'document-outline';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'odottaa': return 'Odottaa';
      case 'kuitattu': return 'Valmis';
      case 'kesken': return 'Työn alla';
      default: return status;
    }
  };

  // Get status color - using blue variations only
  const getStatusColor = (status) => {
    switch (status) {
      case 'odottaa': return theme.colors.primaryLight; // Dark blue for waiting
      case 'kuitattu': return theme.colors.primaryLight; // Main blue for completed
      case 'kesken': return theme.colors.primaryLight; // Light blue for in progress
      default: return theme.colors.textMuted; // Gray for unknown
    }
  };

  return (
    <View style={styles.modernOrderItem}>
      <View style={styles.orderItemHeader}>
        <Ionicons name="snow-outline" size={20} color={theme.colors.textLight} />
        <Text style={styles.orderItemTitle}>{item.service_type}</Text>
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
        {item.price_estimate && (
          <View style={styles.orderItemRow}>
            <Ionicons name="card-outline" size={16} color="#636363ff" />
            <Text style={styles.orderItemText}>{item.price_estimate}</Text>
          </View>
        )}
        {item.is_free_order === 1 && (
          <View style={styles.orderItemRow}>
            <Ionicons name="gift-outline" size={16} color="#e74c3c" />
            <Text style={[styles.orderItemText, { color: '#e74c3c', fontWeight: 'bold' }]}>
           
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default OrderHistoryItem;