import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';

const AddressAutocompleteMapbox = ({ 
  value, 
  onChangeText, 
  onAddressSelect, 
  onFocus,
  placeholder = "Esim. Kauppakatu 1, Oulu",
  style,
  inputStyle,
  maxSuggestions = 5
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showKatuNumeroModal, setShowKatuNumeroModal] = useState(false);
  const [selectedStreetSuggestion, setSelectedStreetSuggestion] = useState(null);
  const [katuNumero, setKatuNumero] = useState('');

  // Get API tokens from expo config
  const mapboxToken = Constants.expoConfig?.extra?.mapboxAccessToken || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const opencageKey = Constants.expoConfig?.extra?.opencageApiKey || process.env.EXPO_PUBLIC_OPENCAGE_API_KEY;


  // Debounce function to avoid too many API calls
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  // Fetch address suggestions from Mapbox with Oulu/Kempele focus
  const fetchMapboxSuggestions = async (input) => {
    console.log('🗺️ Fetching Mapbox suggestions for:', input);
    
    if (!mapboxToken) {
      console.warn('⚠️ No Mapbox token available');
      return null;
    }

    try {
      // Smart search without geographical restrictions
      const searchQuery = input;
      
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
        `access_token=${mapboxToken}&` +
        `country=fi&` +
        `proximity=25.467,65.012&` + // Prefer Oulu area but allow all Finnish cities
        `limit=${Math.max(maxSuggestions * 2, 10)}&` + // Get more results to filter
        `language=fi&` +
        `types=address,poi`;

      console.log('🌐 Mapbox API request:', url.replace(mapboxToken, '[TOKEN]'));
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 Mapbox response:', {
        status: response.status,
        features: data.features?.length || 0,
        query: data.query
      });

      if (data.features && data.features.length > 0) {
        const suggestions = data.features
          .filter(feature => {
            // Accept all Finnish addresses but prioritize Oulu/Kempele
            const context = feature.context || [];
            const placeName = feature.place_name?.toLowerCase() || '';
            
            // Check if it's a Finnish address
            const isFinland = placeName.includes('finland') || placeName.includes('suomi') ||
                             context.some(ctx => ctx.text?.toLowerCase().includes('finland'));
            
            // Priority scoring: Oulu/Kempele get higher priority
            const isOuluKempele = placeName.includes('oulu') || 
                                  placeName.includes('kempele') ||
                                  context.some(ctx => 
                                    ctx.text?.toLowerCase().includes('oulu') ||
                                    ctx.text?.toLowerCase().includes('kempele')
                                  );
            
            console.log('🏠 Address filter:', {
              place: feature.place_name,
              isFinland,
              isOuluKempele,
              context: context.map(c => c.text)
            });
            
            return isFinland; // Accept all Finnish addresses
          })
          .sort((a, b) => {
            // Sort: Oulu/Kempele first, then others
            const aIsOuluKempele = a.place_name.toLowerCase().includes('oulu') || a.place_name.toLowerCase().includes('kempele');
            const bIsOuluKempele = b.place_name.toLowerCase().includes('oulu') || b.place_name.toLowerCase().includes('kempele');
            
            if (aIsOuluKempele && !bIsOuluKempele) return -1;
            if (!aIsOuluKempele && bIsOuluKempele) return 1;
            return 0;
          })
          .slice(0, maxSuggestions)
          .map(feature => {
            // Parse context to extract postal code and city
            const context = feature.context || [];
            let postalCode = '';
            let city = '';
            
            context.forEach(ctx => {
              if (ctx.id.startsWith('postcode')) {
                postalCode = ctx.text;
              } else if (ctx.id.startsWith('place')) {
                city = ctx.text;
              }
            });

            // Clean the formatted address
            const cleanFormatted = feature.place_name
              .replace(', Finland', '')
              .replace(', Suomi', '')
              .replace(/,\s*Finland\s*$/i, '')
              .replace(/,\s*Suomi\s*$/i, '');

            return {
              id: feature.id,
              formatted: cleanFormatted,
              address: feature.text,
              postalCode: postalCode,
              city: city || 'Oulu', // Default to Oulu if not found
              geometry: {
                lat: feature.center[1],
                lng: feature.center[0]
              },
              mapboxFeature: feature
            };
          });

        console.log(`✅ Mapbox found ${suggestions.length} Oulu/Kempele addresses`);
        return suggestions;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Mapbox error:', error);
      return null;
    }
  };

  // Fallback to OpenCage API
  const fetchOpenCageSuggestions = async (input) => {
    console.log('🌍 Fetching OpenCage suggestions for:', input);
    
    if (!opencageKey) {
      console.warn('⚠️ No OpenCage API key available');
      return [];
    }

    try {
      const enhancedQuery = `${input} (Oulu OR Kempele)`;
      const bounds = "25.2,64.85,25.7,65.15";
      
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(enhancedQuery)}&key=${opencageKey}&limit=10&countrycode=fi&language=fi&bounds=${bounds}&no_annotations=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 OpenCage response status:', data.status?.code);

      if (data.results) {
        const suggestions = data.results
          .filter(result => {
            const formatted = result.formatted?.toLowerCase() || '';
            const components = result.components || {};
            
            const isInTargetArea = formatted.includes('oulu') ||
                                  formatted.includes('kempele') ||
                                  components.city?.toLowerCase() === 'oulu' ||
                                  components.city?.toLowerCase() === 'kempele';
            
            return isInTargetArea;
          })
          .slice(0, maxSuggestions)
          .map(result => {
            const components = result.components || {};
            const cleanFormatted = result.formatted
              .replace(', Finland', '')
              .replace(', Suomi', '')
              .replace(/,\s*Finland\s*$/i, '')
              .replace(/,\s*Suomi\s*$/i, '');

            return {
              id: Math.random().toString(),
              formatted: cleanFormatted,
              address: components.road || result.formatted.split(',')[0],
              postalCode: components.postcode || '',
              city: components.city || components.town || components.municipality || 'Oulu',
              geometry: {
                lat: result.geometry.lat,
                lng: result.geometry.lng
              }
            };
          });

        console.log(`✅ OpenCage found ${suggestions.length} suggestions`);
        return suggestions;
      }
      
      return [];
    } catch (error) {
      console.error('❌ OpenCage error:', error);
      return [];
    }
  };

  // Main fetch function that tries Mapbox first, then OpenCage
  const fetchAddressSuggestions = async (input) => {
    console.log('🔍 Starting address search for:', input);
    console.log('🔧 API keys check:', {
      mapboxAvailable: !!mapboxToken,
      opencageAvailable: !!opencageKey
    });
    
    if (!input || input.length < 3) {
      console.log('⚠️ Input too short, clearing suggestions');
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Try Mapbox first
      const mapboxResults = await fetchMapboxSuggestions(input);
      
      if (mapboxResults && mapboxResults.length > 0) {
        console.log(`✅ Using Mapbox results: ${mapboxResults.length} suggestions`);
        setSuggestions(mapboxResults);
        setShowSuggestions(true);
      } else {
        console.log('🔄 Mapbox failed or no results, trying OpenCage...');
        // Fallback to OpenCage
        const opencageResults = await fetchOpenCageSuggestions(input);
        
        if (opencageResults.length > 0) {
          console.log(`✅ Using OpenCage results: ${opencageResults.length} suggestions`);
          setSuggestions(opencageResults);
          setShowSuggestions(true);
        } else {
          console.log('❌ No results from either API');
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    } catch (error) {
      console.error('❌ Address search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search function
  const debouncedFetch = useCallback(
    debounce(fetchAddressSuggestions, 300),
    [mapboxToken, opencageKey]
  );

  const handleInputChange = (text) => {
    console.log('🔍 Address input changed:', text);
    onChangeText(text);
    
    if (text.length >= 2) {
      console.log('🚀 Triggering address suggestions fetch...');
      debouncedFetch(text);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleSuggestionPress = (suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Check if user already typed a street number in their input
    const userInput = (value || '').trim();
    
    // Remove any existing postal code and city from the input to avoid duplication
    // Pattern: ", XXXXX City" or just ", City" at the end
    const cleanInput = userInput.replace(/,\s*\d{5}\s+\w+\s*$/i, '').replace(/,\s+\w+\s*$/i, '').trim();
    
    const hasNumberInInput = /\d/.test(cleanInput);
    
    console.log('🔍 Checking user input for numbers:', {
      originalInput: userInput,
      cleanedInput: cleanInput,
      hasNumber: hasNumberInInput
    });
    
    if (hasNumberInInput) {
      // User already typed a number, extract it and use directly
      // Updated logic to handle apartment numbers like "49 B 33" or "49B33"
      const streetName = suggestion.address;
      let extractedNumber = '';
      
      // Try to find the street name in the user input and extract everything after it
      const streetIndex = cleanInput.toLowerCase().indexOf(streetName.toLowerCase());
      
      if (streetIndex !== -1) {
        // Extract everything after the street name (this includes apartment numbers)
        const afterStreet = cleanInput.substring(streetIndex + streetName.length).trim();
        if (afterStreet) {
          extractedNumber = afterStreet;
        }
      }
      
      // If we couldn't find the street name match, try alternative extraction
      if (!extractedNumber) {
        // Look for pattern like: numbers + optional letter + optional space + optional letter + numbers
        // This handles: "49", "49A", "49 B", "49 B 33", "49B33", etc.
        const numberMatch = cleanInput.match(/\d+(?:[A-Za-z]|\s+[A-Za-z](?:\s*\d+)?)*$/);
        extractedNumber = numberMatch ? numberMatch[0].trim() : '';
      }
      
      console.log('📝 Number found in input:', extractedNumber);
      
      // Construct final address immediately
      const streetWithNumber = extractedNumber ? 
        `${suggestion.address} ${extractedNumber}` : 
        suggestion.address;
      
      const postalCode = suggestion.postalCode;
      const city = suggestion.city;
      
      let displayAddress = streetWithNumber;
      if (postalCode && city) {
        displayAddress = `${streetWithNumber}, ${postalCode} ${city}`;
      } else if (city) {
        displayAddress = `${streetWithNumber}, ${city}`;
      }
      
      onChangeText(displayAddress);
      
      if (onAddressSelect) {
        onAddressSelect({
          ...suggestion,
          formatted: displayAddress,
          address: streetWithNumber,
          fullAddress: displayAddress,
          katuNumero: extractedNumber,
          postalCode: postalCode,
          city: city
        });
      }
    } else {
      // No number in input, show the katunumero modal
      setSelectedStreetSuggestion(suggestion);
      setShowKatuNumeroModal(true);
    }
  };

  const handleKatuNumeroSubmit = () => {
    if (!katuNumero.trim()) {
      Alert.alert('Virhe', 'Syötä katunumero');
      return;
    }

    // Construct the full address with street number, postal code, and city
    const streetWithNumber = `${selectedStreetSuggestion.address} ${katuNumero.trim()}`;
    const postalCode = selectedStreetSuggestion.postalCode;
    const city = selectedStreetSuggestion.city;
    
    // Create display address (street + number + postal code + city)
    let displayAddress = streetWithNumber;
    if (postalCode && city) {
      displayAddress = `${streetWithNumber}, ${postalCode} ${city}`;
    } else if (city) {
      displayAddress = `${streetWithNumber}, ${city}`;
    }
    
    // Full address for Supabase (complete information)
    const fullAddress = displayAddress;
    
    console.log('📍 Final address constructed:', {
      streetWithNumber,
      postalCode,
      city,
      displayAddress,
      fullAddress
    });
    
    onChangeText(displayAddress);
    setShowKatuNumeroModal(false);
    setKatuNumero('');
    
    if (onAddressSelect) {
      onAddressSelect({
        ...selectedStreetSuggestion,
        formatted: fullAddress,
        address: streetWithNumber,
        fullAddress: displayAddress,
        katuNumero: katuNumero.trim(),
        postalCode: postalCode,
        city: city
      });
    }
  };

  const handleKatuNumeroCancel = () => {
    setShowKatuNumeroModal(false);
    setKatuNumero('');
    setSelectedStreetSuggestion(null);
  };

  return (
    <View style={[styles.container, style]} pointerEvents="box-none">
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.textInput, inputStyle]}
          value={value || ''}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          onFocus={() => {
            setShowSuggestions(suggestions.length > 0);
            if (onFocus) onFocus();
          }}
          onBlur={() => {
            // Small delay to allow suggestion taps to register before hiding
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        {isLoading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color="#007AFF"
          />
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer} pointerEvents="auto">
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item)}
              >
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {item.formatted}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Katunumero Modal */}
      <Modal
        visible={showKatuNumeroModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleKatuNumeroCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Syötä katunumero</Text>
            <Text style={styles.modalSubtitle}>
              {selectedStreetSuggestion?.address}
            </Text>
            
            <TextInput
              style={styles.katuNumeroInput}
              value={katuNumero}
              onChangeText={setKatuNumero}
              placeholder="Esim. 5 A 33, 12 B, 15"
              keyboardType="ascii-capable"
              autoFocus={true}
              selectTextOnFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleKatuNumeroCancel}
              >
                <Text style={styles.cancelButtonText}>Peruuta</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleKatuNumeroSubmit}
              >
                <Text style={styles.confirmButtonText}>Valitse</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 12,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    maxHeight: 200,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  katuNumeroInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default AddressAutocompleteMapbox;