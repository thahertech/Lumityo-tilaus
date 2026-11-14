import { StyleSheet } from 'react-native';
import { createCardStyle, createButtonStyle } from './theme';
const createStyles = (theme) => {
const { colors: c, typography: t } = theme;
return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  headerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  profileHeaderText: { ...t.h1, color: c.textPrimary, marginLeft: 12, flexShrink: 1 },
  modernCard: { ...createCardStyle(theme), marginBottom: 16 },
  sectionContainer: { ...createCardStyle(theme), marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  cardHeaderText: { ...t.h3, color: c.textPrimary, flex: 1 },
  inputContainer: { marginBottom: 18 },
  label: { ...t.label, color: c.textPrimary, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: c.controlBorder, padding: 14, borderRadius: theme.borderRadius.md,
    fontFamily: theme.fonts.regular, fontSize: 17, backgroundColor: c.input, color: c.controlText, minHeight: 54,
  },
  confirmButton: { ...createButtonStyle('primary', c), marginTop: 8 },
  confirmButtonText: { ...t.button, color: c.onPrimary },
  infoButton: { padding: 12, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  modernSwitchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  switchContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  modernSwitchLabel: { ...t.body, color: c.textPrimary, flexShrink: 1 },
  refreshButton: { ...createButtonStyle('secondary', c), flexDirection: 'row', gap: 8, minHeight: 48, paddingVertical: 10, paddingHorizontal: 16 },
  refreshButtonText: { ...t.caption, fontFamily: theme.fonts.semibold, color: c.controlText },
  modernOrderItem: { ...createCardStyle(theme), marginBottom: 12, width: '100%' },
  orderItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  orderItemTitle: { ...t.cardTitle, color: c.textPrimary, flexShrink: 1 },
  orderItemContent: { gap: 10 },
  orderItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderItemText: { ...t.bodySmall, color: c.textSecondary, flex: 1 },
});
};

export default createStyles;
