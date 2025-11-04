import React, { useEffect } from 'react';
import AppNavigator from './Navigation/AppNavigator';
import { initializeDatabase } from './LocalDatabase';

export default function App() {
  useEffect(() => {
    // Initialize the database when app starts
    const initDB = async () => {
      try {
        const success = await initializeDatabase();
        if (success) {
          console.log('✅');
        } else {
          console.error('❌');
        }
      } catch (error) {
        console.error('❌', error);
      }
    };
    
    initDB();
  }, []);

  return <AppNavigator />;
}