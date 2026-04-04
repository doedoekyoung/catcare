// src/components/ui.tsx
// Shared UI primitives used across all screens

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  fullWidth, disabled, loading, icon, style,
}: ButtonProps) {
  const btnStyle = [
    styles.btn,
    styles[`btn_${variant}`],
    styles[`btn_${size}`],
    fullWidth && styles.btn_full,
    disabled && styles.btn_disabled,
    style,
  ];
  return (
    <TouchableOpacity
      style={btnStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : colors.caramel} />
      ) : (
        <>
          {icon}
          <Text style={[styles.btnText, styles[`btnText_${variant}`], styles[`btnText_${size}`]]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, style, ...props }, ref) => (
    <View style={[styles.inputContainer, containerStyle]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.inputField, error && styles.inputError, style]}
        placeholderTextColor={colors.muted}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
);

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, shadow.sm, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, shadow.sm, style]}>{children}</View>;
}

// ── Section Title ─────────────────────────────────────────────────────────────

export function SectionTitle({ title, style }: { title: string; style?: TextStyle }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={[styles.sectionTitle, style]}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ── Bottom Sheet Modal ────────────────────────────────────────────────────────

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, spacing.md);
  const maxSheetHeight = Dimensions.get('window').height * 0.88;

  const sheetContent = (
    <>
      <View style={styles.sheetHandle} />
      {title && <Text style={styles.sheetTitle}>{title}</Text>}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {children}
      </ScrollView>
    </>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    // createPortal로 document.body에 직접 렌더링
    // → GestureHandlerRootView 등 부모의 transform이 만드는 stacking context 우회
    const { createPortal } = require('react-dom');
    return createPortal(
      <View style={styles.overlayFixed} pointerEvents="box-none">
        <Pressable style={styles.overlayTouchable} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: maxSheetHeight }]}>
          {sheetContent}
        </View>
      </View>,
      document.body
    );
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { maxHeight: maxSheetHeight }]} onPress={() => {}}>
          {sheetContent}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Tag / Chip ────────────────────────────────────────────────────────────────

interface TagProps {
  label: string;
  type?: 'am' | 'pm' | 'all' | 'success' | 'warn' | 'default';
}

export function Tag({ label, type = 'default' }: TagProps) {
  return (
    <View style={[styles.tag, styles[`tag_${type}`]]}>
      <Text style={[styles.tagText, styles[`tagText_${type}`]]}>{label}</Text>
    </View>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
    </View>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function EmptyState({
  emoji, title, desc, action
}: {
  emoji: string; title: string; desc?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {desc && <Text style={styles.emptyDesc}>{desc}</Text>}
      {action && (
        <Button label={action.label} onPress={action.onPress} style={{ marginTop: spacing.md }} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Button
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md },
  btn_primary: { backgroundColor: colors.caramel },
  btn_secondary: { backgroundColor: colors.sand },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_danger: { backgroundColor: colors.dangerBg },
  btn_sm: { paddingVertical: 8, paddingHorizontal: 14 },
  btn_md: { paddingVertical: 12, paddingHorizontal: 20 },
  btn_lg: { paddingVertical: 16, paddingHorizontal: 28 },
  btn_full: { width: '100%' },
  btn_disabled: { opacity: 0.5 },
  btnText: { fontWeight: '500' },
  btnText_primary: { color: colors.white },
  btnText_secondary: { color: colors.brownMid },
  btnText_ghost: { color: colors.muted },
  btnText_danger: { color: colors.dangerText },
  btnText_sm: { fontSize: 13 },
  btnText_md: { fontSize: 14 },
  btnText_lg: { fontSize: 16 },

  // Input
  inputContainer: { marginBottom: spacing.md },
  inputLabel: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  inputField: {
    backgroundColor: colors.cream,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.sm, padding: 12,
    fontSize: 14, color: colors.charcoal,
  },
  inputError: { borderColor: colors.terracotta },
  errorText: { fontSize: 11, color: colors.terracotta, marginTop: 4 },

  // Card
  card: {
    backgroundColor: colors.warmWhite,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md,
  },

  // Section title
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(44,36,32,0.4)', justifyContent: 'flex-end' },
  overlayFixed: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(44,36,32,0.4)',
  },
  sheet: {
    backgroundColor: colors.warmWhite, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, maxHeight: '85%',
    width: '100%', maxWidth: 430,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.charcoal, marginBottom: spacing.lg },

  // Tag
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  tag_default: { backgroundColor: colors.sand },
  tag_am: { backgroundColor: colors.amBg },
  tag_pm: { backgroundColor: colors.pmBg },
  tag_all: { backgroundColor: colors.allBg },
  tag_success: { backgroundColor: colors.successBg },
  tag_warn: { backgroundColor: colors.warnBg },
  tagText: { fontSize: 10, fontWeight: '600' },
  tagText_default: { color: colors.brownMid },
  tagText_am: { color: colors.amColor },
  tagText_pm: { color: colors.pmColor },
  tagText_all: { color: colors.allColor },
  tagText_success: { color: colors.successText },
  tagText_warn: { color: colors.warnText },

  // Progress
  progressBg: { height: 6, backgroundColor: colors.sand, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.caramel, borderRadius: 3 },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.brownMid, marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
});
