import * as SQLite from 'expo-sqlite';

const openDB = async () => {
  return SQLite.openDatabaseAsync('orders.db');
};

export const createTable = async () => {
  try {
    const db = await openDB();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        firstName TEXT, 
        phoneNumber TEXT, 
        address TEXT, 
        service TEXT, 
        date TEXT
      );
    `);
    console.log('Table created successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  }
};

export const addOrder = async (firstName, phoneNumber, address, service) => {
  try {
    const db = await openDB();
    const date = new Date().toISOString();
    const result = await db.runAsync(
      'INSERT INTO orders (firstName, phoneNumber, address, service, date) VALUES (?, ?, ?, ?, ?)', 
      [firstName, phoneNumber, address, service, date]
    );
    console.log('Order ID:', result.lastInsertRowId);
  } catch (error) {
    console.error('Error adding order:', error);
  }
};

export const getOrders = async () => {
  try {
    const db = await openDB();
    const allOrders = await db.getAllAsync('SELECT * FROM orders');
    return allOrders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};
