import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { openUpdatePage } from '../utils/versionCheck';

export default function UpdateModal({ visible, updateType, updateUrl, message }) {
  const { theme } = useTheme();
  const isMandatory = updateType === 'mandatory';

  const handleUpdate = () => {
    openUpdatePage(updateUrl);
  };

  const handleLater = () => {
    if (isMandatory) {
      Alert.alert('Päivitys vaaditaan', 'Sinun tulee päivittää sovellus jatkaaksesi.', [
        { text: 'Päivitä nyt', onPress: handleUpdate },
      ]);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => !isMandatory && handleLater()}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
          <View style={styles.header}>
            <Ionicons name="cloud-download-outline" size={48} color={theme.colors.primary} />
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {isMandatory ? 'Päivitys vaaditaan' : 'Päivitys saatavilla'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {message || 'Lumityöt-sovelluksesta on saatavilla uusi versio.'}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleUpdate}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={20} color={theme.colors.onPrimary} style={styles.buttonIcon} />
              <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>
                Päivitä nyt
              </Text>
            </TouchableOpacity>

            {!isMandatory && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton, { borderColor: theme.colors.border }]}
                onPress={handleLater}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: theme.colors.textPrimary }]}>
                  Myöhemmin
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isMandatory && (
            <Text style={[styles.notice, { color: theme.colors.textSecondary }]}>
              Sinun tulee päivittää sovellus jatkaaksesi Lumityöt-sovelluksen käyttöä.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
  },
  updateButton: {
    borderWidth: 0,
  },
  laterButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notice: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
