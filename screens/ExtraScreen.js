import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image } from 'react-native';
import { createTable, getOrders } from '../DB';
import heroImage from '../assets/Mountains.jpg';

const OrderHistoryScreen = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const setupDatabase = async () => {
      await createTable();
      const fetchedOrders = await getOrders();
      setOrders(fetchedOrders);
    };
    setupDatabase();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.orderItem}>
      <Text style={styles.orderText}>Päivämäärä: {new Date(item.date).toLocaleDateString('fi-FI')}</Text>
      <Text style={styles.orderText}>Palvelu: {item.service}</Text>
      <Text style={styles.orderText}>Osoite: {item.address}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Image source={heroImage} style={styles.headerImage} resizeMode="cover" />
      
      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
      />

      <View style={styles.bottomLabelContainer}>
        <Text style={styles.bottomLabel}>Tilaushistoria on laitekohtainen</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
  },
  orderItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginVertical: 8,
    borderRadius: 5,
    elevation: 3,
    margin: 15,
  },
  orderText: {
    fontSize: 16,
    fontFamily: 'Sans',
    fontWeight: '200',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bottomLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: 'grey',
    borderTopWidth: 1,
    opacity: 0.7,
    borderColor: '#ccc',
    bottom: 40,
  },
  bottomLabel: {
    fontSize: 16,
    opacity: 1,
    fontWeight: '300',
    color: '#fff',
  },
});

export default OrderHistoryScreen;
