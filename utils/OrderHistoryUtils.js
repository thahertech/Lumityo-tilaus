/**
 * Load order history with Supabase status synchronization
 * This function fetches local orders and syncs their status with Supabase
 */

export const loadOrderHistoryWithSync = async (profileId, getOrders) => {
  try {
    // Get local orders
    const localOrders = await getOrders(profileId);
    console.log('📱 Local orders found:', localOrders.length);
    
    // Check environment variables with fallback
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xdfjznsmzarzqxfgeogt.supabase.co';
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZmp6bnNtemFyenF4Zmdlb2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3OTI5NDMsImV4cCI6MjA3MzM2ODk0M30.7mX_tGMfM0RN1lxf1catgjOPc9TFSOsIQWHTVBMQy94';
    
    console.log('🔐 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length || 0
    });
    
    // Return local orders if no environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Missing Supabase credentials, using local orders only');
      return localOrders;
    }
    
    // Fetch updated statuses from Supabase
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/snow_orders`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const supabaseOrders = await response.json();
        console.log('📊 Fetched Supabase orders for status sync:', supabaseOrders.length);
        
        // Create a lookup map of Supabase orders by matching criteria
        const supabaseOrderMap = new Map();
        supabaseOrders.forEach(order => {
          // Create a unique key based on name, address, and phone
          const key = `${order.name}-${order.address}-${order.phone}`.toLowerCase();
          supabaseOrderMap.set(key, order);
        });
        
        // Update local orders with Supabase statuses
        const updatedOrders = localOrders.map(localOrder => {
          const key = `${localOrder.name}-${localOrder.address}-${localOrder.phone}`.toLowerCase();
          const supabaseOrder = supabaseOrderMap.get(key);
          
          if (supabaseOrder) {
            console.log(`✅ Status sync: ${localOrder.service_type} - ${supabaseOrder.status}`);
            return {
              ...localOrder,
              status: supabaseOrder.status, // Update status from Supabase
              supabase_id: supabaseOrder.id
            };
          }
          
          return localOrder;
        });
        
        return updatedOrders;
      } else {
        console.warn('⚠️ Failed to fetch Supabase orders, using local only');
        return localOrders;
      }
    } catch (supabaseError) {
      console.warn('⚠️ Supabase sync failed, using local orders only:', supabaseError);
      return localOrders;
    }
  } catch (error) {
    console.error('❌ Error loading order history:', error);
    return [];
  }
};