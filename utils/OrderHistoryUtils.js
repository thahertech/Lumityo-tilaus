/**
 * Load order history with Supabase status synchronization
 * This function fetches local orders and syncs their status with Supabase
 */

export const loadOrderHistoryWithSync = async (profileId, getOrders) => {
  try {
    const localOrders = await getOrders(profileId);
    console.log('📱 Local orders found:', localOrders.length);
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🔐 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length || 0
    });
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Missing Supabase credentials, using local orders only');
      return localOrders;
    }
    
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
        
        // Match orders by Supabase ID first (most reliable), then fall back to other criteria
        const updatedOrders = localOrders.map(localOrder => {
          let matchingOrder = null;
          
          // Method 1: Match by Supabase ID (most reliable)
          if (localOrder.supabase_id) {
            matchingOrder = supabaseOrders.find(so => so.id === localOrder.supabase_id);
            if (matchingOrder) {
              console.log(`✅ Status sync (by ID): ${localOrder.service_type} - ${matchingOrder.status}`);
            }
          }
          
          // Method 2: Match by user details, service type, and approximate time (fallback for old orders)
          if (!matchingOrder) {
            const localServiceType = localOrder.service_type || '';
            const localTime = new Date(localOrder.created_at).getTime();
            
            matchingOrder = supabaseOrders.find(supabaseOrder => {
              const supabaseServiceType = supabaseOrder.palvelu || supabaseOrder.service_type || '';
              
              // Match by user details and service type
              const nameMatch = supabaseOrder.name?.toLowerCase() === localOrder.name?.toLowerCase();
              const addressMatch = supabaseOrder.address?.toLowerCase() === localOrder.address?.toLowerCase();
              const phoneMatch = supabaseOrder.phone === localOrder.phone;
              const userMatches = nameMatch && addressMatch && phoneMatch;
              
              const serviceMatches = supabaseServiceType === localServiceType;
              
              // Check if timestamps are within 24 hours (to handle timezone differences)
              const supabaseTime = new Date(supabaseOrder.created_at).getTime();
              const timeDiff = Math.abs(localTime - supabaseTime);
              const timeMatches = timeDiff < 86400000; // 24 hours tolerance
              
              return userMatches && serviceMatches && timeMatches;
            });
            
            if (matchingOrder) {
              console.log(`✅ Status sync (by criteria): ${localOrder.service_type} - ${matchingOrder.status}`);
            }
          }
          
          if (matchingOrder) {
            return {
              ...localOrder,
              status: matchingOrder.status,
              supabase_id: matchingOrder.id // Store the ID if we didn't have it
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