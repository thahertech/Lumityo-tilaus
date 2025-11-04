import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, ScrollView, KeyboardAvoidingView, Platform, Image, StatusBar, Modal } from 'react-native';
import emailjs from 'emailjs-com';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';
import { theme, createButtonStyle, createCardStyle } from '../theme';
import AddressAutocompleteMapboxNew from '../components/AddressAutocompleteMapboxNew';
import bgImage from '../assets/Mountains.jpg';
import { 
  initializeDatabase, 
  getUserProfile, 
  updateUserProfile, 
  createUserProfile,
  getOrders,
  getOrderSettings,
  saveOrderSettings,
  convertLatestOrderToJatkuva
} from '../LocalDatabase';
import { syncOrderToSupabase } from '../SupabaseSync';

const OmatTiedotScreen = ({ route }) => {
  const navigation = useNavigation();
  
  // User details state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Profile and order state
  const [userProfile, setUserProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  
  // Continuous order state
  const [continuousOrder, setContinuousOrder] = useState(false);
  const [continuousOrderInfo, setContinuousOrderInfo] = useState('');
  const [showContinuousOrderInfo, setShowContinuousOrderInfo] = useState(true);

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // Edit mode and saving state
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved user data on component mount
  useEffect(() => {
    initDatabase();
  }, []);

  // Show success message if user converted order to jatkuva tilaus
  useEffect(() => {
    if (route?.params?.jatkuvaTilaasEnabled) {
      setTimeout(() => {
        Alert.alert(
          'Jatkuva tilaus aktivoitu!',
          'Edellinen tilauksesi on muutettu jatkuvaksi tilaukseksi. Jatkuva tilaus -asetus on nyt käytössä.',
          [{ text: 'Selvä!' }]
        );
      }, 1000); // Small delay to ensure UI has loaded
    }
  }, [route?.params?.jatkuvaTilaasEnabled]);

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const initDatabase = async () => {
    await initializeDatabase();
    await loadUserData();
    await loadOrderHistory();
  };

  const loadUserData = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        setUserProfile(profile);
        setName(profile.name || '');
        setAddress(profile.address || '');
        setPhone(profile.phone || '');
        setEmail(profile.email || '');
        
        // Set edit mode based on whether user has complete required data
        const hasCompleteData = profile.name && profile.address && profile.phone;
        setIsEditMode(!hasCompleteData);
        
        // Load order settings
        const settings = await getOrderSettings(profile.id);
        if (settings) {
          setContinuousOrder(settings.continuous_order === 1);
        }
      } else {
        // No profile exists, start in edit mode
        setIsEditMode(true);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleContinuousOrderToggle = async (value) => {
    // Validate required fields before enabling
    if (value && (!name.trim() || !address.trim() || !phone.trim())) {
      Alert.alert(
        'Puutteelliset tiedot',
        'Jatkuva tilaus vaatii seuraavat tiedot:\n\n• Nimi\n• Osoite\n• Puhelinnumero\n\nTäytä ensin kaikki pakolliset tiedot ja tallenna ne.',
        [
          { 
            text: 'OK', 
            style: 'default'
          }
        ]
      );
      return;
    }
    
    setContinuousOrder(value);
    
    // Save the toggle state immediately to database
    if (userProfile?.id) {
      try {
        await saveOrderSettings(userProfile.id, {
          continuousOrder: value,
          preferredService: 'Lumityö',
          specialInstructions: null
        });
        
        // If turning ON jatkuva tilaus, send to Supabase for Map App
        if (value && name.trim() && address.trim() && phone.trim()) {
          await sendContinuousOrderToSupabase();
        }
        
        console.log(`🔄 Jatkuva tilaus toggle ${value ? 'enabled' : 'disabled'} and saved immediately`);
      } catch (error) {
        console.error('Error saving continuous order setting:', error);
        Alert.alert('Virhe', 'Asetuksen tallentaminen epäonnistui');
        // Revert the toggle on error
        setContinuousOrder(!value);
      }
    }
  };

  // Geocode address to get coordinates
  const geocodeAddress = async (address) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_OPENCAGE_API_KEY;
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}&limit=1`;
      
      console.log(`🗺️ Geocoding address: ${address}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status.code === 200 && data.results.length > 0) {
        const result = data.results[0];
        const lat = result.geometry.lat;
        const lon = result.geometry.lng;
        
        console.log(`✅ Geocoded successfully: ${lat}, ${lon}`);
        return { lat, lon };
      } else {
        console.warn(`❌ Geocoding failed for address: ${address}`);
        return { lat: null, lon: null };
      }
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return { lat: null, lon: null };
    }
  };

  const sendContinuousOrderToSupabase = async () => {
    try {
      // First geocode the address to get coordinates
      const coordinates = await geocodeAddress(address.trim());
      
      const orderData = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim() || null, // Include email if provided
        palvelu: 'Lumityö',
        price: '20-30€',
        status: 'jatkuva_tilaus',
        lat: coordinates.lat,
        lon: coordinates.lon,
        info: continuousOrderInfo.trim() || 'Jatkuva tilaus aktivoitu käyttäjän toimesta',
        jatkuva_tilaus: true
      };

      console.log('📤 Sending continuous order to Supabase:', orderData);

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/snow_orders`, {
        method: 'POST',
        headers: {
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Continuous order sent to Supabase successfully:', result);
        
        // Show success message
        Alert.alert(
          'Jatkuva tilaus aktivoitu!',
          `Saat automaattisesti lumityöpalvelua jatkossa.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error sending continuous order to Supabase:', error);
      Alert.alert(
        'Virhe',
        'Jatkuvan tilauksen lähettäminen epäonnistui. Yritä myöhemmin uudelleen.',
        [{ text: 'OK' }]
      );
    }
  };

  const loadOrderHistory = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        // Get local orders
        const localOrders = await getOrders(profile.id);
        
        // Fetch updated statuses from Supabase
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/snow_orders`, {
            headers: {
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
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
            
            setOrders(updatedOrders);
          } else {
            console.warn('⚠️ Failed to fetch Supabase orders, using local only');
            setOrders(localOrders);
          }
        } catch (supabaseError) {
          console.warn('⚠️ Supabase fetch error, using local orders only:', supabaseError);
          setOrders(localOrders);
        }
      }
    } catch (error) {
      console.error('Error loading order history:', error);
    }
  };

  const saveUserData = async () => {
    if (isSaving) return; // Prevent double-clicks
    
    // Validate required fields
    if (!name.trim() || !address.trim() || !phone.trim()) {
      Alert.alert('Virhe', 'Täytä kaikki pakolliset kentät (nimi, osoite, puhelinnumero).');
      return;
    }
    
    setIsSaving(true);
    
    try {
      let profileId = userProfile?.id;
      
      if (profileId) {
        // Update existing profile
        const updateResult = await updateUserProfile(profileId, {
          name,
          phone,
          address,
          email
        });
        
        if (!updateResult.success) {
          Alert.alert('Virhe', 'Tietojen päivittäminen epäonnistui');
          return;
        }
      } else {
        // Create new profile
        const createResult = await createUserProfile({
          name,
          phone,
          address,
          email
        });
        
        if (!createResult.success) {
          Alert.alert('Virhe', 'Profiilin luominen epäonnistui');
          return;
        }
        
        profileId = createResult.profileId;
        // Reload profile data
        await loadUserData();
      }

      // Profile data saved successfully - jatkuva tilaus setting is managed separately
      Alert.alert(
        'Onnistui', 
        'Tiedot tallennettu!',
        [{ text: 'OK', onPress: () => {
          setIsEditMode(false); // Switch to view mode after successful save
          loadOrderHistory();
        }}]
      );

    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Virhe', 'Tietojen tallentaminen epäonnistui');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditToggle = () => {
    setIsEditMode(!isEditMode);
  };

  // Contact functions
  const handleContactSubmit = async () => {
    if (!contactMessage.trim()) {
      Alert.alert('Virhe', 'Kirjoita viestisi ennen lähettämistä.');
      return;
    }
    
    if (!contactEmail.trim()) {
      Alert.alert('Virhe', 'Anna sähköpostiosoitteesi, jotta voimme ottaa sinuun yhteyttä.');
      return;
    }

    setIsSubmittingContact(true);
    
    try {
      const templateParams = {
        message: contactMessage,
        email: contactEmail || 'Ei sähköpostia',
        to_name: 'Lumityöt'
      };

      // Use the correct EmailJS configuration from environment
      await emailjs.send(
        process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID || 'service_kmtdwk8',
        process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_za30asu',
        templateParams,
        process.env.EXPO_PUBLIC_EMAILJS_USER_ID || 'XwJENMkw3QXVvWHQB'
      );

      Alert.alert(
        'Viestin lähetetty!',
        'Viestisi on lähetetty onnistuneesti. Otamme sinuun yhteyttä pian.',
        [{ text: 'OK', onPress: () => {
          setShowContactModal(false);
          setContactMessage('');
          setContactEmail('');
        }}]
      );
    } catch (error) {
      console.error('Contact form error:', error);
      Alert.alert(
        'Virhe',
        'Viestin lähettäminen epäonnistui. Yritä myöhemmin uudelleen tai ota yhteyttä puhelimitse.'
      );
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const renderOrderItem = ({ item }) => {
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

    // Get status color
    const getStatusColor = (status) => {
      switch (status) {
        case 'odottaa': return '#FF9800'; // Orange
        case 'kuitattu': return '#4CAF50'; // Green
        case 'kesken': return '#2196F3'; // Blue
        default: return '#999'; // Gray
      }
    };

    return (
      <View style={styles.modernOrderItem}>
        <View style={styles.orderItemHeader}>
          <Ionicons name="snow-outline" size={20} color="#fff" />
          <Text style={styles.orderItemTitle}>{item.service_type}</Text>
        </View>
        <View style={styles.orderItemContent}>
          <View style={styles.orderItemRow}>
            <Ionicons name="location-outline" size={16} color="#ccc" />
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
        </View>
      </View>
    );
  };



  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Background Image */}
      <Image source={bgImage} style={styles.backgroundImage} resizeMode="cover" />
      
      {/* Overlay for better text readability */}
      <View style={styles.overlay} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 20, paddingBottom: 120, paddingTop: Platform.OS === 'ios' ? 60 : 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
         

          {/* Section 1: User Details */}
          <View style={styles.modernCard}>
           <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={32} color="#fff" />
            <Text style={styles.cardHeaderText}>Omat Tiedot</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { 
              color: '#fff',
              textShadowColor: 'rgba(0, 0, 0, 0.8)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 2,
            }]}>Nimi *</Text>
            <TextInput
              style={[styles.input, !isEditMode && { backgroundColor: 'rgba(245, 245, 245, 0.7)' }]}
              placeholder="Syötä nimesi"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              blurOnSubmit={false}
              editable={isEditMode}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { 
              color: '#fff',
              textShadowColor: 'rgba(0, 0, 0, 0.8)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 2,
            }]}>Osoite *</Text>
            {isEditMode ? (
              <AddressAutocompleteMapboxNew
                value={address}
                onChangeText={setAddress}
                onAddressSelect={(addressData) => {
                  // Extract the display address string from the address object
                  const displayAddress = typeof addressData === 'string' ? addressData : addressData.displayAddress || addressData.formatted || addressData;
                  setAddress(displayAddress);
                }}
                placeholder="Syötä osoitteesi"
              />
            ) : (
              <TextInput
                style={[styles.input, { backgroundColor: 'rgba(245, 245, 245, 0.7)' }]}
                value={address}
                editable={false}
                placeholder="Syötä osoitteesi"
              />
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { 
              color: '#fff',
              textShadowColor: 'rgba(0, 0, 0, 0.8)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 2,
            }]}>Puhelinnumero *</Text>
            <TextInput
              style={[styles.input, !isEditMode && { backgroundColor: 'rgba(245, 245, 245, 0.7)' }]}
              placeholder="Syötä puhelinnumerosi"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              blurOnSubmit={false}
              editable={isEditMode}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { 
              color: '#fff',
              textShadowColor: 'rgba(0, 0, 0, 0.8)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 2,
            }]}>Sähköposti</Text>
            <TextInput
              style={[styles.input, !isEditMode && { backgroundColor: 'rgba(245, 245, 245, 0.7)' }]}
              placeholder="Syötä sähköpostiosoitteesi"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              blurOnSubmit={true}
              editable={isEditMode}
            />
          </View>

          <TouchableOpacity 
            style={[styles.confirmButton, isSaving && { opacity: 0.6 }]} 
            onPress={isEditMode ? saveUserData : handleEditToggle}
            disabled={isSaving}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons 
                name={isEditMode ? "save-outline" : "create-outline"} 
                size={20} 
                color="#fff" 
                style={{ marginRight: 8 }} 
              />
              <Text style={styles.confirmButtonText}>
                {isEditMode 
                  ? (isSaving ? 'Tallennetaan...' : 'Tallenna Tiedot')
                  : 'Muokkaa Tiedot'
                }
              </Text>
            </View>
          </TouchableOpacity>

          {/* Contact Button */}
          <TouchableOpacity 
            style={[styles.confirmButton, { 
              backgroundColor: 'rgba(76, 132, 175, 0.8)', 
              marginTop: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.3)'
            }]} 
            onPress={() => setShowContactModal(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mail-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmButtonText}>Ota Yhteyttä</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={{
            color: '#f5f5f5',
            fontSize: 13,
            textAlign: 'center',
            marginTop: 12,
            fontStyle: 'italic',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: 8,
            borderRadius: 6,
            textShadowColor: 'rgba(0, 0, 0, 0.8)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 2,
          }}>
            * Pakolliset tiedot jatkuvaa tilausta varten
          </Text>
        </View>

        {/* Section 2: Continuous Order Setting */}
        <View style={styles.modernCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
            <Text style={styles.cardHeaderText}>Tilausasetukset</Text>
            <TouchableOpacity 
              onPress={() => setShowContinuousOrderInfo(!showContinuousOrderInfo)}
              style={styles.infoButton}
            >
              <Ionicons 
                name={showContinuousOrderInfo ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modernSwitchContainer}>
            <View style={styles.switchContent}>
              <Ionicons name="repeat-outline" size={20} color="#fff" />
              <Text style={styles.modernSwitchLabel}>Jatkuva tilaus</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={continuousOrder ? '#f1f1f1ff' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={handleContinuousOrderToggle}
              value={continuousOrder}
            />
          </View>
          
         
          
          <Text style={{
            color: '#f5f5f5',
            fontSize: 15,
            lineHeight: 20,
            marginTop: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: 12,
            borderRadius: 8,
            textShadowColor: 'rgba(0, 0, 0, 0.8)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 2,
          }}>
            {continuousOrder 
              ? 'Jatkuva tilaus -asetus on käytössä. Tulevat tilauksesi merkitään automaattisesti jatkuviksi tilauksiksi.' 
              : !name.trim() || !address.trim() || !phone.trim() 
                ? 'Täytä ensin pakolliset tiedot (nimi*, osoite*, puhelinnumero*) ja tallenna ne jatkuvan tilauksen aktivoimiseksi.'
                : 'Jatkuva tilaus -asetus ei ole käytössä. Tulevat tilauksesi luodaan kertatilauksina.'
            }
          </Text>

          {/* Accordion Content */}
          {showContinuousOrderInfo && (
            <View style={{
              backgroundColor: 'rgba(46, 46, 46, 0.63)',
              borderRadius: 12,
              padding: 18,
              marginTop: 16,
            }}>
              <Text style={{
                color: '#6bb6ff',
                fontSize: 17,
                fontWeight: 'bold',
                marginBottom: 12
              }}>
                Jatkuva tilaus - Lisätietoa
              </Text>

              <Text style={{
                color: '#ffffffff',
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 10
              }}>
                <Text style={{ fontWeight: 'bold', color: '#e9e9e9ff' }}>Toiminta:</Text> Kun asetus on päällä, lumityöt tehdään annettuun osoittteeseen ilman erillistä tilausta. Työt suoritetaan, kun lunta satanut merkittävä määrä. 
              </Text>

              <Text style={{
                color: '#ffffffff',
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 10
              }}>
                <Text style={{ fontWeight: 'bold', color: '#e9e9e9ff' }}>Laskutus:</Text> Kun lumitöitä on kertynyt 5 kertaa, lähetetään lasku joko paperisena tai suoraan sähköpostiin. Halutessasi voit myös sopia koko talven laskutuksen yhdellä laskulla. 
              </Text>

              <Text style={{
                color: '#ffffffff',
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 10
              }}>
                <Text style={{ fontWeight: 'bold', color: '#e9e9e9ff' }}>Peruutus:</Text> Voit ottaa asetuksen pois päältä milloin tahansa. Aiemmin tehtyjen lumitöiden tiedot näkyvät tilaushistoriassa.
              </Text>
              <View style={{
                backgroundColor: '#20202060',
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
              }}>
                <Text style={{
                  color: '#ffffffff',
                  fontSize: 15,
                  lineHeight: 20,
                  fontWeight: '500'
                }}>
                  Toivotttavasti olet tyytyväinen palveluun! Kiitos, kun käytät sovellusta.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 30}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            maxHeight: '80%'
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Ionicons name="mail" size={24} color="#4c84af" />
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#333',
                marginLeft: 8
              }}>
                Ota Yhteyttä
              </Text>
              <TouchableOpacity
                style={{
                  marginLeft: 'auto',
                  padding: 4
                }}
                onPress={() => setShowContactModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          

            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={{
                fontSize: 16,
                color: '#666',
                marginBottom: 16,
                lineHeight: 22
              }}>
                Laita viesti - otamme sinuun yhteyttä pian!
              </Text>

              {/* Email Input Field */}
              <Text style={{
                fontSize: 14,
                color: '#333',
                marginBottom: 8,
                fontWeight: '500'
              }}>
                Sähköpostiosoite
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  backgroundColor: '#f9f9f9',
                  marginBottom: 20
                }}
                placeholder="esim. maija@example.com"
                placeholderTextColor="#999"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />

              {/* Message Input Field */}
              <Text style={{
                fontSize: 14,
                color: '#333',
                marginBottom: 8,
                fontWeight: '500'
              }}>
                Viesti
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  textAlignVertical: 'top',
                  minHeight: 120,
                  backgroundColor: '#f9f9f9'
                }}
                placeholder="Kirjota tähän..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={6}
                value={contactMessage}
                onChangeText={setContactMessage}
                maxLength={500}
              />

              <Text style={{
                fontSize: 12,
                color: '#999',
                textAlign: 'right',
                marginTop: 8
              }}>
                {contactMessage.length}/500
              </Text>
            </ScrollView>

            <View style={{
              flexDirection: 'row',
              marginTop: 20,
              gap: 12
            }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center'
                }}
                onPress={() => setShowContactModal(false)}
              >
                <Text style={{
                  fontSize: 16,
                  color: '#666',
                  fontWeight: '500'
                }}>
                  Peruuta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#4c84af',
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: isSubmittingContact ? 0.6 : 1
                }}
                onPress={handleContactSubmit}
                disabled={isSubmittingContact}
              >
                <Text style={{
                  fontSize: 16,
                  color: '#fff',
                  fontWeight: '600'
                }}>
                  {isSubmittingContact ? 'Lähetetään...' : 'Lähetä'}
                </Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </View>
  );
};

export default OmatTiedotScreen;