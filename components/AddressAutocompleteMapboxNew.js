import { useTheme } from '../ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const AddressAutocompleteMapbox = ({ 
  value, 
  onChangeText, 
  onAddressSelect, 
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  placeholderTextColor,
  placeholder = "Esim. Kauppakatu 1, Oulu",
  style,
  inputStyle,
  onUseCurrentLocation,
  onCancelCurrentLocation,
  isLocating = false,
  editable = true,
  maxSuggestions = 5
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showKatuNumeroModal, setShowKatuNumeroModal] = useState(false);
  const [selectedStreetSuggestion, setSelectedStreetSuggestion] = useState(null);
  const [katuNumero, setKatuNumero] = useState('');
  const searchGeneration = useRef(0);
  const searchTimer = useRef(null);

  useEffect(() => () => {
    searchGeneration.current += 1;
    clearTimeout(searchTimer.current);
  }, []);

  // Get API tokens from expo config
  const mapboxToken = Constants.expoConfig?.extra?.mapboxAccessToken || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const opencageKey = Constants.expoConfig?.extra?.opencageApiKey || process.env.EXPO_PUBLIC_OPENCAGE_API_KEY;

  const cancelSearch = () => {
    searchGeneration.current += 1;
    clearTimeout(searchTimer.current);
    setIsLoading(false);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Fetch address suggestions from Mapbox with Oulu/Kempele focus
  const fetchMapboxSuggestions = async (input) => {
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
      const response = await fetch(url);
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const suggestions = data.features
          .filter(feature => {
            // Accept all Finnish addresses but prioritize Oulu/Kempele
            const context = feature.context || [];
            const placeName = feature.place_name?.toLowerCase() || '';
            
            // Check if it's a Finnish address
            const isFinland = placeName.includes('finland') || placeName.includes('suomi') ||
                             context.some(ctx => ctx.text?.toLowerCase().includes('finland'));
            
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
        return suggestions;
      }
      
      return [];
    } catch (error) {
      console.error('❌ OpenCage error:', error);
      return [];
    }
  };

  // Main fetch function that tries Mapbox first, then OpenCage
  const fetchAddressSuggestions = async (input, generation) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Try Mapbox first
      const mapboxResults = await fetchMapboxSuggestions(input);
      if (generation !== searchGeneration.current) return;
      
      if (mapboxResults && mapboxResults.length > 0) {
        setSuggestions(mapboxResults);
        setShowSuggestions(true);
      } else {
        // Fallback to OpenCage
        const opencageResults = await fetchOpenCageSuggestions(input);
        if (generation !== searchGeneration.current) return;
        
        if (opencageResults.length > 0) {
          setSuggestions(opencageResults);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }
    } catch (error) {
      if (generation !== searchGeneration.current) return;
      console.error('❌ Address search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      if (generation === searchGeneration.current) setIsLoading(false);
    }
  };

  const handleInputChange = (text) => {
    cancelSearch();
    onChangeText(text);
    
    if (text.length >= 2) {
      const generation = searchGeneration.current;
      searchTimer.current = setTimeout(() => fetchAddressSuggestions(text, generation), 300);
    }
  };

  const handleSuggestionPress = (suggestion) => {
    cancelSearch();
    
    // Check if user already typed a street number in their input
    const userInput = (value || '').trim();
    
    // Remove any existing postal code and city from the input to avoid duplication
    // Pattern: ", XXXXX City" or just ", City" at the end
    const cleanInput = userInput.replace(/,\s*\d{5}\s+\w+\s*$/i, '').replace(/,\s+\w+\s*$/i, '').trim();
    
    const hasNumberInInput = /\d/.test(cleanInput);
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
          editable={editable}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          placeholderTextColor={placeholderTextColor || theme.colors.inputPlaceholder}
          onFocus={(event) => {
            setShowSuggestions(suggestions.length > 0);
            if (onFocus) onFocus(event);
          }}
          onBlur={(event) => {
            if (onBlur) onBlur(event);
            // Small delay to allow suggestion taps to register before hiding
            const generation = searchGeneration.current;
            setTimeout(() => {
              if (generation === searchGeneration.current) cancelSearch();
            }, 200);
          }}
        />
        {isLoading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color={theme.colors.controlIcon}
          />
        )}
      </View>

      {editable && showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Osoite-ehdotukset</Text>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled={true}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item)}
                accessibilityRole="button"
                accessibilityLabel={`Valitse osoite ${item.formatted}`}
              >
                <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} />
                <Text style={styles.suggestionText}>{item.formatted}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {onUseCurrentLocation && (
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => {
            cancelSearch();
            Keyboard.dismiss();
            if (isLocating) onCancelCurrentLocation?.();
            else onUseCurrentLocation();
          }}
          disabled={isLocating && !onCancelCurrentLocation}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLocating && !onCancelCurrentLocation, busy: isLocating }}
        >
          {isLocating
            ? <ActivityIndicator size="small" color={theme.colors.textSecondary} />
            : <Ionicons name="locate-outline" size={18} color={theme.colors.textSecondary} />}
          <Text style={styles.locationButtonText}>
            {isLocating ? 'Peruuta sijainnin haku' : 'Käytä nykyistä sijaintia'}
          </Text>
        </TouchableOpacity>
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
              placeholderTextColor={theme.colors.inputPlaceholder}
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

const createStyles = (theme) => StyleSheet.create({
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
    minHeight: 54,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: theme.fonts.regular,
    backgroundColor: theme.colors.input,
    color: theme.colors.controlText,
  },
  loadingIndicator: {
    position: 'absolute',
    right: 12,
  },
  locationButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },
  locationButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.medium,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: theme.colors.panel,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  suggestionsTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.semibold,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  suggestionText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    flex: 1,
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
    backgroundColor: theme.colors.panel,
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
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  katuNumeroInput: {
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    fontSize: 18,
    fontFamily: theme.fonts.regular,
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: theme.colors.input,
    color: theme.colors.controlText,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButtonText: {
    ...theme.typography.label,
    color: theme.colors.controlText,
  },
  confirmButtonText: {
    ...theme.typography.label,
    color: theme.colors.onPrimary,
  },
});

export default AddressAutocompleteMapbox;
